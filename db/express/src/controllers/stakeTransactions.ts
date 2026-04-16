import { QueryTypes } from 'sequelize';
import { stake_transaction } from '../models/init-models';

// Convert a BYTEA buffer column to a 0x-prefixed hex address string
function bufToAddress(buf: Buffer | null | undefined): string | null {
    if (!buf) return null;
    return '0x' + buf.toString('hex');
}

// Format a raw stake_transactions DB row into a clean response object
function formatRow(row: any) {
    return {
        id: row.id,
        block_number: row.block_number,
        block_timestamp: row.block_timestamp,
        action_type: row.action_type,
        pool_address: bufToAddress(row.pool_address),
        staker_address: bufToAddress(row.staker_address),
        to_pool_address: bufToAddress(row.to_pool_address),
        caller_address: bufToAddress(row.caller_address),
        amount: row.amount,
        staking_epoch: row.staking_epoch,
        is_delegator_stake: row.is_delegator_stake,
    };
}

// GET /node/:address/stake-transactions
//
// Returns every stake event where this address is the pool (validator pool).
// Shows all staker activity on this validator — who staked, who unstaked, amounts,
// blocks and epochs. Also includes a running cumulative total at each event.
const listValidatorStakeTransactions = async (req: any, res: any) => {
    const { address } = req.params;
    const {
        action_type,
        limit = '200',
        offset = '0',
        from_block,
        to_block,
        epoch,
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const conditions: string[] = [
            `'0x' || encode(pool_address, 'hex') = lower($1)`
        ];
        const bind: any[] = [address];
        let paramIdx = 2;

        if (action_type) {
            conditions.push(`action_type = $${paramIdx++}`);
            bind.push(action_type);
        }
        if (from_block) {
            conditions.push(`block_number >= $${paramIdx++}`);
            bind.push(parseInt(from_block as string));
        }
        if (to_block) {
            conditions.push(`block_number <= $${paramIdx++}`);
            bind.push(parseInt(to_block as string));
        }
        if (epoch) {
            conditions.push(`staking_epoch = $${paramIdx++}`);
            bind.push(parseInt(epoch as string));
        }

        const where = conditions.join(' AND ');

        const countResult: any[] = await stake_transaction.sequelize!.query(
            `SELECT COUNT(*) as total FROM stake_transactions WHERE ${where}`,
            { bind, type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await stake_transaction.sequelize!.query(
            `SELECT
                id,
                block_number,
                block_timestamp,
                action_type,
                pool_address,
                staker_address,
                to_pool_address,
                caller_address,
                amount,
                staking_epoch,
                is_delegator_stake
             FROM stake_transactions
             WHERE ${where}
             ORDER BY block_number ASC, id ASC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            { bind: [...bind, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows.map(formatRow),
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching validator stake transactions:', error);
        res.status(500).json({ error: 'Failed to fetch validator stake transactions' });
    }
};

// GET /staker/:address/stake-transactions
//
// Returns every stake event where this address is the staker (delegator or pool owner).
// Shows what pools this address has staked to/unstaked from, amounts, blocks and epochs.
const listStakerTransactions = async (req: any, res: any) => {
    const { address } = req.params;
    const {
        action_type,
        limit = '200',
        offset = '0',
        from_block,
        to_block,
        epoch,
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
    const offsetNum = parseInt(offset as string) || 0;

    try {
        const conditions: string[] = [
            `'0x' || encode(staker_address, 'hex') = lower($1)`
        ];
        const bind: any[] = [address];
        let paramIdx = 2;

        if (action_type) {
            conditions.push(`action_type = $${paramIdx++}`);
            bind.push(action_type);
        }
        if (from_block) {
            conditions.push(`block_number >= $${paramIdx++}`);
            bind.push(parseInt(from_block as string));
        }
        if (to_block) {
            conditions.push(`block_number <= $${paramIdx++}`);
            bind.push(parseInt(to_block as string));
        }
        if (epoch) {
            conditions.push(`staking_epoch = $${paramIdx++}`);
            bind.push(parseInt(epoch as string));
        }

        const where = conditions.join(' AND ');

        const countResult: any[] = await stake_transaction.sequelize!.query(
            `SELECT COUNT(*) as total FROM stake_transactions WHERE ${where}`,
            { bind, type: QueryTypes.SELECT }
        );
        const total = parseInt(countResult[0].total);

        const rows: any[] = await stake_transaction.sequelize!.query(
            `SELECT
                id,
                block_number,
                block_timestamp,
                action_type,
                pool_address,
                staker_address,
                to_pool_address,
                caller_address,
                amount,
                staking_epoch,
                is_delegator_stake
             FROM stake_transactions
             WHERE ${where}
             ORDER BY block_number ASC, id ASC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
            { bind: [...bind, limitNum, offsetNum], type: QueryTypes.SELECT }
        );

        res.json({
            data: rows.map(formatRow),
            count: total,
            limit: limitNum,
            offset: offsetNum,
        });
    } catch (error) {
        console.error('Error fetching staker transactions:', error);
        res.status(500).json({ error: 'Failed to fetch staker stake transactions' });
    }
};

export default {
    listValidatorStakeTransactions,
    listStakerTransactions,
};
