-- Create the stake_transactions table
CREATE TABLE IF NOT EXISTS stake_transactions (
    id SERIAL PRIMARY KEY,

    -- Block identifiers
    block_number INTEGER NOT NULL,
    block_timestamp INTEGER NOT NULL,

    -- Action type: PlacedStake, WithdrewStake, OrderedWithdrawal,
    -- ClaimedOrderedWithdrawal, MovedStake, GatherAbandonedStakes
    action_type VARCHAR(30) NOT NULL,

    -- Pool being staked to/withdrawn from
    pool_address BYTEA NOT NULL,

    -- The staker address (null for GatherAbandonedStakes)
    staker_address BYTEA,

    -- Destination pool (only for MovedStake events)
    to_pool_address BYTEA,

    -- Caller address (only for GatherAbandonedStakes events)
    caller_address BYTEA,

    -- Amount in wei (NUMERIC to handle large values)
    amount NUMERIC NOT NULL,

    -- Staking epoch at time of event
    staking_epoch INTEGER,

    -- Whether this was a delegator stake (staker != pool)
    is_delegator_stake BOOLEAN DEFAULT FALSE,

    -- Timestamp for record creation
    created_at TIMESTAMP DEFAULT NOW()
);

-- Primary query pattern: all transactions for a specific staker
CREATE INDEX IF NOT EXISTS idx_stake_tx_staker
    ON stake_transactions(staker_address);

-- Query by pool address
CREATE INDEX IF NOT EXISTS idx_stake_tx_pool
    ON stake_transactions(pool_address);

-- Query by action type
CREATE INDEX IF NOT EXISTS idx_stake_tx_action_type
    ON stake_transactions(action_type);

-- Query by block number
CREATE INDEX IF NOT EXISTS idx_stake_tx_block_number
    ON stake_transactions(block_number);

-- Query by block timestamp (for time range queries)
CREATE INDEX IF NOT EXISTS idx_stake_tx_block_timestamp
    ON stake_transactions(block_timestamp DESC);

-- Composite: staker + action type + timestamp (common query pattern)
CREATE INDEX IF NOT EXISTS idx_stake_tx_staker_action_time
    ON stake_transactions(staker_address, action_type, block_timestamp);

-- Composite: pool + action type + timestamp (validator activity queries)
CREATE INDEX IF NOT EXISTS idx_stake_tx_pool_action_time
    ON stake_transactions(pool_address, action_type, block_timestamp);

-- Composite: block number + ordering within block
CREATE INDEX IF NOT EXISTS idx_stake_tx_block_id
    ON stake_transactions(block_number, id);

-- Staking epoch index (for epoch-based queries)
CREATE INDEX IF NOT EXISTS idx_stake_tx_epoch
    ON stake_transactions(staking_epoch);

-- Verify the table was created successfully
SELECT 'stake_transactions table created successfully' AS migration_status;
