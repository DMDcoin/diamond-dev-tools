import { ContractManager } from "../contractManager";
import { DnsChainNameState, DnsSyncEvent } from "./dnsSyncEvents";


/// chain access needed by the DNS sync.
export interface DnsSyncChain {
    getChainId(): Promise<number>;

    getBlockNumber(): Promise<number>;

    getBlockHash(blockNumber: number): Promise<string | null>;

    getEvents(fromBlock: number, toBlock: number): Promise<DnsSyncEvent[]>;

    getNameState(labelHash: string, label: string, node: string, blockNumber: number): Promise<DnsChainNameState>;
}

export class ContractDnsSyncChain implements DnsSyncChain {

    public constructor(
        public contractManager: ContractManager,
        public timeoutMs: number
    ) { }

    public async getChainId(): Promise<number> {
        return await this.withTimeout(this.contractManager.web3.eth.getChainId(), 'getChainId');
    }

    public async getBlockNumber(): Promise<number> {
        return await this.withTimeout(this.contractManager.web3.eth.getBlockNumber(), 'getBlockNumber');
    }

    public async getBlockHash(blockNumber: number): Promise<string | null> {
        const block = await this.withTimeout(this.contractManager.web3.eth.getBlock(blockNumber), `getBlock(${blockNumber})`);

        return block ? block.hash.toLowerCase() : null;
    }

    public async getEvents(fromBlock: number, toBlock: number): Promise<DnsSyncEvent[]> {
        return await this.withTimeout(
            this.contractManager.getDnsSyncEvents(fromBlock, toBlock),
            `getDnsSyncEvents(${fromBlock}, ${toBlock})`
        );
    }

    public async getNameState(labelHash: string, label: string, node: string, blockNumber: number): Promise<DnsChainNameState> {
        return await this.withTimeout(
            this.contractManager.getDnsNameState(labelHash, label, node, blockNumber),
            `getDnsNameState(${label})`
        );
    }

    // the http provider has no timeout by default, a hanging request would stop the whole sync.
    private async withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
        let timer: NodeJS.Timeout | undefined;

        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`RPC call ${operation} timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
        });

        try {
            return await Promise.race([promise, timeout]);
        } finally {
            clearTimeout(timer);
        }
    }
}
