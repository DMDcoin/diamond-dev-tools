import Web3 from "web3";

import {
    DnsNameMapping,
    DnsPendingOp,
    DnsSyncCheckpoint,
    DnsSyncEventRow,
    DnsSyncName,
    DnsSyncStore
} from "../../db/dnsSyncStore";
import { DnsModerationSource } from "../dnsModerationSource";
import { DnsSyncChain } from "../dnsSyncChain";
import {
    DnsChainNameState,
    DnsNameState,
    DnsRecordKind,
    DnsSyncEvent,
    DnsWebsiteRecord,
    EMPTY_DNS_STATE,
    decodeEmailTarget,
    decodeWebsiteRecord,
    dnsNode
} from "../dnsSyncEvents";
import { DnsSyncHandler, DnsSyncOperation } from "../dnsSyncHandler";
import { DnsSyncProcessor, DnsSyncSettings } from "../dnsSyncProcessor";
import { DnsSyncService } from "../dnsSyncService";


export const OWNER = '0x' + '11'.repeat(20);
export const BUYER = '0x' + '22'.repeat(20);
export const ZERO_ADDRESS = '0x' + '00'.repeat(20);

export const REGISTRAR_ADDRESS = '0x' + 'aa'.repeat(20);
export const RESOLVER_ADDRESS = '0x' + 'bb'.repeat(20);
export const NAMES_ADDRESS = '0x' + 'cc'.repeat(20);

export const TEST_SETTINGS: DnsSyncSettings = {
    startBlock: 1,
    confirmations: 0,
    reorgDepth: 10,
    chunkSize: 5,
    pollIntervalMs: 0,
    reconcileIntervalMs: 60000,
    maxAttempts: 3,
    retryBaseMs: 100,
    retryMaxMs: 1000,
    rpcTimeoutMs: 50
};

export interface RawLog {
    event: string;
    address: string;
    returnValues: { [key: string]: any };
}

interface MinedLog extends RawLog {
    blockNumber: number;
    logIndex: number;
    transactionHash: string;
}

const labelsByNode = new Map<string, string>();

export function labelHashOf(label: string): string {
    const labelHash = Web3.utils.soliditySha3({ type: 'string', value: label })!.toLowerCase();
    labelsByNode.set(dnsNode(labelHash), labelHash);
    return labelHash;
}

export function nodeOf(label: string): string {
    return dnsNode(labelHashOf(label));
}

export function ipv4Bytes(ip: string): string {
    return '0x' + ip.split('.').map(part => Number(part).toString(16).padStart(2, '0')).join('');
}

export function asciiBytes(value: string): string {
    return '0x' + Buffer.from(value, 'ascii').toString('hex');
}

export function setA(label: string, ip: string): RawLog {
    return dnsRecordChanged(label, DnsRecordKind.IPv4, ipv4Bytes(ip));
}

export function setAAAA(label: string, bytes: string): RawLog {
    return dnsRecordChanged(label, DnsRecordKind.IPv6, bytes);
}

export function setCname(label: string, host: string): RawLog {
    return dnsRecordChanged(label, DnsRecordKind.Cname, asciiBytes(host));
}

export function clearDns(label: string): RawLog {
    return dnsRecordChanged(label, DnsRecordKind.None, null);
}

export function dnsRecordChanged(label: string, kind: DnsRecordKind, value: string | null): RawLog {
    return {
        event: 'DNSRecordChanged',
        address: RESOLVER_ADDRESS,
        returnValues: { node: nodeOf(label), kind: String(kind), value }
    };
}

export function setEmail(label: string, target: string): RawLog {
    return {
        event: 'EmailForwardingTargetChanged',
        address: RESOLVER_ADDRESS,
        returnValues: { node: nodeOf(label), target: asciiBytes(target) }
    };
}

