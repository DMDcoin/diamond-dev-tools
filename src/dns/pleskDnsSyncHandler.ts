import { isIP } from "net";

import { DnsWebsiteRecord, isValidEmail, isValidHostname, isValidName, sameWebsite } from "./dnsSyncEvents";
import { DnsSyncHandler, DnsSyncOperation } from "./dnsSyncHandler";
import { PleskCliResult, PleskClient } from "./pleskClient";


// `dns --add` exits with 2 if the record is already there.
const DNS_RECORD_EXISTS = 2;

const ALREADY_EXISTS = /already exists/i;
const NOT_FOUND = /not found|does not exist|doesn't exist|unable to find/i;

/// arguments of the plesk `dns` utility for a website record of `<label>.<zone>`.
function recordParams(label: string, record: DnsWebsiteRecord): string[] {
    switch (record.kind) {
        case 'A':
            return ['-a', checkName(label), '-ip', check(record.value, isIP(record.value) == 4, 'IPv4 address')];
        case 'AAAA':
            return ['-aaaa', checkName(label), '-ip', check(record.value, isIP(record.value) == 6, 'IPv6 address')];
        case 'CNAME':
            return ['-cname', checkName(label), '-canonical', check(record.value, isValidHostname(record.value), 'host name')];
    }
}

// values end up as arguments of plesk utilities, anything unexpected is refused before it is sent.
function check(value: string, valid: boolean, what: string): string {
    if (!valid) {
        throw new Error(`refusing to send invalid ${what} to Plesk: ${JSON.stringify(value)}`);
    }

    return value;
}

function checkName(label: string): string {
    return check(label, isValidName(label), 'name');
}

function checkEmail(email: string): string {
    return check(email, isValidEmail(email), 'email address');
}

function output(result: PleskCliResult): string {
    return `${result.stdout}\n${result.stderr}`;
}

/**
 * Publishes website records and email forwarding through the Plesk REST API.
 * Every call tolerates "already exists" and "not found", so a replayed operation does no harm.
 */
export class PleskDnsSyncHandler implements DnsSyncHandler {

    public constructor(
        public client: PleskClient
    ) { }

    public async setWebsite(op: DnsSyncOperation, record: DnsWebsiteRecord): Promise<void> {
        const previous = op.previous.website;

        if (previous && !sameWebsite(previous, record)) {
            await this.deleteRecord(op.label, previous);
        }

        const params = ['--add', this.client.settings.zone, ...recordParams(op.label, record)];
        const result = await this.client.callCli('dns', params);

        if (result.code != 0 && result.code != DNS_RECORD_EXISTS && !ALREADY_EXISTS.test(output(result))) {
            throw this.cliError('dns', params, result);
        }
    }

    public async removeWebsite(op: DnsSyncOperation): Promise<void> {
        if (op.previous.website) {
            await this.deleteRecord(op.label, op.previous.website);
        }
    }

    public async setEmailForwarding(op: DnsSyncOperation, target: string): Promise<void> {
        const address = this.mailAddress(op.label);

        // forwarding only, the account gets no mailbox.
        await this.mail(['--create', address, '-mailbox', 'false'], ALREADY_EXISTS);

        if (op.previous.email && op.previous.email != target) {
            await this.mail(['--update', address, '-forwarding-addresses', `del:${checkEmail(op.previous.email)}`], NOT_FOUND);
        }

        await this.mail(['--update', address, '-forwarding', 'true', '-forwarding-addresses', `add:${checkEmail(target)}`], ALREADY_EXISTS);
    }

    public async removeEmailForwarding(op: DnsSyncOperation): Promise<void> {
        await this.mail(['--remove', this.mailAddress(op.label)], NOT_FOUND);
    }

    public async clearOnTransfer(op: DnsSyncOperation): Promise<void> {
        await this.removeAll(op);
    }

    public async removeModeratedName(op: DnsSyncOperation): Promise<void> {
        await this.removeAll(op);
    }

    private async removeAll(op: DnsSyncOperation) {
        await this.removeWebsite(op);

        if (op.previous.email) {
            await this.removeEmailForwarding(op);
        }
    }

    private async deleteRecord(label: string, record: DnsWebsiteRecord) {
        const params = ['--del', this.client.settings.zone, ...recordParams(label, record)];
        const result = await this.client.callCli('dns', params);

        if (result.code != 0 && !NOT_FOUND.test(output(result))) {
            throw this.cliError('dns', params, result);
        }
    }

    private async mail(params: string[], tolerated: RegExp) {
        const result = await this.client.callCli('mail', params);

        if (result.code != 0 && !tolerated.test(output(result))) {
            throw this.cliError('mail', params, result);
        }
    }

    private mailAddress(label: string): string {
        return `${checkName(label)}@${this.client.settings.mailDomain}`;
    }

    private cliError(utility: string, params: string[], result: PleskCliResult): Error {
        const message = (result.stderr || result.stdout).trim();
        return new Error(`plesk ${utility} ${params.join(' ')} failed with code ${result.code}: ${message}`);
    }
}
