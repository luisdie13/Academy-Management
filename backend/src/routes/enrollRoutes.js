import express from 'express';
import { enroll, updateStudentSchedule } from '../controllers/enrollController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

// POST /api/enroll — student self-enrolls in a class
router.post('/', authMiddleware, authorize('student'), enroll);

// PUT /api/enroll/:classId/student/:studentId/schedule — admin sets days_of_week for a student in a class
router.put('/:classId/student/:studentId/schedule', authMiddleware, authorize('admin'), updateStudentSchedule);

export default router;
