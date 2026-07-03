import { query, queryOne, queryAll } from '../config/database.js';

/**
 * GET /api/classes/available
 * Returns active classes the authenticated student can enroll in.
 *
 * Security layers:
 *  1. Student must be authenticated (authMiddleware + authorize('student')).
 *  2. Only classes with is_active = true are returned (admin-controlled flag).
 *  3. Classes the student is already enrolled in (enrollment_status = 'active')
 *     are excluded via NOT IN subquery.
 *
 * Note: student_admin_association is NOT used here because self-registered
 * students (via academy code) are never inserted into that table, which caused
 * the INNER JOIN to silently return zero rows.
 */
export const getAvailableClasses = async (req, res) => {
  try {
    const studentId = parseInt(req.user.id, 10);

    if (!studentId || Number.isNaN(studentId)) {
      return res.status(401).json({
        error: { message: 'Invalid user session: could not parse student ID', statusCode: 401 },
      });
    }

    // ── Association check (always) ─────────────────────────────────────────
    // This is the critical link: student_admin_association ties a student to
    // an academy admin. Without it the INNER JOIN below returns nothing.
    // Fetching it here (not only in the diagnostic block) lets us detect and
    // surface the "not linked" state to the frontend instead of silently
    // returning an empty array that looks like "enrolled in everything".
    const assocRows = await queryAll(
      `SELECT admin_id FROM student_admin_association WHERE student_id = $1`,
      [studentId]
    );

    if (assocRows.length === 0) {
      console.warn(
        `[getAvailableClasses] student ${studentId} has no student_admin_association rows.` +
        ` This happens when academy_settings.admin_id was NULL at registration time.` +
        ` Ask the academy administrator to add this student via the student management UI.`
      );
      return res.status(200).json({
        data: [],
        meta: { notLinkedToAcademy: true },
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    // ── Diagnostic snapshot (non-production) ──────────────────────────────
    if (process.env.NODE_ENV !== 'production') {
      const [activeClassRows, enrolledRows] = await Promise.all([
        queryAll(
          `SELECT id, title, is_active FROM classes WHERE is_active = true ORDER BY id`,
          []
        ),
        queryAll(
          `SELECT class_id FROM class_inscriptions WHERE student_id = $1 AND enrollment_status = 'active'`,
          [studentId]
        ),
      ]);

      console.log('[getAvailableClasses] diagnostic snapshot:', {
        studentId,
        studentAdminAssociations: assocRows.length,
        adminIds: assocRows.map((r) => r.admin_id),
        activeClassesInDb: activeClassRows.length,
        activeClassIds: activeClassRows.map((r) => r.id),
        alreadyEnrolledIn: enrolledRows.map((r) => r.class_id),
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    // Isolation: only return classes whose admin is linked to this student via
    // student_admin_association. This record is created at registration time
    // (authService.js) from the academyCode the student used to sign up.
    const text = `
      SELECT c.id, c.title, c.description, c.instructor, c.is_active, c.created_at
      FROM classes c
      INNER JOIN student_admin_association saa ON c.admin_id = saa.admin_id
      WHERE saa.student_id = $1
        AND c.is_active = true
        AND c.id NOT IN (
          SELECT ci.class_id
          FROM class_inscriptions ci
          WHERE ci.student_id = $1 AND ci.enrollment_status = 'active'
        )
      ORDER BY c.created_at DESC
    `;

    const result = await queryAll(text, [studentId]);

    console.log(`[getAvailableClasses] returning ${result.length} classes for student ${studentId}`);

    res.status(200).json({
      data: (result || []).map((cls) => ({
        id: cls.id,
        title: cls.title,
        description: cls.description,
        instructor: cls.instructor,
        isActive: cls.is_active,
        createdAt: cls.created_at,
      })),
      meta: { notLinkedToAcademy: false },
    });
  } catch (error) {
    console.error('[getAvailableClasses] ERROR:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      stack: error.stack,
    });

    res.status(500).json({
      error: {
        message: 'Failed to fetch available classes',
        statusCode: 500,
        ...(process.env.NODE_ENV !== 'production' && {
          debug: {
            message: error.message,
            pgCode: error.code,
            detail: error.detail,
            hint: error.hint,
          },
        }),
      },
    });
  }
};

/**
 * POST /api/enroll
 * Enroll the authenticated student in a class.
 * Body: { classId: number }
 *
 * Security layers:
 *  1. Student must be authenticated (authMiddleware).
 *  2. Class must exist and be active.
 *  3. student_admin_association must link this student to the class's admin
 *     (prevents cross-academy enrollment via ID manipulation).
 *  4. Duplicate enrollment returns 409 (also caught at DB constraint level).
 */
export const enroll = async (req, res) => {
  try {
    const studentId = parseInt(req.user.id, 10);
    const classId = parseInt(req.body?.classId, 10);

    if (!classId || !Number.isInteger(classId) || classId <= 0) {
      return res.status(400).json({
        error: { message: 'classId must be a positive integer', statusCode: 400 },
      });
    }

    // 1. Verify class exists and is active
    const classRow = await queryOne(
      `SELECT id, admin_id, title, is_active FROM classes WHERE id = $1`,
      [classId]
    );

    if (!classRow) {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404 },
      });
    }

    if (!classRow.is_active) {
      return res.status(400).json({
        error: { message: 'This class is not currently active', statusCode: 400 },
      });
    }

    // 2. Verify the student belongs to this class's academy
    const association = await queryOne(
      `SELECT id FROM student_admin_association
       WHERE student_id = $1 AND admin_id = $2`,
      [studentId, classRow.admin_id]
    );
    if (!association) {
      return res.status(403).json({
        error: { message: 'You are not authorized to enroll in this class', statusCode: 403 },
      });
    }

    // 3. Check for an existing active enrollment
    const existing = await queryOne(
      `SELECT id FROM class_inscriptions
       WHERE class_id = $1 AND student_id = $2 AND enrollment_status = 'active'`,
      [classId, studentId]
    );

    if (existing) {
      return res.status(409).json({
        error: { message: 'You are already enrolled in this class', statusCode: 409 },
      });
    }

    // 4. Create the enrollment
    const result = await query(
      `INSERT INTO class_inscriptions (class_id, student_id, admin_id, enrollment_status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id, class_id, student_id, admin_id, enrollment_status, enrolled_at`,
      [classId, studentId, classRow.admin_id]
    );

    const inscription = result.rows[0];

    res.status(201).json({
      message: `Successfully enrolled in "${classRow.title}"`,
      data: {
        id: inscription.id,
        classId: inscription.class_id,
        studentId: inscription.student_id,
        enrollmentStatus: inscription.enrollment_status,
        enrolledAt: inscription.enrolled_at,
      },
    });
  } catch (error) {
    console.error('[enroll] ERROR:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack,
    });
    // DB unique constraint fallback (class_id, student_id)
    if (error.code === '23505') {
      return res.status(409).json({
        error: { message: 'You are already enrolled in this class', statusCode: 409 },
      });
    }
    res.status(500).json({
      error: {
        message: 'Failed to enroll in class',
        statusCode: 500,
        ...(process.env.NODE_ENV !== 'production' && {
          debug: {
            message: error.message,
            pgCode: error.code,
            detail: error.detail,
          },
        }),
      },
    });
  }
};

/**
 * PUT /api/enroll/:classId/student/:studentId/schedule
 * Admin sets the days_of_week for a student's active inscription in a class.
 * Body: { daysOfWeek: string[] }
 */
const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const updateStudentSchedule = async (req, res) => {
  try {
    const adminId = req.user.id;
    const classId = parseInt(req.params.classId, 10);
    const studentId = parseInt(req.params.studentId, 10);
    const { daysOfWeek } = req.body;

    if (!Array.isArray(daysOfWeek) || daysOfWeek.some(d => !VALID_DAYS.includes(d))) {
      return res.status(400).json({
        error: { message: 'daysOfWeek must be an array of valid day names', statusCode: 400 }
      });
    }

    // Verify class belongs to admin
    const classRow = await queryOne(
      `SELECT id FROM classes WHERE id = $1 AND admin_id = $2`,
      [classId, adminId]
    );
    if (!classRow) {
      return res.status(404).json({
        error: { message: 'Class not found or access denied', statusCode: 404 }
      });
    }

    // Update days_of_week on the active inscription
    const pgArray = daysOfWeek.length > 0 ? `{${daysOfWeek.join(',')}}` : '{}';
    const result = await query(
      `UPDATE class_inscriptions
       SET days_of_week = $1, updated_at = NOW()
       WHERE class_id = $2 AND student_id = $3 AND enrollment_status = 'active'
       RETURNING id, class_id, student_id, days_of_week`,
      [pgArray, classId, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { message: 'Active inscription not found for this student and class', statusCode: 404 }
      });
    }

    const row = result.rows[0];
    res.status(200).json({
      message: 'Schedule updated successfully',
      data: {
        inscriptionId: row.id,
        classId: row.class_id,
        studentId: row.student_id,
        daysOfWeek: row.days_of_week || []
      }
    });
  } catch (error) {
    console.error('[updateStudentSchedule] ERROR:', error.message);
    res.status(500).json({
      error: { message: 'Failed to update schedule', statusCode: 500 }
    });
  }
};
