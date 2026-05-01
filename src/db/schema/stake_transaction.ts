/**
 * Stake transactions table schema
 * Generated for: stake_transactions table
 */

import Headers from './headers'
import Node from './node'

/**
 * Individual stake/unstake transaction record.
 * Each row represents a single contract event.
 */
interface StakeTransaction {
  id: number
  block_number: Headers['block_number']
  block_timestamp: number
  action_type: string
  pool_address: Node['pool_address']
  staker_address: Buffer | null
  to_pool_address: Buffer | null
  caller_address: Buffer | null
  amount: string
  staking_epoch: number | null
  is_delegator_stake: boolean
  created_at: Date
}
export default StakeTransaction;

/**
 * Insert parameters for stake_transactions (omit auto-generated fields)
 */
interface StakeTransaction_InsertParameters {
  block_number: Headers['block_number']
  block_timestamp: number
  action_type: string
  pool_address: Node['pool_address']
  staker_address?: Buffer | null
  to_pool_address?: Buffer | null
  caller_address?: Buffer | null
  amount: string
  staking_epoch?: number | null
  is_delegator_stake?: boolean
  created_at?: Date
}
export type { StakeTransaction_InsertParameters }
