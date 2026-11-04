import { Queryable, sql } from "@databases/pg";

import { DnsNameState, DnsSyncEvent, DnsWebsiteRecord } from "../dns/dnsSyncEvents";
import { DnsSyncStep } from "../dns/dnsSyncHandler";
import { hexToBuffer } from "../utils/hex";


// key of the advisory lock that elects the single DNS sync writer, second key is the chain id.
const DNS_SYNC_LOCK_ID = 7234;

export interface DnsSyncCheckpoint {
    blockNumber: number;
    blockHash: string;
}

export interface DnsNameMapping {
    labelHash: string;
    node: string;
    label: string | null;
}

export interface DnsSyncEventRow {
    id: number;
    eventName: string;
    blockNumber: number;
    blockHash: string;
    logIndex: number;
    labelHash: string | null;
    status: string;
    attempts: number;
}

export interface DnsPendingOp {
    opId: string;
    eventIds: number[];
    steps: DnsSyncStep[];
    desired: DnsNameState;
}

export interface DnsSyncName {
    labelHash: string;
    label: string | null;
    node: string;
    applied: DnsNameState;
    pendingOp: DnsPendingOp | null;
    dirty: boolean;
}

export interface DnsSyncStore {
    /**
     * Runs `fn` while holding the writer lock for the chain.
     * Returns false without calling `fn` if another instance holds the lock.
     */
    withLeaderLock(chainId: number, fn: (store: DnsSyncStore) => Promise<void>): Promise<boolean>;

    getCheckpoint(chainId: number): Promise<DnsSyncCheckpoint | null>;

    /**
     * Stores the events of a block range, the names they reference and the new checkpoint in one transaction.
     */
    saveChunk(chainId: number, events: DnsSyncEvent[], names: DnsNameMapping[], checkpoint: DnsSyncCheckpoint): Promise<void>;

    /**
     * Distinct blocks of stored events above `blockNumber`.
     */
    getEventBlocks(chainId: number, blockNumber: number): Promise<DnsSyncCheckpoint[]>;

    /**
     * Orphans the events of `staleBlocks`, marks names with already processed events there as dirty
     * and moves the checkpoint back (or removes it if `checkpoint` is null).
     */
    rewind(chainId: number, staleBlocks: DnsSyncCheckpoint[], checkpoint: DnsSyncCheckpoint | null): Promise<void>;

    upsertNames(names: DnsNameMapping[]): Promise<void>;

    /**
     * Names from the dmd_names directory that are unknown here or have no label yet.
     */
    getDirectoryNames(): Promise<{ labelHash: string, label: string }[]>;

    /**
     * Assigns label hashes to resolver events whose node is known now. Returns the number of linked events.
     */
    linkEvents(chainId: number): Promise<number>;

    getUnlinkedEvents(chainId: number, maxBlock: number, limit: number): Promise<DnsSyncEventRow[]>;

    /**
     * Moves events left in `processing` by a stopped instance back to `pending`.
     */
    resetProcessing(chainId: number): Promise<number>;

    getNamesWithPendingOp(): Promise<DnsSyncName[]>;

    /**
     * Label hashes of names whose oldest open event is pending or due for retry.
     */
    getDueNames(chainId: number, maxBlock: number, limit: number): Promise<string[]>;

    /**
     * Open events of a name up to `maxBlock`, in chain order.
     */
    getBatch(chainId: number, labelHash: string, maxBlock: number): Promise<DnsSyncEventRow[]>;

    getName(labelHash: string): Promise<DnsSyncName | null>;

    /**
     * Names without open events, used by the reconciliation.
     */
    getIdleNames(chainId: number, dirtyOnly: boolean): Promise<DnsSyncName[]>;

    beginOp(labelHash: string, op: DnsPendingOp): Promise<void>;

    completeOp(labelHash: string, eventIds: number[], applied: DnsNameState): Promise<void>;

    failOp(labelHash: string | null, eventIds: number[], error: string, delayMs: number, dead: boolean): Promise<void>;
}

function toHex(buffer: Buffer | null): string | null {
    return buffer ? '0x' + buffer.toString('hex') : null;
}

function toEventRow(row: any): DnsSyncEventRow {
    return {
        id: row.id,
        eventName: row.event_type,
        blockNumber: row.block_number,
        blockHash: toHex(row.block_hash)!,
        logIndex: row.log_index,
        labelHash: toHex(row.label_hash),
        status: row.status,
        attempts: row.attempts
    };
}

function toName(row: any): DnsSyncName {
    const website: DnsWebsiteRecord | null = row.applied_website_kind
        ? { kind: row.applied_website_kind, value: row.applied_website_value }
        : null;

    return {
        labelHash: toHex(row.label_hash)!,
        label: row.label,
        node: toHex(row.node)!,
        applied: { website, email: row.applied_email },
        pendingOp: row.pending_op ?? null,
        dirty: row.dirty
    };
}

