import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";

import createConnectionPool, { ConnectionPool, sql } from "@databases/pg";

import { DnsPendingOp, PgDnsSyncStore } from "../../db/dnsSyncStore";
import { DmdNamesModerationSource } from "../dnsModerationSource";
import { DnsSyncEvent } from "../dnsSyncEvents";
import { DnsSyncService } from "../dnsSyncService";
import {
    FakeChain,
    FakeModeration,
    RawLog,
    RecordingHandler,
    TEST_SETTINGS,
    activated,
    labelHashOf,
    nodeOf,
    registered,
    setA,
    setEmail,
    transferLogs,
    websiteA
} from "./dnsSyncFakes";
import { hexToBuffer } from "../../utils/hex";


// connection string of a postgres server, e.g. postgres://postgres:pw@127.0.0.1:55432/postgres.
// the tests run in a database of their own that is created and dropped again, nothing else is touched.
const TEST_SERVER = process.env.DNS_SYNC_TEST_DB;
const TEST_DATABASE = `dns_sync_test_${process.pid}_${Date.now()}`;

let testDb = '';

const CHAIN_ID = 777;
const BLOCK_HASH = '0x' + '01'.repeat(32);

let logCounter = 0;

function event(log: RawLog, blockNumber: number, blockHash = BLOCK_HASH): DnsSyncEvent {
    return DnsSyncEvent.fromEventData({
        ...log,
        blockNumber,
        blockHash,
        logIndex: 0,
        transactionHash: '0x' + (++logCounter).toString(16).padStart(64, '0')
    })!;
}

function mapping(label: string) {
    return { labelHash: labelHashOf(label), node: nodeOf(label), label };
}

