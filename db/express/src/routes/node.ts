import {query, param} from 'express-validator';
import express from 'express';
import Params from "../middleware/params";
import node from "../controllers/node";
const router = express.Router();

router.get(
    '/node/:address/bonus-score/',
    [
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    node.listBonusScore
);

router.get(
    '/node/:address/stake-history/',
    [
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    node.listStakeHistory
);


export default router;
