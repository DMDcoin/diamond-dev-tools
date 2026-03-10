import express from 'express'
import node from "./node";
import supply from "./supply";

const router = express.Router()

router.use(node);
router.use(supply);

export default router
