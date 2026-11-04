import Web3 from "web3";

import { tokenIdToLabelHash, truncate0x } from "../utils/hex";


/// namehash of the `dmd` TLD, see NameUtils.DMD_NODE in diamond-contracts-registry.
export const DMD_NODE = '0x9904bf4b5751e3b6a8b75d14c49424160de1a8fa8a90fd5c9fccdeac0503e612';

/// DNSRecordKind enum of the DMDResolver.
export enum DnsRecordKind {
    None = 0,
    IPv4 = 1,
    IPv6 = 2,
    Cname = 3
}

export const REGISTRAR_EVENTS = [
    'NameRegistered',
    'NameActivated',
    'NameDeactivated',
    'NameModerated',
    'NameBlockedSet'
];

export const RESOLVER_EVENTS = [
    'DNSRecordChanged',
    'EmailForwardingTargetChanged'
];

export const NAMES_EVENTS = [
    'Transfer'
];

export interface DnsWebsiteRecord {
    kind: 'A' | 'AAAA' | 'CNAME';
    value: string;
}

export interface DnsNameState {
    website: DnsWebsiteRecord | null;
    email: string | null;
}

export const EMPTY_DNS_STATE: DnsNameState = { website: null, email: null };

/// Current on-chain state of a name, as far as DNS publishing is concerned.
export interface DnsChainNameState {
    active: boolean;
    expired: boolean;
    blocked: boolean;
    website: DnsWebsiteRecord | null;
    email: string | null;
}

export class DnsSyncEvent {
    public constructor(
        public eventName: string,
        public blockNumber: number,
        public blockHash: string,
        public logIndex: number,
        public txHash: string,
        public contractAddress: string,
        public labelHash: string | null,
        public node: string | null,
        public label: string | null,
        public values: { [key: string]: string | number | boolean | null }
    ) { }

    public static fromEventData(event: any): DnsSyncEvent | null {
        const values = event.returnValues;

        let labelHash: string | null = null;
        let label: string | null = null;
        let eventValues: { [key: string]: string | number | boolean | null } = {};

        switch (event.event) {
            case 'DNSRecordChanged':
                eventValues = { kind: Number(values.kind), value: values.value ?? null };
                break;
            case 'EmailForwardingTargetChanged':
                eventValues = { target: values.target ?? null };
                break;
            case 'NameRegistered':
                labelHash = values.labelHash;
                label = values.name;
                eventValues = { owner: values.node, expiration: values.expiration };
                break;
            case 'NameActivated':
            case 'NameDeactivated':
                labelHash = values.labelHash;
                label = values.name;
                eventValues = { owner: values.owner };
                break;
            case 'NameModerated':
                labelHash = values.labelHash;
                eventValues = { owner: values.owmer, reason: values.reason, note: values.note };
                break;
            case 'NameBlockedSet':
                labelHash = values.labelHash;
                label = values.name;
                eventValues = { blocked: Boolean(values.blocked) };
                break;
            case 'Transfer':
                labelHash = tokenIdToLabelHash(values.tokenId);
                eventValues = { from: values.from, to: values.to };
                break;
            default:
                return null;
        }

        const node = labelHash ? dnsNode(labelHash) : values.node;

        return new DnsSyncEvent(
            event.event,
            Number(event.blockNumber),
            event.blockHash.toLowerCase(),
            Number(event.logIndex),
            event.transactionHash.toLowerCase(),
            event.address.toLowerCase(),
            labelHash ? labelHash.toLowerCase() : null,
            node ? node.toLowerCase() : null,
            label,
            eventValues
        );
    }

    public isResolverEvent(): boolean {
        return RESOLVER_EVENTS.includes(this.eventName);
    }
}

/**
 * keccak256 of the label, like NameUtils.labelHash.
 */
export function hashLabel(label: string): string {
    return Web3.utils.soliditySha3({ type: 'string', value: label })!.toLowerCase();
}

/**
 * namehash of `<label>.dmd` for a label hash.
 */
export function dnsNode(labelHash: string): string {
    return Web3.utils.soliditySha3(
        { type: 'bytes32', value: DMD_NODE },
        { type: 'bytes32', value: labelHash }
    )!.toLowerCase();
}

// same rules as the registrar controller and DNSUtils of diamond-contracts-registry.
const NAME = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])$/;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_LOCAL_PART = /^[a-z0-9_+-]([a-z0-9._+-]{0,62}[a-z0-9_+-])?$/;

export function isValidName(label: string): boolean {
    return NAME.test(label) && !label.includes('--');
}

export function isValidHostname(host: string): boolean {
    if (host.length == 0 || host.length > 253) {
        return false;
    }

    const labels = host.split('.');

    return labels.length >= 2
        && labels.every(label => HOST_LABEL.test(label))
        && /^[a-z]/.test(labels[labels.length - 1]);
}

export function isValidEmail(email: string): boolean {
    const at = email.indexOf('@');

    if (email.length > 254 || at < 0) {
        return false;
    }

    const localPart = email.slice(0, at);

    return EMAIL_LOCAL_PART.test(localPart) && !localPart.includes('..') && isValidHostname(email.slice(at + 1));
}

/**
 * Decodes the record stored in the resolver. Values that the contract would not accept are ignored,
 * they never reach the DNS provider.
 */
export function decodeWebsiteRecord(kind: number, value: string | null): DnsWebsiteRecord | null {
    const bytes = Buffer.from(truncate0x(value ?? ''), 'hex');

    switch (kind) {
        case DnsRecordKind.IPv4:
            return bytes.length == 4 ? { kind: 'A', value: Array.from(bytes).join('.') } : null;
        case DnsRecordKind.IPv6:
            return bytes.length == 16 ? { kind: 'AAAA', value: formatIPv6(bytes) } : null;
        case DnsRecordKind.Cname: {
            const host = bytes.toString('latin1');
            return isValidHostname(host) ? { kind: 'CNAME', value: host } : null;
        }
        default:
            return null;
    }
}

export function decodeEmailTarget(target: string | null): string | null {
    const email = Buffer.from(truncate0x(target ?? ''), 'hex').toString('latin1');

    return isValidEmail(email) ? email : null;
}

/// formats 16 bytes as an IPv6 address with the longest run of zero groups shortened to `::` (RFC 5952).
function formatIPv6(bytes: Buffer): string {
    const groups: number[] = [];

    for (let i = 0; i < 16; i += 2) {
        groups.push(bytes.readUInt16BE(i));
    }

    let bestStart = -1;
    let bestLength = 0;

    for (let i = 0; i < groups.length;) {
        if (groups[i] != 0) {
            i++;
            continue;
        }

        let end = i;
        while (end < groups.length && groups[end] == 0) {
            end++;
        }

        if (end - i > bestLength) {
            bestStart = i;
            bestLength = end - i;
        }

        i = end;
    }

    const hex = groups.map(group => group.toString(16));

    if (bestLength < 2) {
        return hex.join(':');
    }

    const head = hex.slice(0, bestStart).join(':');
    const tail = hex.slice(bestStart + bestLength).join(':');

    return `${head}::${tail}`;
}

export function sameWebsite(a: DnsWebsiteRecord | null, b: DnsWebsiteRecord | null): boolean {
    if (a == null || b == null) {
        return a == b;
    }

    return a.kind == b.kind && a.value == b.value;
}