export function clearEmail(label: string): RawLog {
    return {
        event: 'EmailForwardingTargetChanged',
        address: RESOLVER_ADDRESS,
        returnValues: { node: nodeOf(label), target: null }
    };
}

export function registered(label: string, owner = OWNER): RawLog {
    return {
        event: 'NameRegistered',
        address: REGISTRAR_ADDRESS,
        returnValues: { node: owner, labelHash: labelHashOf(label), expiration: '2000000000', name: label }
    };
}

export function activated(label: string, owner = OWNER): RawLog {
    return {
        event: 'NameActivated',
        address: REGISTRAR_ADDRESS,
        returnValues: { owner, labelHash: labelHashOf(label), name: label }
    };
}

export function deactivated(label: string, owner = OWNER): RawLog {
    return {
        event: 'NameDeactivated',
        address: REGISTRAR_ADDRESS,
        returnValues: { owner, labelHash: labelHashOf(label), name: label }
    };
}

export function moderated(label: string, owner = OWNER): RawLog {
    return {
        event: 'NameModerated',
        address: REGISTRAR_ADDRESS,
        returnValues: { owmer: owner, labelHash: labelHashOf(label), reason: 'spam', note: 'reported' }
    };
}

export function blockedSet(label: string, blocked: boolean): RawLog {
    return {
        event: 'NameBlockedSet',
        address: REGISTRAR_ADDRESS,
        returnValues: { labelHash: labelHashOf(label), name: label, blocked }
    };
}

export function transferred(label: string, from = OWNER, to = BUYER): RawLog {
    return {
        event: 'Transfer',
        address: NAMES_ADDRESS,
        returnValues: { from, to, tokenId: BigInt(labelHashOf(label)).toString() }
    };
}

/// the logs `transferFrom` emits for an active name, all in one transaction.
export function transferLogs(label: string, from = OWNER, to = BUYER): RawLog[] {
    return [transferred(label, from, to), clearDns(label), clearEmail(label), deactivated(label, from)];
}

export function websiteA(ip: string): DnsWebsiteRecord {
    return { kind: 'A', value: ip };
}

function keccak(value: string): string {
    return Web3.utils.soliditySha3({ type: 'string', value })!.toLowerCase();
}

/**
 * Small stand-in for the chain and the naming contracts. Mined logs also update the name state,
 * like the contracts would. `setState` changes state without a log, e.g. to simulate a lost event.
 */
export class FakeChain implements DnsSyncChain {
    public chainId = 777;
    public head = 0;
    public shuffle = false;
    public duplicate = false;
    public requestedRanges: Array<[number, number]> = [];
    /// runs after the logs of a getEvents call were collected, e.g. to replace blocks in that moment.
    public afterEvents?: () => void;

    private fork = 0;
    private txCounter = 0;
    private hashes = new Map<number, string>();
    private logs = new Array<MinedLog>();
    private states = new Map<string, DnsChainNameState>();
    private failures = new Map<string, number>();

    public constructor() {
        this.hashes.set(0, this.newHash(0));
    }

    public mine(logs: RawLog[], txHash?: string): number {
        const blockNumber = this.newBlock();

        logs.forEach((log, logIndex) => {
            this.logs.push({ ...log, blockNumber, logIndex, transactionHash: txHash ?? this.newTxHash() });
            this.applyLog(log);
        });

        return blockNumber;
    }

    public mineEmpty(count: number) {
        for (let i = 0; i < count; i++) {
            this.newBlock();
        }
    }

    /// mines logs that were dropped by a reorg again, keeping their transaction hash and log index.
    public reinclude(logs: MinedLog[]): number {
        const blockNumber = this.newBlock();

        for (const log of logs) {
            this.logs.push({ ...log, blockNumber });
            this.applyLog(log);
        }

        return blockNumber;
    }

