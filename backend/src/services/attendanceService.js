import { transaction } from '../config/database.js';
import Attendance from '../models/Attendance.js';
import StudentConfig from '../models/StudentConfig.js';
import Class from '../models/Class.js';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Register or update attendance for a specific date and calculate balance impacts.
 * POSTPAID: Presence = charge student for that class.
 * PREPAID: Absence = credit toward next month.
 */
export const updateAttendanceWithBalance = async (attendanceData) => {
  const { classId, studentId, status, adminId, attendanceDate } = attendanceData;
  const dateValue = attendanceDate || todayStr();

  return await transaction(async (client) => {
    const configResult = await client.query(
      `SELECT id, student_id, payment_mode, price_per_class, monthly_fixed_amount
       FROM student_config WHERE student_id = $1`,
      [studentId]
    );
    const studentConfig = configResult.rows[0];
    if (!studentConfig) throw new Error('Student configuration not found');

    const classResult = await client.query(
      `SELECT id, admin_id, title FROM classes WHERE id = $1`,
      [classId]
    );
    const classInfo = classResult.rows[0];
    if (!classInfo) throw new Error('Class not found');

    // Upsert attendance for this specific date
    const attendanceResult = await client.query(
      `INSERT INTO attendance (class_id, student_id, status, marked_at, class_date)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
       ON CONFLICT (class_id, student_id, class_date) DO UPDATE
         SET status = $3, marked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       RETURNING id, class_id, student_id, status, marked_at, class_date, created_at, updated_at`,
      [classId, studentId, status, dateValue]
    );
    const attendanceRecord = attendanceResult.rows[0];

    let balanceImpact = {
      type: studentConfig.payment_mode,
      amount: 0,
      description: '',
      status
    };

    if (studentConfig.payment_mode === 'postpaid' && status === 'present') {
      const chargeAmount = parseFloat(studentConfig.price_per_class || 0);
      balanceImpact.amount = chargeAmount;
      balanceImpact.description = `Cargo por asistencia: ${classInfo.title} (${dateValue})`;

      if (chargeAmount > 0) {
        await client.query(
          `INSERT INTO transactions (student_id, admin_id, transaction_type, amount, payment_method, created_at)
           VALUES ($1, $2, 'charge', $3, 'class_attendance', CURRENT_TIMESTAMP)`,
          [studentId, adminId, chargeAmount]
        );
      }
    } else if (studentConfig.payment_mode === 'prepaid' && status === 'absent') {
      const creditAmount = parseFloat(studentConfig.price_per_class || 0);
      balanceImpact.amount = creditAmount;
      balanceImpact.description = `Crédito por ausencia: ${classInfo.title} (${dateValue})`;

      if (creditAmount > 0) {
        await client.query(
          `INSERT INTO transactions (student_id, admin_id, transaction_type, amount, payment_method, created_at)
           VALUES ($1, $2, 'credit', $3, 'class_absence', CURRENT_TIMESTAMP)`,
          [studentId, adminId, creditAmount]
        );

        await client.query(
          `UPDATE student_config SET credit_balance = credit_balance + $1 WHERE student_id = $2`,
          [creditAmount, studentId]
        );
      }
    }

    return { attendance: attendanceRecord, balanceImpact, studentConfig };
  });
};

/**
 * Get student attendance summary for a date range.
 */
export const getStudentAttendanceSummary = async (studentId, startDate, endDate) => {
  const attendanceRecords = await Attendance.getByStudentAndDateRange(studentId, startDate, endDate);
  const studentConfig = await StudentConfig.findByStudentId(studentId);

  let presentCount = 0;
  let absentCount = 0;
  let pendingCount = 0;

  attendanceRecords.forEach(record => {
    if (record.status === 'present') presentCount++;
    else if (record.status === 'absent') absentCount++;
    else if (record.status === 'pending') pendingCount++;
  });

  const classPrice = parseFloat(studentConfig?.price_per_class || 0);
  let balanceImpact = 0;
  if (studentConfig?.payment_mode === 'postpaid') {
    balanceImpact = presentCount * classPrice;
  } else if (studentConfig?.payment_mode === 'prepaid') {
    balanceImpact = absentCount * classPrice;
  }

  return {
    studentId,
    paymentMode: studentConfig?.payment_mode || 'unknown',
    dateRange: { startDate, endDate },
    attendanceSummary: { total: attendanceRecords.length, present: presentCount, absent: absentCount, pending: pendingCount },
    balanceImpact: {
      amount: balanceImpact,
      description: studentConfig?.payment_mode === 'postpaid'
        ? `Total a cobrar: ${presentCount} clases × Q${classPrice}`
        : `Crédito acumulado: ${absentCount} ausencias × Q${classPrice}`
    },
    records: attendanceRecords
  };
};

/**
 * Get all attendance records for a class on a specific date with balance impacts.
 */
export const getClassAttendanceWithBalance = async (classId, classDate = null) => {
  const dateValue = classDate || new Date().toISOString().split('T')[0];
  const classInfo = await Class.findById(classId);
  if (!classInfo) throw new Error('Class not found');

  const attendanceRecords = await Attendance.getByClass(classId, dateValue);

  const enrichedRecords = await Promise.all(
    attendanceRecords.map(async (record) => {
      const studentConfig = await StudentConfig.findByStudentId(record.student_id);
      let balanceImpact = 0;
      if (studentConfig?.payment_mode === 'postpaid' && record.status === 'present') {
        balanceImpact = parseFloat(studentConfig.price_per_class || 0);
      } else if (studentConfig?.payment_mode === 'prepaid' && record.status === 'absent') {
        balanceImpact = parseFloat(studentConfig.price_per_class || 0);
      }
      return {
        ...record,
        paymentMode: studentConfig?.payment_mode || 'unknown',
        classPrice: studentConfig?.price_per_class || 0,
        balanceImpact
      };
    })
  );

  const totalCharges = enrichedRecords
    .filter(r => r.paymentMode === 'postpaid' && r.status === 'present')
    .reduce((s, r) => s + r.balanceImpact, 0);

  const totalCredits = enrichedRecords
    .filter(r => r.paymentMode === 'prepaid' && r.status === 'absent')
    .reduce((s, r) => s + r.balanceImpact, 0);

  return {
    class: classInfo,
    attendanceRecords: enrichedRecords,
    summary: {
      date: dateValue,
      totalRecords: attendanceRecords.length,
      presentCount: enrichedRecords.filter(r => r.status === 'present').length,
      absentCount: enrichedRecords.filter(r => r.status === 'absent').length,
      pendingCount: enrichedRecords.filter(r => r.status === 'pending').length,
      totalPostpaidCharges: totalCharges,
      totalPrepaidCredits: totalCredits
    }
  };
};

export default { updateAttendanceWithBalance, getStudentAttendanceSummary, getClassAttendanceWithBalance };
