import { randomUUID } from "crypto";

import { DnsPendingOp, DnsSyncEventRow, DnsSyncName, DnsSyncStore } from "../db/dnsSyncStore";
import { toErrorWithMessage } from "../utils/error";
import { DnsModerationSource } from "./dnsModerationSource";
import { DnsSyncChain } from "./dnsSyncChain";
import { DnsNameState, EMPTY_DNS_STATE, dnsNode, hashLabel, isValidName, sameWebsite } from "./dnsSyncEvents";
import { DnsSyncHandler, DnsSyncOperation, DnsSyncStep } from "./dnsSyncHandler";


export interface DnsSyncSettings {
    startBlock?: number;
    confirmations: number;
    reorgDepth: number;
    chunkSize: number;
    pollIntervalMs: number;
    reconcileIntervalMs: number;
    maxAttempts: number;
    retryBaseMs: number;
    retryMaxMs: number;
    rpcTimeoutMs: number;
}

export type DnsSyncReason = 'update' | 'transfer' | 'moderation';

const DUE_NAMES_LIMIT = 100;

/**
 * Steps that bring the published state of a name from `applied` to `desired`.
 */
export function planDnsSyncSteps(applied: DnsNameState, desired: DnsNameState, reason: DnsSyncReason): DnsSyncStep[] {
    const hasApplied = applied.website != null || applied.email != null;
    const hasDesired = desired.website != null || desired.email != null;

    if (hasApplied && !hasDesired) {
        if (reason == 'moderation') {
            return [{ action: 'removeModeratedName' }];
        }

        if (reason == 'transfer') {
            return [{ action: 'clearOnTransfer' }];
        }
    }

    const steps: DnsSyncStep[] = [];

    if (!sameWebsite(applied.website, desired.website)) {
        steps.push(desired.website ? { action: 'setWebsite', record: desired.website } : { action: 'removeWebsite' });
    }

    if (applied.email != desired.email) {
        steps.push(desired.email ? { action: 'setEmailForwarding', target: desired.email } : { action: 'removeEmailForwarding' });
    }

    return steps;
}

/**
 * Brings the published DNS state of names in line with the chain.
 * Events only tell which names changed, the state to publish is always read from the chain.
 */
export class DnsSyncProcessor {

    public constructor(
        public chainId: number,
        public chain: DnsSyncChain,
        public store: DnsSyncStore,
        public moderation: DnsModerationSource,
        public handler: DnsSyncHandler,
        public settings: DnsSyncSettings
    ) { }

    /**
     * Finishes operations that were sent to the handler before the last stop
     * and releases events that were left in processing.
     */
    public async recover() {
        for (const name of await this.store.getNamesWithPendingOp()) {
            const op = name.pendingOp!;

            console.log(`🔄 replaying DNS operation ${op.opId} for ${describeName(name)}`);

            try {
                await this.applySteps(name, op);
                await this.store.completeOp(name.labelHash, op.eventIds, op.desired);
            } catch (error) {
                await this.handleFailure(name, op.eventIds, 0, error);
            }
        }

        const released = await this.store.resetProcessing(this.chainId);
        if (released > 0) {
            console.log(`🔄 released ${released} DNS sync events left in processing`);
        }
    }

    public async processDueNames(safeBlock: number) {
        const labelHashes = await this.store.getDueNames(this.chainId, safeBlock, DUE_NAMES_LIMIT);

        for (const labelHash of labelHashes) {
            await this.processName(labelHash, safeBlock);
        }

        return labelHashes.length;
    }

    public async processName(labelHash: string, safeBlock: number) {
        const events = await this.store.getBatch(this.chainId, labelHash, safeBlock);

        if (events.length == 0) {
            return;
        }

        const name = await this.store.getName(labelHash) ?? emptyName(labelHash);
        const eventIds = events.map(event => event.id);
        const reason: DnsSyncReason = events.some(event => event.eventName == 'Transfer') ? 'transfer' : 'update';

        try {
            await this.syncName(name, eventIds, reason, safeBlock);
        } catch (error) {
            await this.handleFailure(name, eventIds, maxAttempts(events), error);
        }
    }

    /**
     * Re-checks names that have no open events, so lost events, expired names and
     * changes of the moderation list still end up in DNS. Returns the number of corrected names.
     */
    public async reconcile(safeBlock: number, dirtyOnly: boolean): Promise<number> {
        let corrected = 0;

        for (const name of await this.store.getIdleNames(this.chainId, dirtyOnly)) {
            try {
                if (await this.syncName(name, [], 'update', safeBlock)) {
                    console.log(`🔧 corrected DNS drift of ${describeName(name)}`);
                    corrected++;
                }
            } catch (error) {
                console.error(`Error reconciling DNS of ${describeName(name)}:`, error);
                await this.store.failOp(name.labelHash, [], toErrorWithMessage(error).message, 0, false);
            }
        }

        return corrected;
    }