    /// drops all blocks from `fromBlock` on and returns their logs. New blocks get new hashes.
    public reorg(fromBlock: number): MinedLog[] {
        this.fork++;

        const dropped = this.logs.filter(log => log.blockNumber >= fromBlock);
        this.logs = this.logs.filter(log => log.blockNumber < fromBlock);

        for (let blockNumber = fromBlock; blockNumber <= this.head; blockNumber++) {
            this.hashes.delete(blockNumber);
        }

        this.head = fromBlock - 1;

        return dropped;
    }

    public setState(label: string, state: Partial<DnsChainNameState>) {
        const labelHash = labelHashOf(label);
        this.states.set(labelHash, { ...this.stateOf(labelHash), ...state });
    }

    public fail(method: string, times: number) {
        this.failures.set(method, times);
    }

    public async getChainId(): Promise<number> {
        return this.chainId;
    }

    public async getBlockNumber(): Promise<number> {
        this.maybeFail('getBlockNumber');
        return this.head;
    }

    public async getBlockHash(blockNumber: number): Promise<string | null> {
        this.maybeFail('getBlockHash');
        return blockNumber <= this.head ? this.hashes.get(blockNumber) ?? null : null;
    }

    public async getEvents(fromBlock: number, toBlock: number): Promise<DnsSyncEvent[]> {
        this.maybeFail('getEvents');
        this.requestedRanges.push([fromBlock, toBlock]);

        let result = this.logs
            .filter(log => log.blockNumber >= fromBlock && log.blockNumber <= toBlock)
            .map(log => DnsSyncEvent.fromEventData({ ...log, blockHash: this.hashes.get(log.blockNumber) })!);

        if (this.duplicate) {
            result = [...result, ...result];
        }

        if (this.shuffle) {
            result = result
                .map(event => ({ event, order: Math.random() }))
                .sort((a, b) => a.order - b.order)
                .map(entry => entry.event);
        }

        this.afterEvents?.();

        return result;
    }

    public async getNameState(labelHash: string): Promise<DnsChainNameState> {
        this.maybeFail('getNameState');
        return { ...this.stateOf(labelHash) };
    }

    private stateOf(labelHash: string): DnsChainNameState {
        return this.states.get(labelHash) ?? { active: false, expired: false, blocked: false, website: null, email: null };
    }

    private applyLog(log: RawLog) {
        const values = log.returnValues;
        const labelHash = values.labelHash ?? labelsByNode.get(values.node);

        if (!labelHash) {
            return;
        }

        const state = this.stateOf(labelHash);

        switch (log.event) {
            case 'NameActivated':
                state.active = true;
                break;
            case 'NameDeactivated':
                state.active = false;
                state.website = null;
                state.email = null;
                break;
            case 'NameBlockedSet':
                state.blocked = values.blocked;
                break;
            case 'DNSRecordChanged':
                state.website = decodeWebsiteRecord(Number(values.kind), values.value);
                break;
            case 'EmailForwardingTargetChanged':
                state.email = decodeEmailTarget(values.target);
                break;
        }

        this.states.set(labelHash, state);
    }

    private maybeFail(method: string) {
        const remaining = this.failures.get(method) ?? 0;

        if (remaining > 0) {
            this.failures.set(method, remaining - 1);
            throw new Error(`${method} failed: connection reset`);
        }
    }

    private newBlock(): number {
        this.head++;
        this.hashes.set(this.head, this.newHash(this.head));
        return this.head;
    }

    private newHash(blockNumber: number): string {
        return keccak(`block-${blockNumber}-${this.fork}`);
    }

    private newTxHash(): string {
        return keccak(`tx-${this.txCounter++}`);
    }
}

export interface MemoryEvent {
    id: number;
    chainId: number;
    txHash: string;
    logIndex: number;
    blockNumber: number;
    blockHash: string;
    eventName: string;
    labelHash: string | null;
    node: string | null;
    status: string;
    attempts: number;
    nextAttemptAt: number | null;
    lastError: string | null;
}

