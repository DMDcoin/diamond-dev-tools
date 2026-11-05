import { DnsNameMapping, DnsSyncCheckpoint, DnsSyncStore } from "../db/dnsSyncStore";
import { sleep } from "../utils/time";
import { DnsModerationSource } from "./dnsModerationSource";
import { DnsSyncChain } from "./dnsSyncChain";
import { DnsSyncEvent, dnsNode, hashLabel } from "./dnsSyncEvents";
import { DnsSyncHandler } from "./dnsSyncHandler";
import { DnsSyncProcessor, DnsSyncSettings } from "./dnsSyncProcessor";


const UNLINKED_EVENTS_LIMIT = 100;

/**
 * Follows the naming system contracts and keeps the DNS provider in sync with them.
 *
 * Logs are stored before anything is done with them, together with the checkpoint, so a restart
 * continues exactly where the last committed block range ended.
 */
export class DnsSyncService {

    public chainId = 0;

    private chunkSize: number;
    private lastReconcileAt?: number;

    private logDebug = (process.env.DEV_TOOLS_LOG_DEBUG)?.toLocaleLowerCase() === `true`;

    public constructor(
        public chain: DnsSyncChain,
        public store: DnsSyncStore,
        public moderation: DnsModerationSource,
        public handler: DnsSyncHandler,
        public settings: DnsSyncSettings,
        public clock: () => number = Date.now
    ) {
        this.chunkSize = settings.chunkSize;
    }

    public async init() {
        this.chainId = await this.chain.getChainId();
    }

    public async run() {
        await this.init();

        console.log(`starting DNS sync for chain ${this.chainId}`);

        let waiting = false;

        while (true) {
            try {
                const acquired = await this.store.withLeaderLock(this.chainId, async (store) => {
                    waiting = false;
                    await this.lead(store);
                });

                if (!acquired && !waiting) {
                    console.log('⏳ another DNS sync instance is active, waiting for the lock...');
                    waiting = true;
                }
            } catch (err) {
                console.error('❌ DNS sync stopped with error, restarting:', err);
            }

            await sleep(this.settings.pollIntervalMs);
        }
    }

    public async lead(store: DnsSyncStore) {
        console.log(`✅ DNS sync lock acquired for chain ${this.chainId}`);

        const processor = this.createProcessor(store);
        await processor.recover();

        while (true) {
            const busy = await this.tick(store, processor);

            if (!busy) {
                await sleep(this.settings.pollIntervalMs);
            }
        }
    }

    public createProcessor(store: DnsSyncStore): DnsSyncProcessor {
        return new DnsSyncProcessor(this.chainId, this.chain, store, this.moderation, this.handler, this.settings);
    }

    /**
     * One round of ingesting, processing and reconciling.
     * Returns true if there is more work that should not wait for the next poll.
     */
    public async tick(store: DnsSyncStore, processor: DnsSyncProcessor): Promise<boolean> {
        let head: number;

        try {
            head = await this.chain.getBlockNumber();
        } catch (err) {
            console.error('Error reading the block number for DNS sync:', err);
            return false;
        }

        const safeBlock = head - this.settings.confirmations;
        if (safeBlock < 0) {
            return false;
        }

        let busy = false;

        try {
            await this.checkReorg(store);
            busy = await this.ingest(store, safeBlock);
        } catch (err) {
            if (!isChainError(err)) {
                throw err;
            }

            this.chunkSize = Math.max(1, Math.floor(this.chunkSize / 2));
            console.error(`Error fetching DNS sync events, chunk size is now ${this.chunkSize}:`, err.error);

            return false;
        }

        if (!await store.getCheckpoint(this.chainId)) {
            return busy;
        }

        // events are stored up to the checkpoint, but the state of a name is always read at the
        // safe head, so a name that still has events ahead only gets no-op updates for them later.
        await this.linkEvents(store, processor, safeBlock);

        const processed = await processor.processDueNames(safeBlock);
        await processor.reconcile(safeBlock, true);

        const reconcileDue = this.lastReconcileAt === undefined
            || this.clock() - this.lastReconcileAt >= this.settings.reconcileIntervalMs;

        if (!busy && reconcileDue) {
            await this.seedNames(store);
            const corrected = await processor.reconcile(safeBlock, false);
            this.lastReconcileAt = this.clock();

            console.log(`DNS reconciliation at block ${safeBlock} done, ${corrected} names corrected`);
        }

        return busy || processed > 0;
    }