export class PgDnsSyncStore implements DnsSyncStore {

    public constructor(
        public db: Queryable
    ) { }

    public async withLeaderLock(chainId: number, fn: (store: DnsSyncStore) => Promise<void>): Promise<boolean> {
        // the lock belongs to one session, so everything the leader does runs on that connection.
        // if the connection drops, the lock is gone and nothing else can be committed with it.
        return await this.db.task(async (connection) => {
            const [row] = await connection.query(
                sql`SELECT pg_try_advisory_lock(${DNS_SYNC_LOCK_ID}::int, ${chainId}::int) AS locked;`
            );

            if (!row.locked) {
                return false;
            }

            try {
                await fn(new PgDnsSyncStore(connection));
            } finally {
                await connection.query(sql`SELECT pg_advisory_unlock(${DNS_SYNC_LOCK_ID}::int, ${chainId}::int);`)
                    .catch(() => { });
            }

            return true;
        });
    }

    public async getCheckpoint(chainId: number): Promise<DnsSyncCheckpoint | null> {
        const [row] = await this.db.query(sql`
            SELECT block_number, block_hash FROM dns_sync_checkpoint WHERE chain_id = ${chainId};
        `);

        return row ? { blockNumber: row.block_number, blockHash: toHex(row.block_hash)! } : null;
    }

    public async saveChunk(
        chainId: number,
        events: DnsSyncEvent[],
        names: DnsNameMapping[],
        checkpoint: DnsSyncCheckpoint
    ): Promise<void> {
        // one insert can't touch the same row twice, so a log that came twice in one response is dropped here.
        const unique = new Map<string, DnsSyncEvent>();
        for (const event of events) {
            unique.set(`${event.txHash}:${event.logIndex}`, event);
        }

        try {
            await this.db.tx(async (tx) => {
                await PgDnsSyncStore.insertNames(tx, names);

                if (unique.size > 0) {
                    const rows = Array.from(unique.values()).map(event => sql`(
                        ${chainId},
                        ${hexToBuffer(event.txHash)},
                        ${event.logIndex},
                        ${event.blockNumber},
                        ${hexToBuffer(event.blockHash)},
                        ${hexToBuffer(event.contractAddress)},
                        ${event.eventName},
                        ${event.labelHash ? hexToBuffer(event.labelHash) : null},
                        ${event.node ? hexToBuffer(event.node) : null},
                        ${JSON.stringify(event.values)}::jsonb
                    )`);

                    // a log delivered again is ignored, unless a reorg orphaned it and it came back.
                    await tx.query(sql`
                        INSERT INTO dns_sync_events (
                            chain_id,
                            tx_hash,
                            log_index,
                            block_number,
                            block_hash,
                            contract_address,
                            event_type,
                            label_hash,
                            node,
                            payload
                        ) VALUES ${sql.join(rows, sql`, `)}
                        ON CONFLICT (chain_id, tx_hash, log_index) DO UPDATE SET
                            block_number = EXCLUDED.block_number,
                            block_hash = EXCLUDED.block_hash,
                            status = CASE WHEN dns_sync_events.status = 'orphaned' THEN 'pending' ELSE dns_sync_events.status END
                    `);
                }

                await PgDnsSyncStore.linkEvents(tx, chainId);

                await tx.query(sql`
                    INSERT INTO dns_sync_checkpoint (chain_id, block_number, block_hash, updated_at)
                    VALUES (${chainId}, ${checkpoint.blockNumber}, ${hexToBuffer(checkpoint.blockHash)}, NOW())
                    ON CONFLICT (chain_id) DO UPDATE SET
                        block_number = EXCLUDED.block_number,
                        block_hash = EXCLUDED.block_hash,
                        updated_at = NOW()
                `);
            });
        } catch (error) {
            console.error(`Error saving DNS sync events up to block ${checkpoint.blockNumber}:`, error);
            throw error;
        }
    }

    public async getEventBlocks(chainId: number, blockNumber: number): Promise<DnsSyncCheckpoint[]> {
        const rows = await this.db.query(sql`
            SELECT DISTINCT block_number, block_hash
            FROM dns_sync_events
            WHERE chain_id = ${chainId} AND block_number > ${blockNumber} AND status <> 'orphaned'
            ORDER BY block_number
        `);

        return rows.map(row => ({ blockNumber: row.block_number, blockHash: toHex(row.block_hash)! }));
    }