interface MemoryState {
    checkpoints: Map<number, DnsSyncCheckpoint>;
    events: MemoryEvent[];
    names: Map<string, DnsSyncName>;
    nextEventId: number;
}

const OPEN_STATUSES = ['pending', 'processing', 'failed'];

/**
 * In memory version of PgDnsSyncStore. Every method is applied atomically like a transaction.
 * `crashOn(method)` makes the store unavailable when that method is called, which looks to the
 * service like the process died at that point: nothing of that call or later calls is stored.
 */
export class MemoryDnsSyncStore implements DnsSyncStore {
    public state: MemoryState = { checkpoints: new Map(), events: [], names: new Map(), nextEventId: 1 };
    public directory = new Map<string, { label: string, blocked: boolean }>();
    public down = false;

    private crashMethod?: string;
    private leader = false;

    public constructor(
        public clock: () => number
    ) { }

    public crashOn(method: string) {
        this.crashMethod = method;
    }

    public restart() {
        this.down = false;
        this.leader = false;
    }

    public kill() {
        this.down = true;
    }

    public eventsOf(label: string): MemoryEvent[] {
        const labelHash = labelHashOf(label);
        return this.state.events.filter(event => event.labelHash == labelHash);
    }

    public async withLeaderLock(chainId: number, fn: (store: DnsSyncStore) => Promise<void>): Promise<boolean> {
        this.enter('withLeaderLock');

        if (this.leader) {
            return false;
        }

        this.leader = true;

        try {
            await fn(this);
        } finally {
            this.leader = false;
        }

        return true;
    }

    public async getCheckpoint(chainId: number): Promise<DnsSyncCheckpoint | null> {
        return this.read('getCheckpoint', state => state.checkpoints.get(chainId) ?? null);
    }

    public async saveChunk(
        chainId: number,
        events: DnsSyncEvent[],
        names: DnsNameMapping[],
        checkpoint: DnsSyncCheckpoint
    ): Promise<void> {
        this.write('saveChunk', state => {
            this.insertNames(state, names);

            for (const event of events) {
                const known = state.events.find(row =>
                    row.chainId == chainId && row.txHash == event.txHash && row.logIndex == event.logIndex
                );

                if (known) {
                    known.blockNumber = event.blockNumber;
                    known.blockHash = event.blockHash;
                    if (known.status == 'orphaned') {
                        known.status = 'pending';
                    }
                    continue;
                }

                state.events.push({
                    id: state.nextEventId++,
                    chainId,
                    txHash: event.txHash,
                    logIndex: event.logIndex,
                    blockNumber: event.blockNumber,
                    blockHash: event.blockHash,
                    eventName: event.eventName,
                    labelHash: event.labelHash,
                    node: event.node,
                    status: 'pending',
                    attempts: 0,
                    nextAttemptAt: null,
                    lastError: null
                });
            }

            this.link(state, chainId);
            state.checkpoints.set(chainId, { ...checkpoint });
        });
    }

    public async getEventBlocks(chainId: number, blockNumber: number): Promise<DnsSyncCheckpoint[]> {
        return this.read('getEventBlocks', state => {
            const blocks = new Map<string, DnsSyncCheckpoint>();

            for (const event of state.events) {
                if (event.chainId == chainId && event.blockNumber > blockNumber && event.status != 'orphaned') {
                    blocks.set(`${event.blockNumber}:${event.blockHash}`, { blockNumber: event.blockNumber, blockHash: event.blockHash });
                }
            }

            return Array.from(blocks.values()).sort((a, b) => a.blockNumber - b.blockNumber);
        });
    }

