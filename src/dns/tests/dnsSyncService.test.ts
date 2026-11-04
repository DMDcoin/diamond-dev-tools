import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { DnsSyncSettings } from "../dnsSyncProcessor";
import {
    BUYER,
    DnsSyncHarness,
    activated,
    blockedSet,
    clearDns,
    clearEmail,
    deactivated,
    labelHashOf,
    moderated,
    registered,
    setA,
    setAAAA,
    setCname,
    setEmail,
    transferLogs,
    websiteA
} from "./dnsSyncFakes";


async function started(settings: Partial<DnsSyncSettings> = {}): Promise<DnsSyncHarness> {
    const harness = new DnsSyncHarness(settings);
    await harness.start();
    return harness;
}

function actions(harness: DnsSyncHarness, label: string): string[] {
    return harness.handler.appliedFor(label).map(call => call.detail ? `${call.action} ${call.detail}` : call.action);
}

function statuses(harness: DnsSyncHarness, label: string): string[] {
    return harness.store.eventsOf(label).map(event => event.status);
}

async function publishAlice(harness: DnsSyncHarness) {
    harness.chain.mine([registered('alice'), activated('alice')]);
    harness.chain.mine([setA('alice', '1.1.1.1'), setEmail('alice', 'alice@example.com')]);
    await harness.sync();

    assert.deepEqual(harness.handler.publishedFor('alice'), { website: websiteA('1.1.1.1'), email: 'alice@example.com' });
}

