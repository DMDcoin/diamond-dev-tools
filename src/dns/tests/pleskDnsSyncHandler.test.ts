import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { DnsNameState, EMPTY_DNS_STATE } from "../dnsSyncEvents";
import { DnsSyncOperation, createDnsSyncHandler } from "../dnsSyncHandler";
import { DnsSyncService } from "../dnsSyncService";
import { PleskCliResult, PleskClient, PleskSettings, getPleskSettings } from "../pleskClient";
import { PleskDnsSyncHandler } from "../pleskDnsSyncHandler";
import {
    FakeChain,
    FakeModeration,
    MemoryDnsSyncStore,
    TEST_SETTINGS,
    activated,
    registered,
    setA,
    setCname,
    setEmail,
    transferLogs,
    websiteA
} from "./dnsSyncFakes";


const API_KEY = 'test-api-key-0123456789';

interface PleskRequest {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: any;
}

/**
 * Local stand-in for the Plesk REST API. CLI calls answer with `cliResult`, other paths with `respond`.
 */
class FakePlesk {
    public requests = new Array<PleskRequest>();
    public cliResult: (utility: string, params: string[]) => PleskCliResult = () => ({ code: 0, stdout: '', stderr: '' });
    public respond?: (request: PleskRequest) => { status: number, body: any } | null;

    private server = http.createServer((req, res) => {
        let raw = '';
        req.on('data', chunk => raw += chunk);
        req.on('end', () => {
            const request: PleskRequest = { method: req.method!, url: req.url!, headers: req.headers, body: raw ? JSON.parse(raw) : null };
            this.requests.push(request);

            const answer = this.answer(request);

            // no answer leaves the request hanging, like an unresponsive server
            if (answer) {
                res.writeHead(answer.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(answer.body));
            }
        });
    });

    public async start(): Promise<string> {
        await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
        return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    }

    public async stop() {
        this.server.closeAllConnections();
        await new Promise(resolve => this.server.close(resolve));
    }

    public cliCalls(): string[][] {
        return this.requests
            .filter(request => request.url.startsWith('/api/v2/cli/'))
            .map(request => [request.url.split('/')[4], ...request.body.params]);
    }

    private answer(request: PleskRequest): { status: number, body: any } | null {
        if (this.respond) {
            return this.respond(request);
        }

        const cli = request.url.match(/^\/api\/v2\/cli\/([^/]+)\/call$/);
        if (cli) {
            return { status: 200, body: this.cliResult(cli[1], request.body.params) };
        }

        return { status: 404, body: { code: 0, message: 'Not found' } };
    }
}

function operation(previous: DnsNameState = EMPTY_DNS_STATE): DnsSyncOperation {
    return { opId: 'op-1', label: 'alice', labelHash: '0x01', previous };
}