    public async rewind(
        chainId: number,
        staleBlocks: DnsSyncCheckpoint[],
        checkpoint: DnsSyncCheckpoint | null
    ): Promise<void> {
        try {
            await this.db.tx(async (tx) => {
                for (const block of staleBlocks) {
                    const blockHash = hexToBuffer(block.blockHash);

                    await tx.query(sql`
                        UPDATE dns_sync_names SET dirty = true, updated_at = NOW()
                        WHERE label_hash IN (
                            SELECT label_hash FROM dns_sync_events
                            WHERE chain_id = ${chainId}
                                AND block_number = ${block.blockNumber}
                                AND block_hash = ${blockHash}
                                AND status = 'done'
                        )
                    `);

                    await tx.query(sql`
                        UPDATE dns_sync_events SET status = 'orphaned'
                        WHERE chain_id = ${chainId}
                            AND block_number = ${block.blockNumber}
                            AND block_hash = ${blockHash}
                            AND status IN ('pending', 'failed')
                    `);
                }

                if (checkpoint) {
                    await tx.query(sql`
                        UPDATE dns_sync_checkpoint
                        SET block_number = ${checkpoint.blockNumber}, block_hash = ${hexToBuffer(checkpoint.blockHash)}, updated_at = NOW()
                        WHERE chain_id = ${chainId}
                    `);
                } else {
                    await tx.query(sql`DELETE FROM dns_sync_checkpoint WHERE chain_id = ${chainId}`);
                }
            });
        } catch (error) {
            console.error(`Error rewinding DNS sync of chain ${chainId}:`, error);
            throw error;
        }
    }

    public async upsertNames(names: DnsNameMapping[]): Promise<void> {
        await PgDnsSyncStore.insertNames(this.db, names);
    }

    public async getDirectoryNames(): Promise<{ labelHash: string, label: string }[]> {
        const rows = await this.db.query(sql`
            SELECT d.label_hash, d.label
            FROM dmd_names d
            LEFT JOIN dns_sync_names n ON n.label_hash = d.label_hash
            WHERE d.label IS NOT NULL AND (n.label_hash IS NULL OR n.label IS NULL)
        `);

        return rows.map(row => ({ labelHash: toHex(row.label_hash)!, label: row.label }));
    }

    public async linkEvents(chainId: number): Promise<number> {
        return await PgDnsSyncStore.linkEvents(this.db, chainId);
    }

    public async getUnlinkedEvents(chainId: number, maxBlock: number, limit: number): Promise<DnsSyncEventRow[]> {
        const rows = await this.db.query(sql`
            SELECT id, event_type, block_number, block_hash, log_index, label_hash, status, attempts
            FROM dns_sync_events
            WHERE chain_id = ${chainId}
                AND label_hash IS NULL
                AND block_number <= ${maxBlock}
                AND (status = 'pending' OR (status = 'failed' AND next_attempt_at <= NOW()))
            ORDER BY block_number, log_index
            LIMIT ${limit}
        `);

        return rows.map(toEventRow);
    }

    public async resetProcessing(chainId: number): Promise<number> {
        const rows = await this.db.query(sql`
            UPDATE dns_sync_events SET status = 'pending'
            WHERE chain_id = ${chainId} AND status = 'processing'
            RETURNING id
        `);

        return rows.length;
    }

    public async getNamesWithPendingOp(): Promise<DnsSyncName[]> {
        const rows = await this.db.query(sql`
            SELECT * FROM dns_sync_names WHERE pending_op IS NOT NULL ORDER BY label_hash
        `);

        return rows.map(toName);
    }

    public async getDueNames(chainId: number, maxBlock: number, limit: number): Promise<string[]> {
        // only the oldest open event of a name decides if the name is due,
        // so a later event can't run while an earlier one waits for its retry.
        const rows = await this.db.query(sql`
            SELECT head.label_hash
            FROM (
                SELECT DISTINCT ON (label_hash) label_hash, status, next_attempt_at, block_number, log_index
                FROM dns_sync_events
                WHERE chain_id = ${chainId}
                    AND label_hash IS NOT NULL
                    AND status IN ('pending', 'processing', 'failed')
                    AND block_number <= ${maxBlock}
                ORDER BY label_hash, block_number, log_index
            ) head
            WHERE head.status = 'pending' OR (head.status = 'failed' AND head.next_attempt_at <= NOW())
            ORDER BY head.block_number, head.log_index
            LIMIT ${limit}
        `);

        return rows.map(row => toHex(row.label_hash)!);
    }