describe('DnsSyncService', () => {

    beforeEach(() => {
        mock.method(console, 'log', () => { });
        mock.method(console, 'error', () => { });
    });

    afterEach(() => {
        mock.restoreAll();
    });

    describe('publishing', () => {

        it('publishes website and email forwarding of an active name', async () => {
            const harness = await started();

            await publishAlice(harness);

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1', 'setEmailForwarding alice@example.com']);
            assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
        });

        it('follows every change of the website and email forwarding', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            await harness.sync();

            const changes = [
                setA('alice', '1.1.1.1'),
                setCname('alice', 'www.example.com'),
                setAAAA('alice', '0x20010db8000000000000000000000001'),
                setEmail('alice', 'alice@example.com'),
                setEmail('alice', 'other@example.com'),
                clearDns('alice'),
                clearEmail('alice')
            ];

            for (const change of changes) {
                harness.chain.mine([change]);
                await harness.sync();
            }

            assert.deepEqual(actions(harness, 'alice'), [
                'setWebsite A 1.1.1.1',
                'setWebsite CNAME www.example.com',
                'setWebsite AAAA 2001:db8::1',
                'setEmailForwarding alice@example.com',
                'setEmailForwarding other@example.com',
                'removeWebsite',
                'removeEmailForwarding'
            ]);
        });

        it('does not publish records of a name that is not active', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.sync();

            assert.deepEqual(harness.handler.deliveries, []);
            assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
        });
    });

    describe('exactly once', () => {

        it('acts once on logs that are delivered more than once', async () => {
            const harness = await started();
            harness.chain.duplicate = true;

            await publishAlice(harness);

            // read the same range again from scratch
            const genesisHash = (await harness.chain.getBlockHash(0))!;
            harness.store.state.checkpoints.set(harness.chain.chainId, { blockNumber: 0, blockHash: genesisHash });
            await harness.sync();

            assert.equal(harness.store.eventsOf('alice').length, 4);
            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1', 'setEmailForwarding alice@example.com']);
        });

        const crashPoints: Array<[string, string]> = [
            ['before the events are stored', 'saveChunk'],
            ['after the events are stored', 'beginOp'],
            ['after the handler was called', 'completeOp']
        ];

        for (const [stage, method] of crashPoints) {
            it(`neither repeats nor misses the action after a crash ${stage}`, async () => {
                const harness = await started();

                harness.store.crashOn(method);
                harness.chain.mine([registered('alice'), activated('alice')]);
                harness.chain.mine([setA('alice', '1.1.1.1'), setEmail('alice', 'alice@example.com')]);
                await harness.syncUntilCrash();
                assert.ok(harness.store.down);

                await harness.start();
                await harness.sync();

                assert.deepEqual(harness.handler.publishedFor('alice'), { website: websiteA('1.1.1.1'), email: 'alice@example.com' });
                assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1', 'setEmailForwarding alice@example.com']);
                assert.equal(new Set(harness.handler.deliveries.map(call => call.opId)).size, 1);
                assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
            });
        }

        it('replays an operation that was interrupted while the handler ran', async () => {
            const harness = await started();

            harness.handler.beforeCall = () => {
                harness.handler.beforeCall = undefined;
                harness.store.kill();
                throw new Error('process killed');
            };

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.syncUntilCrash();

            assert.equal(harness.handler.applied.length, 0);
            const interruptedOp = harness.handler.deliveries[0].opId;

            await harness.start();
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
            assert.equal(harness.handler.applied[0].opId, interruptedOp);
            assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
        });
    });

    describe('rpc failures', () => {

        it('catches up without gaps after the node was unreachable', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            await harness.sync();

            harness.chain.fail('getBlockNumber', 2);
            harness.chain.mineEmpty(4);
            harness.chain.mine([registered('bob'), activated('bob')]);
            harness.chain.mineEmpty(6);
            harness.chain.mine([setA('bob', '5.5.5.5')]);

            for (let i = 0; i < 3; i++) {
                await harness.sync();
            }

            assertContiguous(harness.chain.requestedRanges, harness.chain.head);
            assert.deepEqual(harness.handler.publishedFor('bob').website, websiteA('5.5.5.5'));
        });

        it('shrinks the block range when fetching logs fails and grows it again', async () => {
            const harness = await started();

            harness.chain.mineEmpty(2);
            harness.chain.mine([registered('bob'), activated('bob')]);
            harness.chain.mineEmpty(14);
            harness.chain.mine([setA('bob', '5.5.5.5')]);
            harness.chain.mineEmpty(2);

            harness.chain.fail('getEvents', 2);

            for (let i = 0; i < 3; i++) {
                await harness.sync();
            }

            const ranges = harness.chain.requestedRanges;
            assert.deepEqual(ranges[0], [1, 1]);
            assert.deepEqual(ranges[ranges.length - 2], [13, 17]);
            assertContiguous(ranges, harness.chain.head);
            assert.deepEqual(harness.handler.publishedFor('bob').website, websiteA('5.5.5.5'));
        });

        it('retries a name when reading its state fails', async () => {
            const harness = await started();

            harness.chain.fail('getNameState', 1);
            harness.chain.mine([registered('alice'), activated('alice'), setA('alice', '1.1.1.1')]);
            await harness.sync();

            assert.deepEqual(statuses(harness, 'alice'), ['failed', 'failed', 'failed']);

            harness.advance(1000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
        });
    });

    describe('reorgs', () => {

        it('does not act on events that a reorg removed', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            await harness.sync();

            harness.store.crashOn('beginOp');
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.syncUntilCrash();

            harness.chain.reorg(2);
            harness.chain.mine([setA('alice', '2.2.2.2')]);

            await harness.start();
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 2.2.2.2']);
            assert.deepEqual(statuses(harness, 'alice'), ['done', 'done', 'orphaned', 'done']);
        });

        it('re-syncs a name whose processed events were removed by a reorg', async () => {
            const harness = await started();

            await publishAlice(harness);

            harness.chain.reorg(2);
            harness.chain.setState('alice', { website: null, email: null });
            harness.chain.mineEmpty(1);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['removeWebsite', 'removeEmailForwarding']);
            assert.equal(harness.store.state.names.get(labelHashOf('alice'))!.dirty, false);
        });

        it('reads a block range again if it was replaced while its logs were fetched', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            await harness.sync();

            harness.chain.mine([setA('alice', '1.1.1.1')]);
            harness.chain.afterEvents = () => {
                harness.chain.afterEvents = undefined;
                harness.chain.reorg(2);
                harness.chain.mine([setA('alice', '2.2.2.2')]);
            };

            await harness.sync();
            assert.equal(harness.store.state.checkpoints.get(harness.chain.chainId)!.blockNumber, 1);

            await harness.sync();

            const canonicalHash = await harness.chain.getBlockHash(2);
            const blockTwo = harness.store.eventsOf('alice').filter(event => event.blockNumber == 2);
            assert.equal(blockTwo.length, 1);
            assert.equal(blockTwo[0].blockHash, canonicalHash);
            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 2.2.2.2']);
        });

        it('processes a transaction that came back in a different block', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            await harness.sync();

            harness.store.crashOn('beginOp');
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.syncUntilCrash();

            const dropped = harness.chain.reorg(2);
            harness.chain.mineEmpty(1);
            harness.chain.reinclude(dropped);

            await harness.start();
            await harness.sync();

            const events = harness.store.eventsOf('alice');
            assert.equal(events.length, 3);
            assert.equal(events[2].blockNumber, 3);
            assert.ok(events.every(event => event.status == 'done'));
            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
        });
    });

    describe('retries', () => {

        it('retries a failing handler with growing delays', async () => {
            const harness = await started();
            harness.handler.failNext = 2;

            harness.chain.mine([registered('alice'), activated('alice'), setA('alice', '1.1.1.1')]);
            await harness.sync();

            const firstDelay = harness.store.eventsOf('alice')[0].nextAttemptAt! - harness.now;
            assert.ok(firstDelay >= 100 && firstDelay < 200, `first delay ${firstDelay}`);

            await harness.sync();
            assert.equal(harness.handler.deliveries.length, 1);

            harness.advance(firstDelay);
            await harness.sync();

            const secondDelay = harness.store.eventsOf('alice')[0].nextAttemptAt! - harness.now;
            assert.ok(secondDelay >= 200 && secondDelay < 400, `second delay ${secondDelay}`);

            harness.advance(secondDelay);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
            assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
        });

        it('gives up after the last attempt and repairs the name in the next reconciliation', async () => {
            const harness = await started();
            harness.handler.failNext = 3;

            harness.chain.mine([registered('alice'), activated('alice'), setA('alice', '1.1.1.1')]);

            for (let i = 0; i < 3; i++) {
                await harness.sync();
                harness.advance(1000);
            }

            assert.deepEqual(statuses(harness, 'alice'), ['dead', 'dead', 'dead']);
            assert.deepEqual(harness.handler.applied, []);

            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
        });

        it('keeps later events of a name behind an event that waits for its retry', async () => {
            const harness = await started();

            let aliceFailures = 1;
            harness.handler.beforeCall = (call) => {
                if (call.label == 'alice' && aliceFailures-- > 0) {
                    throw new Error('DNS provider unavailable');
                }
            };

            harness.chain.mine([registered('alice'), activated('alice'), registered('bob'), activated('bob')]);
            harness.chain.mine([setA('alice', '1.1.1.1'), setA('bob', '5.5.5.5')]);
            await harness.sync();

            harness.chain.mine([setA('alice', '2.2.2.2')]);
            await harness.sync();

            assert.deepEqual(harness.handler.publishedFor('bob').website, websiteA('5.5.5.5'));
            assert.deepEqual(statuses(harness, 'alice'), ['failed', 'failed', 'failed', 'pending']);
            assert.deepEqual(actions(harness, 'alice'), []);

            harness.advance(1000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 2.2.2.2']);
            assert.ok(statuses(harness, 'alice').every(status => status == 'done'));
        });
    });

    describe('transfers and clears', () => {

        it('clears all records when the name is transferred', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.mine(transferLogs('alice'), '0x' + 'ee'.repeat(32));
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['clearOnTransfer']);
            assert.deepEqual(harness.handler.publishedFor('alice'), { website: null, email: null });
        });

        it('publishes the records of the new owner after a transfer', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.mine(transferLogs('alice'));
            harness.chain.mine([activated('alice', BUYER)]);
            harness.chain.mine([setA('alice', '9.9.9.9')]);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['setWebsite A 9.9.9.9', 'removeEmailForwarding']);
        });

        it('handles a set and a clear in the same block', async () => {
            const harness = await started();

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1'), clearDns('alice')]);
            await harness.sync();

            assert.deepEqual(harness.handler.deliveries, []);

            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.sync();
            harness.chain.mine([setA('alice', '2.2.2.2'), clearDns('alice')]);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1', 'removeWebsite']);
        });

        it('ends in the right state when logs arrive out of order', async () => {
            const harness = await started({ chunkSize: 100 });
            harness.chain.shuffle = true;

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1'), setEmail('alice', 'alice@example.com')]);
            harness.chain.mine([setCname('alice', 'www.example.com')]);
            harness.chain.mine([clearEmail('alice'), setA('alice', '3.3.3.3')]);
            await harness.sync();

            assert.deepEqual(harness.handler.publishedFor('alice'), { website: websiteA('3.3.3.3'), email: null });
            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 3.3.3.3']);
        });
    });

    describe('reconciliation', () => {

        it('repairs drift after a lost event', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.setState('alice', { website: websiteA('9.9.9.9') });
            await harness.sync();
            assert.equal(harness.handler.applied.length, 2);

            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['setWebsite A 9.9.9.9']);
        });

        it('unpublishes a name that expired', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.setState('alice', { expired: true });
            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['removeWebsite', 'removeEmailForwarding']);
        });

        it('finds names for resolver events in the dmd_names directory', async () => {
            const harness = await started({ startBlock: 2 });
            harness.store.directory.set(labelHashOf('alice'), { label: 'alice', blocked: false });

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice'), ['setWebsite A 1.1.1.1']);
        });

        it('ignores directory entries whose label does not belong to the name', async () => {
            const harness = await started({ startBlock: 2 });
            harness.store.directory.set(labelHashOf('alice'), { label: 'mallory', blocked: false });

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1')]);
            await harness.sync();

            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(harness.handler.deliveries, []);
            assert.equal(harness.store.state.names.get(labelHashOf('alice')), undefined);
        });

        it('gives up on resolver events of unknown names', async () => {
            const harness = await started({ startBlock: 2 });

            harness.chain.mine([registered('ghost'), activated('ghost')]);
            harness.chain.mine([setA('ghost', '1.1.1.1')]);

            for (let i = 0; i < 3; i++) {
                await harness.sync();
                harness.advance(1000);
            }

            assert.deepEqual(harness.store.state.events.map(event => event.status), ['dead']);
            assert.deepEqual(harness.handler.deliveries, []);
        });
    });

    describe('moderation', () => {

        it('never publishes a hidden name', async () => {
            const harness = await started();
            harness.moderation.hide('alice');

            harness.chain.mine([registered('alice'), activated('alice')]);
            harness.chain.mine([setA('alice', '1.1.1.1'), setEmail('alice', 'alice@example.com')]);
            await harness.sync();

            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(harness.handler.deliveries, []);
        });

        it('removes the records of a name that gets hidden', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.moderation.hide('alice');
            harness.advance(60000);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['removeModeratedName']);
            assert.deepEqual(harness.handler.publishedFor('alice'), { website: null, email: null });
        });

        it('removes the records of a name blocked on chain and restores them when unblocked', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.mine([blockedSet('alice', true)]);
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['removeModeratedName']);

            harness.chain.mine([blockedSet('alice', false)]);
            await harness.sync();

            assert.deepEqual(harness.handler.publishedFor('alice'), { website: websiteA('1.1.1.1'), email: 'alice@example.com' });
        });

        it('removes the records of a name moderated by the DAO', async () => {
            const harness = await started();
            await publishAlice(harness);

            harness.chain.mine([
                clearDns('alice'),
                clearEmail('alice'),
                deactivated('alice'),
                blockedSet('alice', true),
                moderated('alice')
            ], '0x' + 'dd'.repeat(32));
            await harness.sync();

            assert.deepEqual(actions(harness, 'alice').slice(2), ['removeModeratedName']);
        });
    });
});

function assertContiguous(ranges: Array<[number, number]>, head: number) {
    let next = 1;

    for (const [from, to] of ranges) {
        assert.equal(from, next, `range ${from}-${to} should start at ${next}`);
        next = to + 1;
    }

    assert.equal(next, head + 1);
}
