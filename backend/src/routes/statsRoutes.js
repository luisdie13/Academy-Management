import express from 'express';
import { getAttendanceTrend, getMonthlyIncome } from '../controllers/statsController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/attendance-trend', authMiddleware, authorize('admin'), getAttendanceTrend);
router.get('/monthly-income', authMiddleware, authorize('admin'), getMonthlyIncome);

export default router;
