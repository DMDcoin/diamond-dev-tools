import {query, param} from 'express-validator';
import express from 'express';
import Params from "../middleware/params";
import { authenticate } from "../middleware/authenticate";
import { rateLimiter } from "../middleware/rateLimiter";
import node from "../controllers/node";
const router = express.Router();

router.get(
    '/node/:address/bonus-score-history/',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    node.listBonusScore
);

router.get(
    '/node/:address/bonus-score-reasons-history/',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    node.listBonusScoreReasons
);

router.get(
    '/node/:address/stake-history/',
    [
        authenticate,
        rateLimiter,
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    node.listStakeHistory
);

export default router;
