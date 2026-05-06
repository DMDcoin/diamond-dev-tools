import { param, query } from 'express-validator';
import express from 'express';
import Params from '../middleware/params';
import { authenticate } from '../middleware/authenticate';
import { rateLimiter } from '../middleware/rateLimiter';
import stakeTransactions from '../controllers/stakeTransactions';

const router = express.Router();

//
// GET /node/:address/stake-transactions
//
// All stake/unstake events where this address is the validator pool.
// Shows every staker who has interacted with this pool.
//
// Query params:
//   action_type  – filter to one event type (PlacedStake | WithdrewStake |
//                  OrderedWithdrawal | ClaimedOrderedWithdrawal |
//                  MovedStake | GatherAbandonedStakes)
//   from_block   – inclusive lower block number bound
//   to_block     – inclusive upper block number bound
//   epoch        – filter to a specific staking epoch
//   limit        – max rows to return (default 200, max 1000)
//   offset       – pagination offset (default 0)
//
router.get(
    '/node/:address/stake-transactions',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        query('action_type').optional().isString(),
        query('from_block').optional().isInt({ min: 0 }),
        query('to_block').optional().isInt({ min: 0 }),
        query('epoch').optional().isInt({ min: 0 }),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    stakeTransactions.listValidatorStakeTransactions
);

/**
 * GET /staker/:address/stake-transactions
 *
 * All stake/unstake events where this address is the staker (delegator or
 * pool owner staking on themselves).
 * Shows every pool this address has staked to/unstaked from.
 *
 * Query params: same as above.
 */
router.get(
    '/staker/:address/stake-transactions',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({ min: 42, max: 42 }),
        query('action_type').optional().isString(),
        query('from_block').optional().isInt({ min: 0 }),
        query('to_block').optional().isInt({ min: 0 }),
        query('epoch').optional().isInt({ min: 0 }),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 }),
        Params.validate,
    ],
    stakeTransactions.listStakerTransactions
);

export default router;
