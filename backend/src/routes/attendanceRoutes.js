import express from 'express';
import {
  recordAttendance,
  getClassAttendance,
  getClassAttendanceCalendar,
  getStudentAttendance,
  getAttendance
} from '../controllers/attendanceController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { validate, createAttendanceSchema } from '../middleware/validation.js';

const router = express.Router();

// POST /api/attendance — record or update attendance for a date
router.post('/', authMiddleware, authorize('admin'), validate(createAttendanceSchema), recordAttendance);

// GET /api/attendance/class/:classId?date=YYYY-MM-DD — attendance for a class on a date
router.get('/class/:classId', authMiddleware, authorize('admin'), getClassAttendance);

// GET /api/attendance/class/:classId/calendar?month=YYYY-MM — marked dates in a month
router.get('/class/:classId/calendar', authMiddleware, authorize('admin'), getClassAttendanceCalendar);

// GET /api/attendance/student/:studentId?start=&end= — student attendance range
router.get('/student/:studentId', authMiddleware, getStudentAttendance);

// GET /api/attendance/:id — single attendance record
router.get('/:id', authMiddleware, getAttendance);

export default router;
