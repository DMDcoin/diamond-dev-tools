import express from 'express'
import node from "./node";
import supply from "./supply";
import stakeTransactions from "./stakeTransactions";

const router = express.Router()

router.use(node);
router.use(supply);
router.use(stakeTransactions);

export default router
