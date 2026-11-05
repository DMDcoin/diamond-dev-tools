import assert from "node:assert/strict";
import { describe, it } from "node:test";

import Web3 from "web3";

import { ContractDnsSyncChain } from "../dnsSyncChain";
import {
    DMD_NODE,
    DnsRecordKind,
    DnsSyncEvent,
    EMPTY_DNS_STATE,
    decodeEmailTarget,
    decodeWebsiteRecord,
    dnsNode
} from "../dnsSyncEvents";
import { LoggingDnsSyncHandler, createDnsSyncHandler } from "../dnsSyncHandler";
import { planDnsSyncSteps } from "../dnsSyncProcessor";
import {
    BUYER,
    NAMES_ADDRESS,
    OWNER,
    RawLog,
    activated,
    asciiBytes,
    blockedSet,
    clearDns,
    clearEmail,
    deactivated,
    ipv4Bytes,
    labelHashOf,
    moderated,
    nodeOf,
    registered,
    setA,
    setAAAA,
    setCname,
    setEmail,
    transferred,
    websiteA
} from "./dnsSyncFakes";


const BLOCK_HASH = '0x' + 'ab'.repeat(32);
const TX_HASH = '0x' + 'cd'.repeat(32);

function decode(log: RawLog): DnsSyncEvent {
    const event = DnsSyncEvent.fromEventData({
        ...log,
        blockNumber: 12,
        blockHash: BLOCK_HASH,
        logIndex: 3,
        transactionHash: TX_HASH
    });

    assert.ok(event);
    return event;
}

describe('dnsNode', () => {
    it('matches the namehash of the dmd TLD', () => {
        const dmdLabelHash = Web3.utils.keccak256('dmd');
        const expected = Web3.utils.keccak256('0x' + '00'.repeat(32) + dmdLabelHash.slice(2));

        assert.equal(DMD_NODE, expected);
    });

    it('hashes the label hash under the dmd node', () => {
        const labelHash = labelHashOf('alice');
        const expected = Web3.utils.keccak256(DMD_NODE + labelHash.slice(2));

        assert.equal(dnsNode(labelHash), expected);
    });
});

describe('decodeWebsiteRecord', () => {
    it('decodes IPv4 as A record', () => {
        assert.deepEqual(decodeWebsiteRecord(DnsRecordKind.IPv4, ipv4Bytes('192.0.2.10')), websiteA('192.0.2.10'));
    });

    it('decodes IPv6 as AAAA record in compressed form', () => {
        const bytes = '0x20010db8000000000000000000000001';
        assert.deepEqual(decodeWebsiteRecord(DnsRecordKind.IPv6, bytes), { kind: 'AAAA', value: '2001:db8::1' });
    });

    it('does not compress a single zero group', () => {
        const bytes = '0x20010db8000100000001000100010001';
        assert.equal(decodeWebsiteRecord(DnsRecordKind.IPv6, bytes)?.value, '2001:db8:1:0:1:1:1:1');
    });

    it('decodes CNAME as ascii host name', () => {
        assert.deepEqual(
            decodeWebsiteRecord(DnsRecordKind.Cname, asciiBytes('www.example.com')),
            { kind: 'CNAME', value: 'www.example.com' }
        );
    });

    it('returns null for a cleared record or a value that does not fit the kind', () => {
        assert.equal(decodeWebsiteRecord(DnsRecordKind.None, null), null);
        assert.equal(decodeWebsiteRecord(DnsRecordKind.IPv4, '0x0102'), null);
        assert.equal(decodeWebsiteRecord(DnsRecordKind.Cname, null), null);
    });

    it('decodes email targets', () => {
        assert.equal(decodeEmailTarget(asciiBytes('alice@example.com')), 'alice@example.com');
        assert.equal(decodeEmailTarget(null), null);
        assert.equal(decodeEmailTarget('0x'), null);
    });

    it('ignores values the contract would not accept', () => {
        for (const host of ['-x.example.com', 'localhost', 'www.example.com.', 'a b.example.com', 'WWW.example.com', 'x.123']) {
            assert.equal(decodeWebsiteRecord(DnsRecordKind.Cname, asciiBytes(host)), null, host);
        }

        for (const email of ['alice', '.alice@example.com', 'a..b@example.com', 'a@b.example,c@d.example', 'a@-x.example']) {
            assert.equal(decodeEmailTarget(asciiBytes(email)), null, email);
        }

        // 0xe1 would turn into "a" if the high bit was dropped
        assert.equal(decodeEmailTarget('0xe1' + asciiBytes('@example.com').slice(2)), null);
        assert.equal(decodeEmailTarget(asciiBytes('a.b+tag_1-x@sub.example.com')), 'a.b+tag_1-x@sub.example.com');
    });
});

