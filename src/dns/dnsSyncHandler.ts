import { DnsNameState, DnsWebsiteRecord } from "./dnsSyncEvents";
import { PleskClient, getPleskSettings } from "./pleskClient";
import { PleskDnsSyncHandler } from "./pleskDnsSyncHandler";


export interface DnsSyncOperation {
    /// stable id of the operation, the same id is used again if the operation gets replayed after a restart.
    opId: string;
    label: string;
    labelHash: string;
    /// state that was published before this operation.
    previous: DnsNameState;
}

export type DnsSyncStep =
    { action: 'setWebsite', record: DnsWebsiteRecord }
    | { action: 'removeWebsite' }
    | { action: 'setEmailForwarding', target: string }
    | { action: 'removeEmailForwarding' }
    | { action: 'clearOnTransfer' }
    | { action: 'removeModeratedName' };

/**
 * Applies DNS changes at the DNS provider.
 * Implementations must be idempotent: an operation can be delivered again with the same opId
 * if the service stopped before the result was stored.
 */
export interface DnsSyncHandler {
    setWebsite(op: DnsSyncOperation, record: DnsWebsiteRecord): Promise<void>;

    removeWebsite(op: DnsSyncOperation): Promise<void>;

    setEmailForwarding(op: DnsSyncOperation, target: string): Promise<void>;

    removeEmailForwarding(op: DnsSyncOperation): Promise<void>;

    /// removes website and email forwarding after the name token changed its owner.
    clearOnTransfer(op: DnsSyncOperation): Promise<void>;

    /// removes website and email forwarding of a hidden or blocked name.
    removeModeratedName(op: DnsSyncOperation): Promise<void>;
}

export class LoggingDnsSyncHandler implements DnsSyncHandler {

    public async setWebsite(op: DnsSyncOperation, record: DnsWebsiteRecord): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: set website ${record.kind} ${record.value} (op ${op.opId})`);
    }

    public async removeWebsite(op: DnsSyncOperation): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: remove website (op ${op.opId})`);
    }

    public async setEmailForwarding(op: DnsSyncOperation, target: string): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: set email forwarding to ${target} (op ${op.opId})`);
    }

    public async removeEmailForwarding(op: DnsSyncOperation): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: remove email forwarding (op ${op.opId})`);
    }

    public async clearOnTransfer(op: DnsSyncOperation): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: clear all records after ownership transfer (op ${op.opId})`);
    }

    public async removeModeratedName(op: DnsSyncOperation): Promise<void> {
        console.log(`[dns] ${op.label}.dmd: remove all records of moderated name (op ${op.opId})`);
    }
}

export function createDnsSyncHandler(name?: string): DnsSyncHandler {
    switch (name ?? 'logging') {
        case '':
        case 'logging':
            return new LoggingDnsSyncHandler();
        case 'plesk':
            return new PleskDnsSyncHandler(new PleskClient(getPleskSettings()));
        default:
            throw new Error(`Unknown DNS sync handler: ${name}`);
    }
}
