import express from 'express'
import bonusScore from "./bonus-score";

const router = express.Router()

router.use(bonusScore);

export default router
