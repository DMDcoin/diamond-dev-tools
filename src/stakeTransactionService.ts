import { DbManager } from "./db/database";
import { bufferToAddress } from "./utils/ether";

/**
 * Formats a raw stake_transactions row into a human-readable object.
 */
function formatRow(row: any) {
    return {
        id: row.id,
        blockNumber: row.block_number,
        blockTimestamp: row.block_timestamp,
        actionType: row.action_type,
        poolAddress: row.pool_address ? bufferToAddress(row.pool_address) : null,
        stakerAddress: row.staker_address ? bufferToAddress(row.staker_address) : null,
        toPoolAddress: row.to_pool_address ? bufferToAddress(row.to_pool_address) : null,
        callerAddress: row.caller_address ? bufferToAddress(row.caller_address) : null,
        amount: row.amount,
        stakingEpoch: row.staking_epoch,
        isDelegatorStake: row.is_delegator_stake,
        createdAt: row.created_at
    };
}

/**
 * Service layer for stake transaction queries.
 * Wraps DbManager methods.
 */
export class StakeTransactionService {
    public constructor(private dbManager: DbManager) {}

    /**
     * Get all stake transactions for a specific staker address.
     */
    public async getByStaker(
        stakerAddress: string,
        options?: { actionType?: string; limit?: number; offset?: number }
    ) {
        const rows = await this.dbManager.getStakeTransactionsByStaker(
            stakerAddress,
            options?.actionType,
            options?.limit,
            options?.offset
        );
        return rows.map(formatRow);
    }

    /**
     * Get all stakes placed by a specific address.
     */
    public async getStakesByAddress(address: string, limit = 100, offset = 0) {
        return this.getByStaker(address, { actionType: 'PlacedStake', limit, offset });
    }

    /**
     * Get all unstakes (WithdrewStake) by a specific address.
     */
    public async getUnstakesByAddress(address: string, limit = 100, offset = 0) {
        return this.getByStaker(address, { actionType: 'WithdrewStake', limit, offset });
    }

    /**
     * Get all transactions for a specific validator pool.
     */
    public async getByPool(
        poolAddress: string,
        options?: { actionType?: string; limit?: number; offset?: number }
    ) {
        const rows = await this.dbManager.getStakeTransactionsByPool(
            poolAddress,
            options?.actionType,
            options?.limit,
            options?.offset
        );
        return rows.map(formatRow);
    }

    /**
     * Get validator's total staking activity within a time range.
     */
    public async getValidatorActivity(
        validatorPoolAddress: string,
        startTimestamp?: number,
        endTimestamp?: number
    ) {
        const rows = await this.dbManager.getStakeTransactionsByPool(
            validatorPoolAddress,
            undefined,
            10000,
            0
        );

        const filtered = rows.filter(r => {
            if (startTimestamp !== undefined && r.block_timestamp < startTimestamp) return false;
            if (endTimestamp !== undefined && r.block_timestamp > endTimestamp) return false;
            return true;
        });

        return filtered.map(formatRow);
    }

    /**
     * Get stake/unstake transactions within a time range.
     */
    public async getByTimeRange(
        startTimestamp: number,
        endTimestamp: number,
        options?: { actionType?: string; limit?: number }
    ) {
        const rows = await this.dbManager.getStakeTransactionsByTimeRange(
            startTimestamp,
            endTimestamp,
            options?.actionType,
            options?.limit
        );
        return rows.map(formatRow);
    }

    /**
     * Get stake/unstake transactions within a block range.
     */
    public async getByBlockRange(startBlock: number, endBlock: number) {
        const rows = await this.dbManager.getStakeTransactionsByBlockRange(startBlock, endBlock);
        return rows.map(formatRow);
    }

    /**
     * Get the most recent transactions.
     */
    public async getRecent(limit = 50, actionType?: string) {
        const rows = await this.dbManager.getRecentStakeTransactions(limit, actionType);
        return rows.map(formatRow);
    }

    /**
     * Get aggregated volume statistics by action type.
     */
    public async getVolume(startTimestamp?: number, endTimestamp?: number) {
        return await this.dbManager.getStakeTransactionVolume(startTimestamp, endTimestamp);
    }
}