    /**
     * Compares the stored checkpoint with the chain and rewinds if the block was replaced.
     */
    private async checkReorg(store: DnsSyncStore) {
        const checkpoint = await store.getCheckpoint(this.chainId);
        if (!checkpoint) {
            return;
        }

        const canonicalHash = await this.fromChain(() => this.chain.getBlockHash(checkpoint.blockNumber));
        if (canonicalHash == checkpoint.blockHash) {
            return;
        }

        const lowestBlock = (this.settings.startBlock ?? 0) - 1;
        const rewindTo = Math.max(lowestBlock, checkpoint.blockNumber - this.settings.reorgDepth);

        const staleBlocks = new Array<DnsSyncCheckpoint>();

        for (const block of await store.getEventBlocks(this.chainId, rewindTo)) {
            const hash = await this.fromChain(() => this.chain.getBlockHash(block.blockNumber));

            if (hash != block.blockHash) {
                staleBlocks.push(block);
            }
        }

        let rewindCheckpoint: DnsSyncCheckpoint | null = null;

        if (rewindTo >= 0) {
            const rewindHash = await this.fromChain(() => this.chain.getBlockHash(rewindTo));
            if (!rewindHash) {
                throw new ChainError(new Error(`block ${rewindTo} not found`));
            }
            rewindCheckpoint = { blockNumber: rewindTo, blockHash: rewindHash };
        }

        console.log(`⚠️ block ${checkpoint.blockNumber} was replaced, rewinding DNS sync to block ${rewindTo} (${staleBlocks.length} blocks with orphaned events)`);

        await store.rewind(this.chainId, staleBlocks, rewindCheckpoint);
    }

    /**
     * Stores the next block range. Returns true if the chain is further ahead.
     */
    private async ingest(store: DnsSyncStore, safeBlock: number): Promise<boolean> {
        const checkpoint = await store.getCheckpoint(this.chainId);

        let fromBlock: number;

        if (checkpoint) {
            fromBlock = checkpoint.blockNumber + 1;
        } else if (this.settings.startBlock !== undefined) {
            fromBlock = this.settings.startBlock;
        } else {
            throw new Error('DNS_SYNC_START_BLOCK is not set and no checkpoint exists.');
        }

        if (fromBlock > safeBlock) {
            return false;
        }

        const toBlock = Math.min(safeBlock, fromBlock + this.chunkSize - 1);

        // a reorg replaces the last block of the range too, so an unchanged hash means
        // the logs were read from the same chain the checkpoint is taken from.
        const toBlockHash = await this.fromChain(() => this.chain.getBlockHash(toBlock));
        const events = await this.fromChain(() => this.chain.getEvents(fromBlock, toBlock));
        const toBlockHashAfter = await this.fromChain(() => this.chain.getBlockHash(toBlock));

        if (!toBlockHash || toBlockHash != toBlockHashAfter) {
            throw new ChainError(new Error(`block ${toBlock} not found or replaced while reading logs`));
        }

        await store.saveChunk(this.chainId, events, namesOf(events), { blockNumber: toBlock, blockHash: toBlockHash });

        if (events.length > 0 || this.logDebug) {
            console.log(`pulled DNS sync blocks ${fromBlock}-${toBlock} with ${events.length} events`);
        }

        this.chunkSize = Math.min(this.settings.chunkSize, this.chunkSize * 2);

        return toBlock < safeBlock;
    }

    /**
     * Resolver events only carry the node, if a node is unknown the dmd_names directory might know the name.
     */
    private async linkEvents(store: DnsSyncStore, processor: DnsSyncProcessor, maxBlock: number) {
        let unlinked = await store.getUnlinkedEvents(this.chainId, maxBlock, UNLINKED_EVENTS_LIMIT);

        if (unlinked.length == 0) {
            return;
        }

        await this.seedNames(store);
        await store.linkEvents(this.chainId);

        unlinked = await store.getUnlinkedEvents(this.chainId, maxBlock, UNLINKED_EVENTS_LIMIT);
        await processor.failUnlinkedEvents(unlinked);
    }

    private async seedNames(store: DnsSyncStore) {
        const names = (await store.getDirectoryNames()).filter(name => hashLabel(name.label) == name.labelHash);

        if (names.length > 0) {
            await store.upsertNames(names.map(name => ({ ...name, node: dnsNode(name.labelHash) })));
        }
    }

    private async fromChain<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call();
        } catch (err) {
            throw new ChainError(err);
        }
    }
}

class ChainError extends Error {
    public constructor(public error: unknown) {
        super(`chain request failed: ${error}`);
    }
}

function isChainError(err: unknown): err is ChainError {
    return err instanceof ChainError;
}

function namesOf(events: DnsSyncEvent[]): DnsNameMapping[] {
    const names = new Array<DnsNameMapping>();

    for (const event of events) {
        if (event.labelHash && event.node) {
            const label = event.label && hashLabel(event.label) == event.labelHash ? event.label : null;
            names.push({ labelHash: event.labelHash, node: event.node, label });
        }
    }

    return names;
}
