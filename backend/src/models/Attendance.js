import { query, queryOne, queryAll } from '../config/database.js';

const todayStr = () => new Date().toISOString().split('T')[0];

export class Attendance {
  static async create(attendanceData) {
    const { classId, studentId, status = 'pending', markedAt = null, classDate = null } = attendanceData;
    const dateValue = classDate || todayStr();

    const text = `
      INSERT INTO attendance (class_id, student_id, status, marked_at, class_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (class_id, student_id, class_date) DO UPDATE
      SET status = $3, marked_at = $4, updated_at = CURRENT_TIMESTAMP
      RETURNING id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
    `;

    const result = await query(text, [classId, studentId, status, markedAt, dateValue]);
    return result.rows[0];
  }

  static async findById(attendanceId) {
    const text = `
      SELECT id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
      FROM attendance
      WHERE id = $1
    `;
    return (await queryOne(text, [attendanceId])) || null;
  }

  static async findByClassAndStudent(classId, studentId, classDate = null) {
    const dateValue = classDate || todayStr();
    const text = `
      SELECT id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
      FROM attendance
      WHERE class_id = $1 AND student_id = $2 AND class_date = $3
    `;
    return (await queryOne(text, [classId, studentId, dateValue])) || null;
  }

  // Returns all attendance records for a class on a specific date (defaults to today).
  static async getByClass(classId, classDate = null) {
    const dateValue = classDate || todayStr();
    const text = `
      SELECT id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
      FROM attendance
      WHERE class_id = $1 AND class_date = $2
      ORDER BY student_id ASC
    `;
    return (await queryAll(text, [classId, dateValue])) || [];
  }

  // Returns dates with attendance summary (present/absent counts) for a class in a given month.
  static async getMarkedDatesForClass(classId, yearMonth) {
    const text = `
      SELECT
        class_date,
        COUNT(*) FILTER (WHERE status = 'present') AS present_count,
        COUNT(*) FILTER (WHERE status = 'absent')  AS absent_count
      FROM attendance
      WHERE class_id = $1
        AND to_char(class_date, 'YYYY-MM') = $2
      GROUP BY class_date
      ORDER BY class_date ASC
    `;
    return (await queryAll(text, [classId, yearMonth])) || [];
  }

  static async getByStudentAndDateRange(studentId, startDate, endDate) {
    const text = `
      SELECT
        a.id, a.class_id, a.student_id, a.status, a.marked_at,
        a.class_date, a.created_at, a.updated_at,
        c.title, c.class_time, c.duration_minutes
      FROM attendance a
      JOIN classes c ON a.class_id = c.id
      WHERE a.student_id = $1
        AND a.class_date BETWEEN $2 AND $3
      ORDER BY a.class_date ASC, c.class_time ASC
    `;
    return (await queryAll(text, [studentId, startDate, endDate])) || [];
  }

  static async update(attendanceId, status) {
    const text = `
      UPDATE attendance
      SET status = $1, marked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
    `;
    const result = await query(text, [status, attendanceId]);
    return result.rows[0] || null;
  }

  static async updateByClassAndStudent(classId, studentId, status, classDate = null) {
    const dateValue = classDate || todayStr();
    const text = `
      UPDATE attendance
      SET status = $1, marked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE class_id = $2 AND student_id = $3 AND class_date = $4
      RETURNING id, class_id, student_id, status, marked_at, class_date, created_at, updated_at
    `;
    const result = await query(text, [status, classId, studentId, dateValue]);
    return result.rows[0] || null;
  }

  static async delete(attendanceId) {
    const text = `DELETE FROM attendance WHERE id = $1 RETURNING id`;
    return !!(await queryOne(text, [attendanceId]));
  }

  static async countPresentInMonth(studentId, year, month) {
    const text = `
      SELECT COUNT(*) AS count
      FROM attendance
      WHERE student_id = $1
        AND status = 'present'
        AND EXTRACT(YEAR FROM class_date) = $2
        AND EXTRACT(MONTH FROM class_date) = $3
    `;
    const result = await queryOne(text, [studentId, year, month]);
    return result ? parseInt(result.count) : 0;
  }

  static async countAbsentInMonth(studentId, year, month) {
    const text = `
      SELECT COUNT(*) AS count
      FROM attendance
      WHERE student_id = $1
        AND status = 'absent'
        AND EXTRACT(YEAR FROM class_date) = $2
        AND EXTRACT(MONTH FROM class_date) = $3
    `;
    const result = await queryOne(text, [studentId, year, month]);
    return result ? parseInt(result.count) : 0;
  }
}

export default Attendance;
