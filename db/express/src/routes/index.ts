import express from 'express'
import node from "./node";

const router = express.Router()

router.use(node);

export default router