describe('DnsSyncEvent.fromEventData', () => {
    it('keeps position and transaction of the log', () => {
        const event = decode(activated('alice'));

        assert.equal(event.blockNumber, 12);
        assert.equal(event.blockHash, BLOCK_HASH);
        assert.equal(event.logIndex, 3);
        assert.equal(event.txHash, TX_HASH);
    });

    it('decodes resolver events by node only', () => {
        for (const log of [setA('alice', '1.2.3.4'), setAAAA('alice', '0x' + '00'.repeat(15) + '01'),
            setCname('alice', 'a.example.com'), clearDns('alice')]) {
            const event = decode(log);

            assert.equal(event.eventName, 'DNSRecordChanged');
            assert.equal(event.node, nodeOf('alice'));
            assert.equal(event.labelHash, null);
            assert.ok(event.isResolverEvent());
        }

        assert.deepEqual(decode(setA('alice', '1.2.3.4')).values, { kind: DnsRecordKind.IPv4, value: ipv4Bytes('1.2.3.4') });
        assert.deepEqual(decode(clearDns('alice')).values, { kind: DnsRecordKind.None, value: null });
        assert.deepEqual(decode(setEmail('alice', 'a@b.io')).values, { target: asciiBytes('a@b.io') });
        assert.deepEqual(decode(clearEmail('alice')).values, { target: null });
    });

    it('decodes registrar events with label hash, node and label', () => {
        for (const log of [registered('alice'), activated('alice'), deactivated('alice'), blockedSet('alice', true)]) {
            const event = decode(log);

            assert.equal(event.labelHash, labelHashOf('alice'));
            assert.equal(event.node, nodeOf('alice'));
            assert.equal(event.label, 'alice');
            assert.ok(!event.isResolverEvent());
        }

        assert.deepEqual(decode(blockedSet('alice', false)).values, { blocked: false });
        assert.deepEqual(decode(activated('alice')).values, { owner: OWNER });
    });

    it('decodes NameModerated without a label', () => {
        const event = decode(moderated('alice'));

        assert.equal(event.labelHash, labelHashOf('alice'));
        assert.equal(event.label, null);
        assert.deepEqual(event.values, { owner: OWNER, reason: 'spam', note: 'reported' });
    });

    it('turns the token id of a transfer into the label hash', () => {
        const event = decode(transferred('alice'));

        assert.equal(event.eventName, 'Transfer');
        assert.equal(event.contractAddress, NAMES_ADDRESS);
        assert.equal(event.labelHash, labelHashOf('alice'));
        assert.equal(event.node, nodeOf('alice'));
        assert.deepEqual(event.values, { from: OWNER, to: BUYER });
    });

    it('ignores other events', () => {
        const event = DnsSyncEvent.fromEventData({
            event: 'AddrChanged',
            address: NAMES_ADDRESS,
            blockNumber: 1,
            blockHash: BLOCK_HASH,
            logIndex: 0,
            transactionHash: TX_HASH,
            returnValues: {}
        });

        assert.equal(event, null);
    });
});

describe('planDnsSyncSteps', () => {
    const published = { website: websiteA('1.2.3.4'), email: 'a@b.io' };

    it('does nothing if the state is already published', () => {
        assert.deepEqual(planDnsSyncSteps(published, published, 'update'), []);
        assert.deepEqual(planDnsSyncSteps(EMPTY_DNS_STATE, EMPTY_DNS_STATE, 'transfer'), []);
    });

    it('sets and removes single fields', () => {
        assert.deepEqual(planDnsSyncSteps(EMPTY_DNS_STATE, published, 'update'), [
            { action: 'setWebsite', record: websiteA('1.2.3.4') },
            { action: 'setEmailForwarding', target: 'a@b.io' }
        ]);

        assert.deepEqual(planDnsSyncSteps(published, { website: null, email: 'a@b.io' }, 'update'), [
            { action: 'removeWebsite' }
        ]);

        assert.deepEqual(planDnsSyncSteps(published, EMPTY_DNS_STATE, 'update'), [
            { action: 'removeWebsite' },
            { action: 'removeEmailForwarding' }
        ]);
    });

    it('replaces an A record with a CNAME', () => {
        const cname = { website: { kind: 'CNAME' as const, value: 'x.example.com' }, email: 'a@b.io' };

        assert.deepEqual(planDnsSyncSteps(published, cname, 'update'), [
            { action: 'setWebsite', record: cname.website }
        ]);
    });

    it('clears everything at once after a transfer or moderation', () => {
        assert.deepEqual(planDnsSyncSteps(published, EMPTY_DNS_STATE, 'transfer'), [{ action: 'clearOnTransfer' }]);
        assert.deepEqual(planDnsSyncSteps(published, EMPTY_DNS_STATE, 'moderation'), [{ action: 'removeModeratedName' }]);
    });
});

describe('createDnsSyncHandler', () => {
    it('uses the logging handler by default', () => {
        assert.ok(createDnsSyncHandler() instanceof LoggingDnsSyncHandler);
        assert.ok(createDnsSyncHandler('logging') instanceof LoggingDnsSyncHandler);
    });

    it('rejects unknown handlers', () => {
        assert.throws(() => createDnsSyncHandler('route53'), /Unknown DNS sync handler/);
    });
});

describe('ContractDnsSyncChain', () => {
    it('fails RPC calls that do not answer in time', async () => {
        const hanging = new Promise<never>(() => { });
        const contractManager: any = {
            web3: { eth: { getBlockNumber: () => hanging } },
            getDnsSyncEvents: () => hanging
        };

        const chain = new ContractDnsSyncChain(contractManager, 20);

        await assert.rejects(chain.getBlockNumber(), /timed out after 20ms/);
        await assert.rejects(chain.getEvents(1, 10), /getDnsSyncEvents\(1, 10\) timed out/);
    });
});