    public async rewind(chainId: number, staleBlocks: DnsSyncCheckpoint[], checkpoint: DnsSyncCheckpoint | null): Promise<void> {
        this.write('rewind', state => {
            for (const block of staleBlocks) {
                for (const event of state.events) {
                    if (event.chainId != chainId || event.blockNumber != block.blockNumber || event.blockHash != block.blockHash) {
                        continue;
                    }

                    if (event.status == 'done' && event.labelHash) {
                        const name = state.names.get(event.labelHash);
                        if (name) {
                            name.dirty = true;
                        }
                    }

                    if (event.status == 'pending' || event.status == 'failed') {
                        event.status = 'orphaned';
                    }
                }
            }

            if (checkpoint) {
                state.checkpoints.set(chainId, { ...checkpoint });
            } else {
                state.checkpoints.delete(chainId);
            }
        });
    }

    public async upsertNames(names: DnsNameMapping[]): Promise<void> {
        this.write('upsertNames', state => this.insertNames(state, names));
    }

    public async getDirectoryNames(): Promise<{ labelHash: string, label: string }[]> {
        return this.read('getDirectoryNames', state => Array.from(this.directory.entries())
            .filter(([labelHash]) => !state.names.get(labelHash)?.label)
            .map(([labelHash, entry]) => ({ labelHash, label: entry.label })));
    }

    public async linkEvents(chainId: number): Promise<number> {
        return this.write('linkEvents', state => this.link(state, chainId));
    }

    public async getUnlinkedEvents(chainId: number, maxBlock: number, limit: number): Promise<DnsSyncEventRow[]> {
        return this.read('getUnlinkedEvents', state => state.events
            .filter(event => event.chainId == chainId && event.labelHash == null && event.blockNumber <= maxBlock)
            .filter(event => this.isDue(event))
            .sort(byChainOrder)
            .slice(0, limit)
            .map(toRow));
    }

    public async resetProcessing(chainId: number): Promise<number> {
        return this.write('resetProcessing', state => {
            let count = 0;

            for (const event of state.events) {
                if (event.chainId == chainId && event.status == 'processing') {
                    event.status = 'pending';
                    count++;
                }
            }

            return count;
        });
    }

    public async getNamesWithPendingOp(): Promise<DnsSyncName[]> {
        return this.read('getNamesWithPendingOp', state => Array.from(state.names.values())
            .filter(name => name.pendingOp != null)
            .sort((a, b) => a.labelHash.localeCompare(b.labelHash)));
    }

    public async getDueNames(chainId: number, maxBlock: number, limit: number): Promise<string[]> {
        return this.read('getDueNames', state => {
            const heads = new Map<string, MemoryEvent>();

            for (const event of [...state.events].sort(byChainOrder)) {
                if (event.chainId != chainId || !event.labelHash || event.blockNumber > maxBlock) {
                    continue;
                }

                if (OPEN_STATUSES.includes(event.status) && !heads.has(event.labelHash)) {
                    heads.set(event.labelHash, event);
                }
            }

            return Array.from(heads.values())
                .filter(event => this.isDue(event))
                .sort(byChainOrder)
                .slice(0, limit)
                .map(event => event.labelHash!);
        });
    }

    public async getBatch(chainId: number, labelHash: string, maxBlock: number): Promise<DnsSyncEventRow[]> {
        return this.read('getBatch', state => state.events
            .filter(event => event.chainId == chainId && event.labelHash == labelHash && event.blockNumber <= maxBlock)
            .filter(event => event.status == 'pending' || event.status == 'failed')
            .sort(byChainOrder)
            .map(toRow));
    }

    public async getName(labelHash: string): Promise<DnsSyncName | null> {
        return this.read('getName', state => state.names.get(labelHash) ?? null);
    }

    public async getIdleNames(chainId: number, dirtyOnly: boolean): Promise<DnsSyncName[]> {
        return this.read('getIdleNames', state => Array.from(state.names.values())
            .filter(name => !dirtyOnly || name.dirty)
            .filter(name => !state.events.some(event =>
                event.chainId == chainId && event.labelHash == name.labelHash && OPEN_STATUSES.includes(event.status)
            ))
            .sort((a, b) => a.labelHash.localeCompare(b.labelHash)));
    }