    public async getBatch(chainId: number, labelHash: string, maxBlock: number): Promise<DnsSyncEventRow[]> {
        const rows = await this.db.query(sql`
            SELECT id, event_type, block_number, block_hash, log_index, label_hash, status, attempts
            FROM dns_sync_events
            WHERE chain_id = ${chainId}
                AND label_hash = ${hexToBuffer(labelHash)}
                AND status IN ('pending', 'failed')
                AND block_number <= ${maxBlock}
            ORDER BY block_number, log_index
        `);

        return rows.map(toEventRow);
    }

    public async getName(labelHash: string): Promise<DnsSyncName | null> {
        const [row] = await this.db.query(sql`
            SELECT * FROM dns_sync_names WHERE label_hash = ${hexToBuffer(labelHash)}
        `);

        return row ? toName(row) : null;
    }

    public async getIdleNames(chainId: number, dirtyOnly: boolean): Promise<DnsSyncName[]> {
        const rows = await this.db.query(sql`
            SELECT n.*
            FROM dns_sync_names n
            WHERE (${dirtyOnly} = false OR n.dirty)
                AND NOT EXISTS (
                    SELECT 1 FROM dns_sync_events e
                    WHERE e.chain_id = ${chainId}
                        AND e.label_hash = n.label_hash
                        AND e.status IN ('pending', 'processing', 'failed')
                )
            ORDER BY n.label_hash
        `);

        return rows.map(toName);
    }

    public async beginOp(labelHash: string, op: DnsPendingOp): Promise<void> {
        await this.db.tx(async (tx) => {
            await tx.query(sql`
                UPDATE dns_sync_names SET pending_op = ${JSON.stringify(op)}::jsonb, updated_at = NOW()
                WHERE label_hash = ${hexToBuffer(labelHash)}
            `);

            if (op.eventIds.length > 0) {
                await tx.query(sql`
                    UPDATE dns_sync_events SET status = 'processing' WHERE id = ANY(${op.eventIds}::int[])
                `);
            }
        });
    }

    public async completeOp(labelHash: string, eventIds: number[], applied: DnsNameState): Promise<void> {
        await this.db.tx(async (tx) => {
            await tx.query(sql`
                UPDATE dns_sync_names SET
                    applied_website_kind = ${applied.website?.kind ?? null},
                    applied_website_value = ${applied.website?.value ?? null},
                    applied_email = ${applied.email},
                    pending_op = NULL,
                    dirty = false,
                    last_synced_at = NOW(),
                    updated_at = NOW()
                WHERE label_hash = ${hexToBuffer(labelHash)}
            `);

            if (eventIds.length > 0) {
                await tx.query(sql`
                    UPDATE dns_sync_events SET status = 'done', processed_at = NOW(), last_error = NULL
                    WHERE id = ANY(${eventIds}::int[])
                `);
            }
        });
    }

    public async failOp(
        labelHash: string | null,
        eventIds: number[],
        error: string,
        delayMs: number,
        dead: boolean
    ): Promise<void> {
        await this.db.tx(async (tx) => {
            if (labelHash) {
                await tx.query(sql`
                    UPDATE dns_sync_names SET pending_op = NULL, dirty = false, updated_at = NOW()
                    WHERE label_hash = ${hexToBuffer(labelHash)}
                `);
            }

            if (eventIds.length > 0) {
                await tx.query(sql`
                    UPDATE dns_sync_events SET
                        status = ${dead ? 'dead' : 'failed'},
                        attempts = attempts + 1,
                        last_error = ${error},
                        next_attempt_at = NOW() + ${delayMs}::double precision * INTERVAL '1 millisecond'
                    WHERE id = ANY(${eventIds}::int[])
                `);
            }
        });
    }

    private static async insertNames(db: Queryable, names: DnsNameMapping[]) {
        const unique = new Map<string, DnsNameMapping>();

        for (const name of names) {
            const known = unique.get(name.labelHash);
            unique.set(name.labelHash, { ...name, label: name.label ?? known?.label ?? null });
        }

        if (unique.size == 0) {
            return;
        }

        const rows = Array.from(unique.values()).map(name => sql`(
            ${hexToBuffer(name.labelHash)},
            ${name.label},
            ${hexToBuffer(name.node)}
        )`);

        await db.query(sql`
            INSERT INTO dns_sync_names (label_hash, label, node)
            VALUES ${sql.join(rows, sql`, `)}
            ON CONFLICT (label_hash) DO UPDATE SET
                label = COALESCE(EXCLUDED.label, dns_sync_names.label),
                updated_at = NOW()
        `);
    }

    private static async linkEvents(db: Queryable, chainId: number): Promise<number> {
        const rows = await db.query(sql`
            UPDATE dns_sync_events e SET label_hash = n.label_hash
            FROM dns_sync_names n
            WHERE e.chain_id = ${chainId} AND e.label_hash IS NULL AND e.node = n.node
            RETURNING e.id
        `);

        return rows.length;
    }
}
