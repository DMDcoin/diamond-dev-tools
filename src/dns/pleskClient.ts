import axios, { AxiosInstance, Method } from "axios";
import fs from "fs";
import https from "https";

import { isValidHostname } from "./dnsSyncEvents";


const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export interface PleskSettings {
    /// e.g. https://plesk.example.com:8443
    url: string;
    apiKey: string;
    /// DNS zone the names are published in, `<label>.<zone>`.
    zone: string;
    /// domain of the forwarding addresses, `<label>@<mailDomain>`.
    mailDomain: string;
    timeoutMs: number;
    /// PEM file to trust, for a Plesk server with a self-signed certificate.
    caFile?: string;
}

export interface PleskCliResult {
    code: number;
    stdout: string;
    stderr: string;
}

export function getPleskSettings(env: NodeJS.ProcessEnv = process.env): PleskSettings {
    const required = ['DNS_SYNC_PLESK_URL', 'DNS_SYNC_PLESK_API_KEY', 'DNS_SYNC_PLESK_ZONE'];
    const missing = required.filter(name => !env[name]);

    if (missing.length > 0) {
        throw new Error(`Plesk DNS sync handler is not configured, missing: ${missing.join(', ')}`);
    }

    const timeoutMs = env.DNS_SYNC_PLESK_TIMEOUT_MS ? Number(env.DNS_SYNC_PLESK_TIMEOUT_MS) : 30000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`Environment variable DNS_SYNC_PLESK_TIMEOUT_MS is not a positive number: ${env.DNS_SYNC_PLESK_TIMEOUT_MS}`);
    }

    // both end up as arguments of plesk utilities.
    const zone = env.DNS_SYNC_PLESK_ZONE!.toLowerCase();
    const mailDomain = (env.DNS_SYNC_PLESK_MAIL_DOMAIN || zone).toLowerCase();

    for (const [name, domain] of [['DNS_SYNC_PLESK_ZONE', zone], ['DNS_SYNC_PLESK_MAIL_DOMAIN', mailDomain]]) {
        if (!isValidHostname(domain)) {
            throw new Error(`Environment variable ${name} is not a valid domain: ${domain}`);
        }
    }

    let url: URL;
    try {
        url = new URL(env.DNS_SYNC_PLESK_URL!);
    } catch {
        throw new Error('Environment variable DNS_SYNC_PLESK_URL is not a valid URL.');
    }

    // the API key is sent with every request, so it may only travel unencrypted to this machine.
    if (url.protocol != 'https:' && !LOOPBACK_HOSTS.includes(url.hostname)) {
        throw new Error('DNS_SYNC_PLESK_URL must use https.');
    }

    return {
        url: env.DNS_SYNC_PLESK_URL!.replace(/\/+$/, ''),
        apiKey: env.DNS_SYNC_PLESK_API_KEY!,
        zone,
        mailDomain,
        timeoutMs,
        caFile: env.DNS_SYNC_PLESK_CA_FILE || undefined
    };
}

/**
 * Minimal client for the Plesk REST API (/api/v2), authenticated with an API key.
 * API keys are created by a Plesk admin with POST /api/v2/auth/keys or `plesk bin secret_key`.
 */
export class PleskClient {

    private http: AxiosInstance;

    public constructor(
        public settings: PleskSettings
    ) {
        this.http = axios.create({
            baseURL: `${settings.url}/api/v2`,
            timeout: settings.timeoutMs,
            headers: {
                'X-API-Key': settings.apiKey,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            httpsAgent: settings.caFile ? new https.Agent({ ca: fs.readFileSync(settings.caFile) }) : undefined,
            // a redirect or a proxy from the environment would receive the API key as well.
            maxRedirects: 0,
            proxy: false,
            maxContentLength: MAX_RESPONSE_BYTES,
            maxBodyLength: MAX_RESPONSE_BYTES
        });
    }

    public async getServerInfo(): Promise<any> {
        return await this.request('GET', '/server');
    }

    public async findDomain(name: string): Promise<any | null> {
        const domains = await this.request('GET', `/domains?name=${encodeURIComponent(name)}`);

        return Array.isArray(domains) && domains.length > 0 ? domains[0] : null;
    }

    /**
     * Runs a Plesk command line utility, e.g. `dns` or `mail`, through the REST API.
     */
    public async callCli(utility: string, params: string[]): Promise<PleskCliResult> {
        const result = await this.request('POST', `/cli/${encodeURIComponent(utility)}/call`, { params });

        return {
            code: Number(result?.code ?? -1),
            stdout: String(result?.stdout ?? ''),
            stderr: String(result?.stderr ?? '')
        };
    }

    private async request(method: Method, path: string, data?: any): Promise<any> {
        try {
            const response = await this.http.request({ method, url: path, data });
            return response.data;
        } catch (err) {
            // axios errors carry the request config including the API key, so they are never passed on as is.
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;
                const message = err.response?.data?.message ?? err.response?.statusText ?? err.code ?? err.message;

                throw new Error(`Plesk API ${method} ${path} failed${status ? ` with HTTP ${status}` : ''}: ${message}`);
            }

            throw err;
        }
    }
}