    public async beginOp(labelHash: string, op: DnsPendingOp): Promise<void> {
        this.write('beginOp', state => {
            const name = state.names.get(labelHash);
            if (name) {
                name.pendingOp = op;
            }

            this.setStatus(state, op.eventIds, 'processing');
        });
    }

    public async completeOp(labelHash: string, eventIds: number[], applied: DnsNameState): Promise<void> {
        this.write('completeOp', state => {
            const name = state.names.get(labelHash);
            if (name) {
                name.applied = applied;
                name.pendingOp = null;
                name.dirty = false;
            }

            this.setStatus(state, eventIds, 'done');
        });
    }

    public async failOp(labelHash: string | null, eventIds: number[], error: string, delayMs: number, dead: boolean): Promise<void> {
        this.write('failOp', state => {
            const name = labelHash ? state.names.get(labelHash) : undefined;
            if (name) {
                name.pendingOp = null;
                name.dirty = false;
            }

            for (const event of state.events) {
                if (eventIds.includes(event.id)) {
                    event.status = dead ? 'dead' : 'failed';
                    event.attempts++;
                    event.lastError = error;
                    event.nextAttemptAt = this.clock() + delayMs;
                }
            }
        });
    }

    private insertNames(state: MemoryState, names: DnsNameMapping[]) {
        for (const mapping of names) {
            const known = state.names.get(mapping.labelHash);

            if (known) {
                known.label = mapping.label ?? known.label;
                continue;
            }

            state.names.set(mapping.labelHash, {
                labelHash: mapping.labelHash,
                label: mapping.label,
                node: mapping.node,
                applied: EMPTY_DNS_STATE,
                pendingOp: null,
                dirty: false
            });
        }
    }

    private link(state: MemoryState, chainId: number): number {
        const byNode = new Map(Array.from(state.names.values()).map(name => [name.node, name.labelHash]));
        let count = 0;

        for (const event of state.events) {
            if (event.chainId == chainId && event.labelHash == null && event.node && byNode.has(event.node)) {
                event.labelHash = byNode.get(event.node)!;
                count++;
            }
        }

        return count;
    }

    private setStatus(state: MemoryState, eventIds: number[], status: string) {
        for (const event of state.events) {
            if (eventIds.includes(event.id)) {
                event.status = status;
            }
        }
    }

    private isDue(event: MemoryEvent): boolean {
        return event.status == 'pending' || (event.status == 'failed' && event.nextAttemptAt! <= this.clock());
    }

    private enter(method: string) {
        if (this.down) {
            throw new Error('store unavailable');
        }

        if (this.crashMethod == method) {
            this.crashMethod = undefined;
            this.down = true;
            throw new Error(`crashed in ${method}`);
        }
    }

    private read<T>(method: string, fn: (state: MemoryState) => T): T {
        this.enter(method);
        return structuredClone(fn(this.state));
    }

    private write<T>(method: string, fn: (state: MemoryState) => T): T {
        this.enter(method);

        const draft = structuredClone(this.state);
        const result = fn(draft);
        this.state = draft;

        return result;
    }
}

function byChainOrder(a: MemoryEvent, b: MemoryEvent): number {
    return a.blockNumber - b.blockNumber || a.logIndex - b.logIndex;
}

function toRow(event: MemoryEvent): DnsSyncEventRow {
    return {
        id: event.id,
        eventName: event.eventName,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        labelHash: event.labelHash,
        status: event.status,
        attempts: event.attempts
    };
}

export interface HandlerCall {
    action: string;
    label: string;
    opId: string;
    detail?: string;
}

/**
 * Behaves like an idempotent DNS provider: an operation step delivered again with the same opId
 * is accepted but not applied a second time.
 */