describe('PleskDnsSyncHandler', () => {
    const plesk = new FakePlesk();
    let settings: PleskSettings;
    let handler: PleskDnsSyncHandler;

    before(async () => {
        const url = await plesk.start();
        settings = { url, apiKey: API_KEY, zone: 'dmd.example', mailDomain: 'mail.example', timeoutMs: 200 };
    });

    after(async () => {
        await plesk.stop();
    });

    beforeEach(() => {
        plesk.requests = [];
        plesk.cliResult = () => ({ code: 0, stdout: '', stderr: '' });
        plesk.respond = undefined;
        handler = new PleskDnsSyncHandler(new PleskClient(settings));
    });

    describe('authentication', () => {

        it('sends the API key and JSON to the CLI gateway', async () => {
            await handler.setWebsite(operation(), websiteA('192.0.2.10'));

            const [request] = plesk.requests;
            assert.equal(request.method, 'POST');
            assert.equal(request.url, '/api/v2/cli/dns/call');
            assert.equal(request.headers['x-api-key'], API_KEY);
            assert.equal(request.headers['content-type'], 'application/json');
            assert.deepEqual(request.body, { params: ['--add', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'] });
        });

        it('reports a rejected key without leaking it', async () => {
            plesk.respond = () => ({ status: 401, body: { code: 1, message: 'Authentication failed' } });

            await assert.rejects(handler.setWebsite(operation(), websiteA('192.0.2.10')), (err: Error) => {
                assert.match(err.message, /Plesk API POST \/cli\/dns\/call failed with HTTP 401: Authentication failed/);
                assert.ok(!err.message.includes(API_KEY));
                return true;
            });
        });

        it('gives up on a server that does not answer', async () => {
            plesk.respond = () => null;

            await assert.rejects(handler.removeWebsite(operation({ website: websiteA('192.0.2.10'), email: null })), (err: Error) => {
                assert.match(err.message, /Plesk API POST \/cli\/dns\/call failed: ECONNABORTED/);
                assert.ok(!err.message.includes(API_KEY));
                return true;
            });
        });

        it('does not follow redirects', async () => {
            plesk.respond = (request) => request.url == '/api/v2/server'
                ? { status: 302, body: {} }
                : { status: 200, body: {} };

            await assert.rejects(new PleskClient(settings).getServerInfo(), /failed with HTTP 302/);
            assert.equal(plesk.requests.length, 1);
        });

        it('reads server info and looks up domains by name', async () => {
            plesk.respond = (request) => request.url == '/api/v2/server'
                ? { status: 200, body: { hostname: 'plesk.example', panel_version: '18.0.70' } }
                : { status: 200, body: [{ id: 7, name: 'dmd.example' }] };

            const client = new PleskClient(settings);

            assert.equal((await client.getServerInfo()).hostname, 'plesk.example');
            assert.equal((await client.findDomain('dmd.example')).id, 7);
            assert.equal(plesk.requests[1].url, '/api/v2/domains?name=dmd.example');
        });
    });

    describe('website', () => {

        it('creates A, AAAA and CNAME records', async () => {
            await handler.setWebsite(operation(), websiteA('192.0.2.10'));
            await handler.setWebsite(operation(), { kind: 'AAAA', value: '2001:db8::1' });
            await handler.setWebsite(operation(), { kind: 'CNAME', value: 'www.example.com' });

            assert.deepEqual(plesk.cliCalls(), [
                ['dns', '--add', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'],
                ['dns', '--add', 'dmd.example', '-aaaa', 'alice', '-ip', '2001:db8::1'],
                ['dns', '--add', 'dmd.example', '-cname', 'alice', '-canonical', 'www.example.com']
            ]);
        });

        it('deletes the previous record before adding the new one', async () => {
            await handler.setWebsite(operation({ website: websiteA('192.0.2.10'), email: null }), { kind: 'CNAME', value: 'www.example.com' });

            assert.deepEqual(plesk.cliCalls(), [
                ['dns', '--del', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'],
                ['dns', '--add', 'dmd.example', '-cname', 'alice', '-canonical', 'www.example.com']
            ]);
        });

        it('accepts a replayed operation whose changes are already applied', async () => {
            plesk.cliResult = (utility, params) => params[0] == '--add'
                ? { code: 2, stdout: '', stderr: 'Record already exists' }
                : { code: 1, stdout: '', stderr: 'Unable to find the record' };

            await handler.setWebsite(operation({ website: websiteA('192.0.2.10'), email: null }), websiteA('192.0.2.20'));
            await handler.removeWebsite(operation({ website: websiteA('192.0.2.20'), email: null }));
        });

        it('refuses values that could be read as options or are not valid', async () => {
            const invalid: Array<() => Promise<void>> = [
                () => handler.setWebsite({ ...operation(), label: '-alice' }, websiteA('192.0.2.10')),
                () => handler.setWebsite(operation(), { kind: 'CNAME', value: '-canonical evil.example' }),
                () => handler.setWebsite(operation(), { kind: 'A', value: '2001:db8::1' }),
                () => handler.setEmailForwarding(operation(), 'a@b.example,c@d.example'),
                () => handler.removeEmailForwarding({ ...operation(), label: 'alice@other.example' })
            ];

            for (const call of invalid) {
                await assert.rejects(call(), /refusing to send invalid/);
            }

            assert.deepEqual(plesk.cliCalls().filter(call => call[0] == 'dns'), []);
            assert.ok(plesk.cliCalls().every(call => !call.join(' ').includes(',')));
        });

        it('fails on any other error of the dns utility', async () => {
            plesk.cliResult = () => ({ code: 1, stdout: '', stderr: 'Zone dmd.example is not managed by this server' });

            await assert.rejects(
                handler.setWebsite(operation(), websiteA('192.0.2.10')),
                /plesk dns --add dmd.example -a alice -ip 192.0.2.10 failed with code 1: Zone dmd.example is not managed/
            );
        });

        it('does nothing to remove a website that was never published', async () => {
            await handler.removeWebsite(operation());

            assert.deepEqual(plesk.cliCalls(), []);
        });
    });

    describe('email forwarding', () => {

        it('creates a forwarding-only account', async () => {
            await handler.setEmailForwarding(operation(), 'alice@example.com');

            assert.deepEqual(plesk.cliCalls(), [
                ['mail', '--create', 'alice@mail.example', '-mailbox', 'false'],
                ['mail', '--update', 'alice@mail.example', '-forwarding', 'true', '-forwarding-addresses', 'add:alice@example.com']
            ]);
        });

        it('replaces the previous forwarding address', async () => {
            plesk.cliResult = (utility, params) => params[0] == '--create'
                ? { code: 1, stdout: '', stderr: 'Mail name alice@mail.example already exists' }
                : { code: 0, stdout: '', stderr: '' };

            await handler.setEmailForwarding(operation({ website: null, email: 'old@example.com' }), 'new@example.com');

            assert.deepEqual(plesk.cliCalls(), [
                ['mail', '--create', 'alice@mail.example', '-mailbox', 'false'],
                ['mail', '--update', 'alice@mail.example', '-forwarding-addresses', 'del:old@example.com'],
                ['mail', '--update', 'alice@mail.example', '-forwarding', 'true', '-forwarding-addresses', 'add:new@example.com']
            ]);
        });

        it('removes the account and accepts that it is already gone', async () => {
            plesk.cliResult = () => ({ code: 1, stdout: '', stderr: 'Mail name alice@mail.example does not exist' });

            await handler.removeEmailForwarding(operation({ website: null, email: 'alice@example.com' }));

            assert.deepEqual(plesk.cliCalls(), [['mail', '--remove', 'alice@mail.example']]);
        });
    });

    describe('clearing', () => {
        const published = { website: websiteA('192.0.2.10'), email: 'alice@example.com' };
        const removeAll = [
            ['dns', '--del', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'],
            ['mail', '--remove', 'alice@mail.example']
        ];

        it('removes website and forwarding after a transfer', async () => {
            await handler.clearOnTransfer(operation(published));

            assert.deepEqual(plesk.cliCalls(), removeAll);
        });

        it('removes website and forwarding of a moderated name', async () => {
            await handler.removeModeratedName(operation(published));

            assert.deepEqual(plesk.cliCalls(), removeAll);
        });

        it('only removes what was published', async () => {
            await handler.clearOnTransfer(operation({ website: null, email: 'alice@example.com' }));

            assert.deepEqual(plesk.cliCalls(), [['mail', '--remove', 'alice@mail.example']]);
        });
    });

    it('is driven by the sync service from chain events', async () => {
        const chain = new FakeChain();
        const store = new MemoryDnsSyncStore(() => 0);
        const service = new DnsSyncService(chain, store, new FakeModeration(), handler, TEST_SETTINGS, () => 0);

        await service.init();
        const processor = service.createProcessor(store);

        const sync = async () => {
            while (await service.tick(store, processor)) { }
        };

        chain.mine([registered('alice'), activated('alice')]);
        chain.mine([setA('alice', '192.0.2.10'), setEmail('alice', 'alice@example.com')]);
        await sync();

        chain.mine([setCname('alice', 'www.example.com')]);
        await sync();

        chain.mine(transferLogs('alice'));
        await sync();

        assert.deepEqual(plesk.cliCalls(), [
            ['dns', '--add', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'],
            ['mail', '--create', 'alice@mail.example', '-mailbox', 'false'],
            ['mail', '--update', 'alice@mail.example', '-forwarding', 'true', '-forwarding-addresses', 'add:alice@example.com'],
            ['dns', '--del', 'dmd.example', '-a', 'alice', '-ip', '192.0.2.10'],
            ['dns', '--add', 'dmd.example', '-cname', 'alice', '-canonical', 'www.example.com'],
            ['dns', '--del', 'dmd.example', '-cname', 'alice', '-canonical', 'www.example.com'],
            ['mail', '--remove', 'alice@mail.example']
        ]);
    });
});

describe('getPleskSettings', () => {
    const env = {
        DNS_SYNC_PLESK_URL: 'https://plesk.example:8443/',
        DNS_SYNC_PLESK_API_KEY: API_KEY,
        DNS_SYNC_PLESK_ZONE: 'dmd.example'
    };

    it('lists the missing variables without printing values', () => {
        assert.throws(
            () => getPleskSettings({ DNS_SYNC_PLESK_API_KEY: API_KEY }),
            /missing: DNS_SYNC_PLESK_URL, DNS_SYNC_PLESK_ZONE$/
        );
    });

    it('uses the zone as mail domain unless one is set', () => {
        assert.deepEqual(getPleskSettings(env), {
            url: 'https://plesk.example:8443',
            apiKey: API_KEY,
            zone: 'dmd.example',
            mailDomain: 'dmd.example',
            timeoutMs: 30000,
            caFile: undefined
        });

        assert.equal(getPleskSettings({ ...env, DNS_SYNC_PLESK_MAIL_DOMAIN: 'mail.example' }).mailDomain, 'mail.example');
    });

    it('rejects a timeout that is not a positive number', () => {
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_TIMEOUT_MS: 'soon' }), /DNS_SYNC_PLESK_TIMEOUT_MS is not a positive number/);
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_TIMEOUT_MS: '0' }), /DNS_SYNC_PLESK_TIMEOUT_MS is not a positive number/);
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_TIMEOUT_MS: '30s' }), /DNS_SYNC_PLESK_TIMEOUT_MS is not a positive number/);
    });

    it('only accepts valid domains for zone and mail domain', () => {
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_ZONE: '-a.example' }), /DNS_SYNC_PLESK_ZONE is not a valid domain/);
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_MAIL_DOMAIN: 'mail example' }), /DNS_SYNC_PLESK_MAIL_DOMAIN is not a valid domain/);

        assert.equal(getPleskSettings({ ...env, DNS_SYNC_PLESK_ZONE: 'DMD.Example' }).zone, 'dmd.example');
    });

    it('only sends the API key over https, or to this machine', () => {
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_URL: 'http://plesk.example:8880' }), /must use https/);
        assert.throws(() => getPleskSettings({ ...env, DNS_SYNC_PLESK_URL: 'plesk.example' }), /not a valid URL/);

        assert.equal(getPleskSettings({ ...env, DNS_SYNC_PLESK_URL: 'http://127.0.0.1:8880' }).url, 'http://127.0.0.1:8880');
    });
});

describe('createDnsSyncHandler with plesk', () => {
    const names = ['DNS_SYNC_PLESK_URL', 'DNS_SYNC_PLESK_API_KEY', 'DNS_SYNC_PLESK_ZONE'];
    const saved = new Map<string, string | undefined>();

    beforeEach(() => {
        for (const name of names) {
            saved.set(name, process.env[name]);
        }
    });

    afterEach(() => {
        for (const name of names) {
            if (saved.get(name) === undefined) {
                delete process.env[name];
            } else {
                process.env[name] = saved.get(name);
            }
        }
    });

    it('builds the Plesk handler from the environment', () => {
        process.env.DNS_SYNC_PLESK_URL = 'https://plesk.example:8443';
        process.env.DNS_SYNC_PLESK_API_KEY = API_KEY;
        process.env.DNS_SYNC_PLESK_ZONE = 'dmd.example';

        assert.ok(createDnsSyncHandler('plesk') instanceof PleskDnsSyncHandler);
    });

    it('refuses to start without configuration', () => {
        for (const name of names) {
            delete process.env[name];
        }

        assert.throws(() => createDnsSyncHandler('plesk'), /Plesk DNS sync handler is not configured/);
    });
});
