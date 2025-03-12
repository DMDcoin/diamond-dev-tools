import {query, param} from 'express-validator';
import express from 'express';
import Params from "../middleware/params";
import bonusScore from "../controllers/bonus-score";
const router = express.Router();

router.get(
    '/bonus-score/:address/',
    [
        param('address').isHexadecimal().isLength({min:42, max: 42}),
        Params.validate,
    ],
    bonusScore.list
);


export default router;