export class RecordingHandler implements DnsSyncHandler {
    public deliveries = new Array<HandlerCall>();
    public applied = new Array<HandlerCall>();
    public published = new Map<string, DnsNameState>();
    public failNext = 0;
    public beforeCall?: (call: HandlerCall) => void;

    private seen = new Set<string>();

    public async setWebsite(op: DnsSyncOperation, record: DnsWebsiteRecord): Promise<void> {
        this.handle('setWebsite', op, `${record.kind} ${record.value}`, state => ({ ...state, website: record }));
    }

    public async removeWebsite(op: DnsSyncOperation): Promise<void> {
        this.handle('removeWebsite', op, undefined, state => ({ ...state, website: null }));
    }

    public async setEmailForwarding(op: DnsSyncOperation, target: string): Promise<void> {
        this.handle('setEmailForwarding', op, target, state => ({ ...state, email: target }));
    }

    public async removeEmailForwarding(op: DnsSyncOperation): Promise<void> {
        this.handle('removeEmailForwarding', op, undefined, state => ({ ...state, email: null }));
    }

    public async clearOnTransfer(op: DnsSyncOperation): Promise<void> {
        this.handle('clearOnTransfer', op, undefined, () => EMPTY_DNS_STATE);
    }

    public async removeModeratedName(op: DnsSyncOperation): Promise<void> {
        this.handle('removeModeratedName', op, undefined, () => EMPTY_DNS_STATE);
    }

    public appliedFor(label: string): HandlerCall[] {
        return this.applied.filter(call => call.label == label);
    }

    public publishedFor(label: string): DnsNameState {
        return this.published.get(label) ?? EMPTY_DNS_STATE;
    }

    private handle(action: string, op: DnsSyncOperation, detail: string | undefined, apply: (state: DnsNameState) => DnsNameState) {
        const call: HandlerCall = { action, label: op.label, opId: op.opId, detail };

        this.deliveries.push(call);
        this.beforeCall?.(call);

        if (this.failNext > 0) {
            this.failNext--;
            throw new Error('DNS provider unavailable');
        }

        const key = `${op.opId}:${action}`;
        if (this.seen.has(key)) {
            return;
        }

        this.seen.add(key);
        this.applied.push(call);
        this.published.set(op.label, apply(this.publishedFor(op.label)));
    }
}

export class FakeModeration implements DnsModerationSource {
    public hidden = new Set<string>();

    public hide(label: string) {
        this.hidden.add(labelHashOf(label));
    }

    public async isHidden(labelHash: string): Promise<boolean> {
        return this.hidden.has(labelHash);
    }
}

export class DnsSyncHarness {
    public now = 0;
    public chain = new FakeChain();
    public store: MemoryDnsSyncStore;
    public handler = new RecordingHandler();
    public moderation = new FakeModeration();
    public settings: DnsSyncSettings;

    public service!: DnsSyncService;
    public processor!: DnsSyncProcessor;

    public constructor(settings: Partial<DnsSyncSettings> = {}) {
        this.settings = { ...TEST_SETTINGS, ...settings };
        this.store = new MemoryDnsSyncStore(() => this.now);
    }

    /// (re)starts the service like a fresh process on the same database.
    public async start() {
        this.store.restart();

        this.service = new DnsSyncService(this.chain, this.store, this.moderation, this.handler, this.settings, () => this.now);
        await this.service.init();

        this.processor = this.service.createProcessor(this.store);
        await this.processor.recover();
    }

    /// ticks until the service has nothing left to do right now.
    public async sync() {
        for (let i = 0; i < 100; i++) {
            if (!await this.service.tick(this.store, this.processor)) {
                return;
            }
        }

        throw new Error('sync did not settle');
    }

    /// like sync, but a store crash ends the run instead of failing the test.
    public async syncUntilCrash() {
        try {
            await this.sync();
        } catch (err) {
            if (!this.store.down) {
                throw err;
            }
        }
    }

    public advance(ms: number) {
        this.now += ms;
    }
}
