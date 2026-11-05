import { ContractManager } from "../contractManager";
import { getDBConnection } from "../db/database-persistent";
import { PgDnsSyncStore } from "../db/dnsSyncStore";
import { DmdNamesModerationSource } from "./dnsModerationSource";
import { ContractDnsSyncChain } from "./dnsSyncChain";
import { createDnsSyncHandler } from "./dnsSyncHandler";
import { DnsSyncSettings } from "./dnsSyncProcessor";
import { DnsSyncService } from "./dnsSyncService";


function envNumber(name: string, defaultValue: number, minimum: number): number {
    const value = process.env[name];

    if (value === undefined || value === '') {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
        throw new Error(`Environment variable ${name} must be a whole number of at least ${minimum}: ${value}`);
    }

    return parsed;
}

function getDnsSyncSettings(): DnsSyncSettings {
    const startBlock = process.env.DNS_SYNC_START_BLOCK
        ? envNumber('DNS_SYNC_START_BLOCK', 0, 0)
        : undefined;

    return {
        startBlock,
        confirmations: envNumber('DNS_SYNC_CONFIRMATIONS', 0, 0),
        reorgDepth: envNumber('DNS_SYNC_REORG_DEPTH', 50, 1),
        chunkSize: envNumber('DNS_SYNC_CHUNK_SIZE', 2000, 1),
        pollIntervalMs: envNumber('DNS_SYNC_POLL_INTERVAL_MS', 5000, 100),
        reconcileIntervalMs: envNumber('DNS_SYNC_RECONCILE_INTERVAL_MS', 15 * 60 * 1000, 1000),
        maxAttempts: envNumber('DNS_SYNC_MAX_ATTEMPTS', 10, 1),
        retryBaseMs: envNumber('DNS_SYNC_RETRY_BASE_MS', 5000, 1),
        retryMaxMs: envNumber('DNS_SYNC_RETRY_MAX_MS', 15 * 60 * 1000, 1),
        rpcTimeoutMs: envNumber('DNS_SYNC_RPC_TIMEOUT_MS', 30000, 1)
    };
}

async function run() {

    const settings = getDnsSyncSettings();

    const contractManager = ContractManager.get();

    if (!await contractManager.getDmdRegistrarController() || !await contractManager.getDmdNames()) {
        throw new Error('DMD_REGISTRAR_CONTROLLER_ADDRESS and DMD_NAMES_ADDRESS must be set for this chain.');
    }

    const resolverAddress = await contractManager.getDmdResolverAddress();
    console.log(`DNS sync using resolver ${resolverAddress}`);

    const connectionPool = getDBConnection();

    const service = new DnsSyncService(
        new ContractDnsSyncChain(contractManager, settings.rpcTimeoutMs),
        new PgDnsSyncStore(connectionPool),
        new DmdNamesModerationSource(connectionPool),
        createDnsSyncHandler(process.env.DNS_SYNC_HANDLER),
        settings
    );

    await service.run();
}

run().catch((err) => {
    console.log("error!!:");
    console.log(err);
    process.exit(1);
});