describe('PgDnsSyncStore', { skip: !TEST_SERVER && 'DNS_SYNC_TEST_DB is not set' }, () => {
    let server: ConnectionPool;
    let pool: ConnectionPool;
    let store: PgDnsSyncStore;

    before(async () => {
        server = createConnectionPool(TEST_SERVER);
        await server.query(sql`CREATE DATABASE ${sql.ident(TEST_DATABASE)}`);

        const url = new URL(TEST_SERVER!);
        url.pathname = `/${TEST_DATABASE}`;
        testDb = url.toString();

        pool = createConnectionPool(testDb);
        await pool.query(sql.file('db/migrations/007-add-name-tables.sql'));
        await pool.query(sql.file('db/migrations/008-add-dns-sync-tables.sql'));
    });

    after(async () => {
        await pool?.dispose();

        if (server) {
            await server.query(sql`DROP DATABASE IF EXISTS ${sql.ident(TEST_DATABASE)} WITH (FORCE)`);
            await server.dispose();
        }
    });

    beforeEach(async () => {
        mock.method(console, 'log', () => { });
        mock.method(console, 'error', () => { });

        await pool.query(sql`TRUNCATE dns_sync_events, dns_sync_names, dns_sync_checkpoint, dmd_name_events, dmd_names`);
        store = new PgDnsSyncStore(pool);
    });

    afterEach(() => {
        mock.restoreAll();
    });

    it('stores a delivered log only once', async () => {
        const logs = [event(activated('alice'), 1), event(setA('alice', '1.1.1.1'), 1)];

        await store.saveChunk(CHAIN_ID, logs, [mapping('alice')], { blockNumber: 1, blockHash: BLOCK_HASH });
        await store.saveChunk(CHAIN_ID, logs, [mapping('alice')], { blockNumber: 1, blockHash: BLOCK_HASH });

        const rows = await pool.query(sql`SELECT event_type, label_hash FROM dns_sync_events ORDER BY id`);
        assert.equal(rows.length, 2);
        // the resolver event got linked to the name through its node
        assert.ok(rows.every(row => row.label_hash.equals(hexToBuffer(labelHashOf('alice')))));

        assert.deepEqual(await store.getCheckpoint(CHAIN_ID), { blockNumber: 1, blockHash: BLOCK_HASH });
    });

    it('stores nothing of a chunk if one statement fails', async () => {
        await store.saveChunk(CHAIN_ID, [], [], { blockNumber: 5, blockHash: BLOCK_HASH });

        const valid = event(activated('alice'), 6);
        const invalid = event(activated('bob'), 7);
        invalid.eventName = 'X'.repeat(50);

        // event_type is VARCHAR(40), so the insert is rejected after the names were written
        await assert.rejects(store.saveChunk(CHAIN_ID, [valid, invalid], [mapping('alice'), mapping('bob')], {
            blockNumber: 10,
            blockHash: BLOCK_HASH
        }));

        assert.deepEqual(await store.getCheckpoint(CHAIN_ID), { blockNumber: 5, blockHash: BLOCK_HASH });
        assert.equal((await pool.query(sql`SELECT * FROM dns_sync_events`)).length, 0);
        assert.equal((await pool.query(sql`SELECT * FROM dns_sync_names`)).length, 0);
    });

    it('only offers a name when its oldest open event is due', async () => {
        await store.saveChunk(CHAIN_ID, [
            event(activated('alice'), 1),
            event(activated('bob'), 2),
            event(setA('alice', '1.1.1.1'), 3)
        ], [mapping('alice'), mapping('bob')], { blockNumber: 3, blockHash: BLOCK_HASH });

        assert.deepEqual(await store.getDueNames(CHAIN_ID, 3, 10), [labelHashOf('alice'), labelHashOf('bob')]);

        const [first] = await store.getBatch(CHAIN_ID, labelHashOf('alice'), 3);
        await store.failOp(labelHashOf('alice'), [first.id], 'provider down', 60000, false);

        assert.deepEqual(await store.getDueNames(CHAIN_ID, 3, 10), [labelHashOf('bob')]);

        await pool.query(sql`UPDATE dns_sync_events SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE id = ${first.id}`);

        const batch = await store.getBatch(CHAIN_ID, labelHashOf('alice'), 3);
        assert.deepEqual(batch.map(row => [row.eventName, row.status, row.attempts]), [
            ['NameActivated', 'failed', 1],
            ['DNSRecordChanged', 'pending', 0]
        ]);
        assert.deepEqual(await store.getDueNames(CHAIN_ID, 3, 10), [labelHashOf('alice'), labelHashOf('bob')]);
    });

    it('keeps the pending operation until it is completed', async () => {
        await store.saveChunk(CHAIN_ID, [event(activated('alice'), 1)], [mapping('alice')], { blockNumber: 1, blockHash: BLOCK_HASH });
        const [row] = await store.getBatch(CHAIN_ID, labelHashOf('alice'), 1);

        const op: DnsPendingOp = {
            opId: 'op-1',
            eventIds: [row.id],
            steps: [{ action: 'setWebsite', record: websiteA('1.1.1.1') }],
            desired: { website: websiteA('1.1.1.1'), email: null }
        };

        await store.beginOp(labelHashOf('alice'), op);

        const [pending] = await store.getNamesWithPendingOp();
        assert.deepEqual(pending.pendingOp, op);
        assert.equal(await store.resetProcessing(CHAIN_ID), 1);

        await store.completeOp(labelHashOf('alice'), op.eventIds, op.desired);

        const name = await store.getName(labelHashOf('alice'));
        assert.deepEqual(name!.applied, op.desired);
        assert.equal(name!.pendingOp, null);
        assert.deepEqual(await store.getNamesWithPendingOp(), []);
        assert.deepEqual((await store.getIdleNames(CHAIN_ID, false)).map(idle => idle.label), ['alice']);
    });

    it('orphans events of replaced blocks and takes them back if they return', async () => {
        const staleHash = '0x' + '0f'.repeat(32);
        const done = event(activated('alice'), 2, staleHash);
        const open = event(setA('alice', '1.1.1.1'), 2, staleHash);

        await store.saveChunk(CHAIN_ID, [done, open], [mapping('alice')], { blockNumber: 2, blockHash: staleHash });
        const [doneRow] = await store.getBatch(CHAIN_ID, labelHashOf('alice'), 2);
        await store.completeOp(labelHashOf('alice'), [doneRow.id], { website: null, email: null });

        assert.deepEqual(await store.getEventBlocks(CHAIN_ID, 0), [{ blockNumber: 2, blockHash: staleHash }]);

        await store.rewind(CHAIN_ID, [{ blockNumber: 2, blockHash: staleHash }], { blockNumber: 1, blockHash: BLOCK_HASH });

        const statuses = await pool.query(sql`SELECT status FROM dns_sync_events ORDER BY id`);
        assert.deepEqual(statuses.map(status => status.status), ['done', 'orphaned']);
        assert.equal((await store.getName(labelHashOf('alice')))!.dirty, true);
        assert.deepEqual(await store.getCheckpoint(CHAIN_ID), { blockNumber: 1, blockHash: BLOCK_HASH });

        const returned = new DnsSyncEvent(open.eventName, 3, BLOCK_HASH, open.logIndex, open.txHash, open.contractAddress,
            open.labelHash, open.node, open.label, open.values);
        await store.saveChunk(CHAIN_ID, [returned], [], { blockNumber: 3, blockHash: BLOCK_HASH });

        const [back] = await pool.query(sql`SELECT block_number, status FROM dns_sync_events ORDER BY id DESC LIMIT 1`);
        assert.deepEqual(back, { block_number: 3, status: 'pending' });
    });

    it('lets only one instance hold the writer lock', async () => {
        const otherPool = createConnectionPool(testDb);
        const other = new PgDnsSyncStore(otherPool);

        try {
            let release!: () => void;
            const holding = new Promise<void>(resolve => release = resolve);
            let entered!: () => void;
            const inside = new Promise<void>(resolve => entered = resolve);

            const first = store.withLeaderLock(CHAIN_ID, async () => {
                entered();
                await holding;
            });

            await inside;
            assert.equal(await other.withLeaderLock(CHAIN_ID, async () => { }), false);

            release();
            assert.equal(await first, true);
            assert.equal(await other.withLeaderLock(CHAIN_ID, async () => { }), true);
        } finally {
            await otherPool.dispose();
        }
    });

    it('reads the moderation flag from dmd_names', async () => {
        await pool.query(sql`
            INSERT INTO dmd_names (label_hash, label, blocked, last_action_type, last_action_block, last_action_timestamp)
            VALUES (${hexToBuffer(labelHashOf('alice'))}, 'alice', true, 'BlockedSet', 1, 1),
                   (${hexToBuffer(labelHashOf('bob'))}, 'bob', null, 'Activated', 1, 1)
        `);

        const moderation = new DmdNamesModerationSource(pool);

        assert.equal(await moderation.isHidden(labelHashOf('alice')), true);
        assert.equal(await moderation.isHidden(labelHashOf('bob')), false);
        assert.equal(await moderation.isHidden(labelHashOf('carol')), false);
        assert.deepEqual((await store.getDirectoryNames()).map(name => name.label).sort(), ['alice', 'bob']);
    });

    it('runs the whole sync on postgres', async () => {
        const chain = new FakeChain();
        const handler = new RecordingHandler();
        const service = new DnsSyncService(chain, store, new FakeModeration(), handler, TEST_SETTINGS);

        await service.init();

        const acquired = await store.withLeaderLock(chain.chainId, async (leader) => {
            const processor = service.createProcessor(leader);
            await processor.recover();

            chain.mine([registered('alice'), activated('alice')]);
            chain.mine([setA('alice', '1.1.1.1'), setEmail('alice', 'alice@example.com')]);
            while (await service.tick(leader, processor)) { }

            chain.mine(transferLogs('alice'));
            while (await service.tick(leader, processor)) { }
        });

        assert.equal(acquired, true);
        assert.deepEqual(handler.applied.map(call => call.action), ['setWebsite', 'setEmailForwarding', 'clearOnTransfer']);

        const statuses = await pool.query(sql`SELECT DISTINCT status FROM dns_sync_events`);
        assert.deepEqual(statuses.map(status => status.status), ['done']);
    });
});