    /**
     * Resolver events whose node isn't known can't be assigned to a name, they are retried until they give up.
     */
    public async failUnlinkedEvents(events: DnsSyncEventRow[]) {
        for (const event of events) {
            const attempts = event.attempts + 1;
            const dead = attempts >= this.settings.maxAttempts;

            if (dead) {
                console.error(`❌ giving up on ${event.eventName} at block ${event.blockNumber}: node is not linked to any known name`);
            }

            await this.store.failOp(null, [event.id], 'node is not linked to any known name', this.retryDelay(attempts), dead);
        }
    }

    /**
     * Returns true if the handler had to be called.
     */
    private async syncName(name: DnsSyncName, eventIds: number[], reason: DnsSyncReason, safeBlock: number): Promise<boolean> {
        const { desired, moderated } = await this.getDesiredState(name, safeBlock);
        const steps = planDnsSyncSteps(name.applied, desired, moderated ? 'moderation' : reason);

        if (steps.length == 0) {
            await this.store.completeOp(name.labelHash, eventIds, name.applied);
            return false;
        }

        const op: DnsPendingOp = { opId: randomUUID(), eventIds, steps, desired };

        await this.store.beginOp(name.labelHash, op);
        await this.applySteps(name, op);
        await this.store.completeOp(name.labelHash, eventIds, desired);

        return true;
    }

    private async getDesiredState(name: DnsSyncName, safeBlock: number): Promise<{ desired: DnsNameState, moderated: boolean }> {
        // without a label that really belongs to this name there is no host name that could be published.
        if (!name.label || !isValidName(name.label) || hashLabel(name.label) != name.labelHash) {
            return { desired: EMPTY_DNS_STATE, moderated: false };
        }

        const state = await this.chain.getNameState(name.labelHash, name.label, name.node, safeBlock);
        const moderated = state.blocked || await this.moderation.isHidden(name.labelHash);

        if (!state.active || state.expired || moderated) {
            return { desired: EMPTY_DNS_STATE, moderated };
        }

        return { desired: { website: state.website, email: state.email }, moderated: false };
    }

    private async applySteps(name: DnsSyncName, op: DnsPendingOp) {
        const operation: DnsSyncOperation = {
            opId: op.opId,
            label: name.label ?? '',
            labelHash: name.labelHash,
            previous: name.applied
        };

        for (const step of op.steps) {
            switch (step.action) {
                case 'setWebsite':
                    await this.handler.setWebsite(operation, step.record);
                    break;
                case 'removeWebsite':
                    await this.handler.removeWebsite(operation);
                    break;
                case 'setEmailForwarding':
                    await this.handler.setEmailForwarding(operation, step.target);
                    break;
                case 'removeEmailForwarding':
                    await this.handler.removeEmailForwarding(operation);
                    break;
                case 'clearOnTransfer':
                    await this.handler.clearOnTransfer(operation);
                    break;
                case 'removeModeratedName':
                    await this.handler.removeModeratedName(operation);
                    break;
            }
        }
    }

    private async handleFailure(name: DnsSyncName, eventIds: number[], previousAttempts: number, error: unknown) {
        const attempts = previousAttempts + 1;
        const dead = attempts >= this.settings.maxAttempts;
        const delay = this.retryDelay(attempts);
        const message = toErrorWithMessage(error).message;

        if (dead) {
            console.error(`❌ giving up on DNS sync of ${describeName(name)} after ${attempts} attempts:`, error);
        } else {
            console.error(`Error syncing DNS of ${describeName(name)} (attempt ${attempts}/${this.settings.maxAttempts}), retry in ${delay}ms:`, error);
        }

        await this.store.failOp(name.labelHash, eventIds, message, delay, dead);
    }

    private retryDelay(attempts: number): number {
        const delay = Math.min(this.settings.retryBaseMs * Math.pow(2, attempts - 1), this.settings.retryMaxMs);
        const jitter = Math.floor(Math.random() * delay * 0.1);

        return Math.min(delay + jitter, this.settings.retryMaxMs);
    }
}

function maxAttempts(events: DnsSyncEventRow[]): number {
    return Math.max(...events.map(event => event.attempts));
}

function emptyName(labelHash: string): DnsSyncName {
    return {
        labelHash,
        label: null,
        node: dnsNode(labelHash),
        applied: EMPTY_DNS_STATE,
        pendingOp: null,
        dirty: false
    };
}

function describeName(name: DnsSyncName): string {
    return name.label ? `${name.label}.dmd` : name.labelHash;
}
