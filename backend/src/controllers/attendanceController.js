import { updateAttendanceWithBalance, getStudentAttendanceSummary, getClassAttendanceWithBalance } from '../services/attendanceService.js';
import Attendance from '../models/Attendance.js';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * POST /api/attendance
 * Body: { classId, studentId, status, date? (YYYY-MM-DD, defaults to today) }
 */
export const recordAttendance = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const validated = req.validated;

    const result = await updateAttendanceWithBalance({
      classId: validated.classId,
      studentId: validated.studentId,
      status: validated.status,
      adminId,
      attendanceDate: validated.date || null
    });

    res.status(201).json({
      message: 'Attendance recorded successfully',
      data: {
        attendance: {
          id: result.attendance.id,
          classId: result.attendance.class_id,
          studentId: result.attendance.student_id,
          status: result.attendance.status,
          date: result.attendance.class_date,
          markedAt: result.attendance.marked_at,
          createdAt: result.attendance.created_at,
          updatedAt: result.attendance.updated_at
        },
        balanceImpact: result.balanceImpact,
        studentPaymentMode: result.studentConfig.payment_mode
      }
    });
  } catch (error) {
    if (error.message === 'Student configuration not found') {
      return res.status(400).json({
        error: { message: 'Student configuration not found. Student may not be properly registered.', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }
    if (error.message === 'Class not found') {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404, timestamp: new Date().toISOString() }
      });
    }
    console.error('Error recording attendance:', error);
    res.status(500).json({
      error: { message: 'Failed to record attendance', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * GET /api/attendance/class/:classId?date=YYYY-MM-DD
 * Returns attendance for a specific date (defaults to today).
 */
export const getClassAttendance = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const date = req.query.date || null;

    const result = await getClassAttendanceWithBalance(parseInt(classId), date);

    res.status(200).json({
      data: {
        class: {
          id: result.class.id,
          adminId: result.class.admin_id,
          title: result.class.title,
          description: result.class.description,
          classTime: result.class.class_time,
          durationMinutes: result.class.duration_minutes
        },
        records: result.attendanceRecords.map(record => ({
          id: record.id,
          classId: record.class_id,
          studentId: record.student_id,
          status: record.status,
          date: record.class_date,
          paymentMode: record.paymentMode,
          classPrice: record.classPrice,
          balanceImpact: record.balanceImpact,
          markedAt: record.marked_at
        })),
        summary: result.summary
      }
    });
  } catch (error) {
    if (error.message === 'Class not found') {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404, timestamp: new Date().toISOString() }
      });
    }
    console.error('Error fetching class attendance:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch class attendance', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * GET /api/attendance/class/:classId/calendar?month=YYYY-MM
 * Returns the set of dates that have attendance records in a given month.
 */
export const getClassAttendanceCalendar = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const month = req.query.month || todayStr().slice(0, 7);

    const dates = await Attendance.getMarkedDatesForClass(parseInt(classId), month);

    res.status(200).json({
      data: {
        classId: parseInt(classId),
        month,
        markedDates: dates.map(r => ({
          date: r.class_date instanceof Date
            ? r.class_date.toISOString().split('T')[0]
            : String(r.class_date).split(/[T ]/)[0],
          presentCount: parseInt(r.present_count) || 0,
          absentCount: parseInt(r.absent_count) || 0,
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching attendance calendar:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch attendance calendar', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * GET /api/attendance/student/:studentId?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { start, end } = req.query;

    if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
      return res.status(403).json({
        error: { message: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() }
      });
    }

    if (!start || !end) {
      return res.status(400).json({
        error: { message: 'start and end query parameters are required (YYYY-MM-DD format)', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      return res.status(400).json({
        error: { message: 'start and end must be in YYYY-MM-DD format', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }

    if (start > end) {
      return res.status(400).json({
        error: { message: 'start date must be before or equal to end date', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }

    const result = await getStudentAttendanceSummary(parseInt(studentId), start, end);

    res.status(200).json({
      data: {
        studentId: result.studentId,
        paymentMode: result.paymentMode,
        dateRange: result.dateRange,
        attendanceSummary: result.attendanceSummary,
        balanceImpact: result.balanceImpact,
        records: result.records.map(record => ({
          id: record.id,
          classId: record.class_id,
          studentId: record.student_id,
          status: record.status,
          title: record.title,
          date: record.class_date,
          classTime: record.class_time,
          markedAt: record.marked_at,
          createdAt: record.created_at
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch student attendance', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * GET /api/attendance/:id
 */
export const getAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findById(parseInt(id));

    if (!attendance) {
      return res.status(404).json({
        error: { message: 'Attendance record not found', statusCode: 404, timestamp: new Date().toISOString() }
      });
    }

    res.status(200).json({
      data: {
        id: attendance.id,
        classId: attendance.class_id,
        studentId: attendance.student_id,
        status: attendance.status,
        date: attendance.class_date,
        markedAt: attendance.marked_at,
        createdAt: attendance.created_at,
        updatedAt: attendance.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch attendance', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

export default { recordAttendance, getClassAttendance, getClassAttendanceCalendar, getStudentAttendance, getAttendance };
