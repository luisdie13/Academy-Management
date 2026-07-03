import Class from '../models/Class.js';

/**
 * GET /api/classes/admin-classes
 * Returns all classes owned by the authenticated admin.
 */
export const getAdminClasses = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { queryAll } = await import('../config/database.js');

    const text = `
      SELECT id, admin_id, title, description, instructor, is_active, created_at
      FROM classes
      WHERE admin_id = $1
      ORDER BY created_at DESC
    `;
    const result = await queryAll(text, [adminId]);

    res.status(200).json({
      data: (result || []).map(cls => ({
        id: cls.id,
        adminId: cls.admin_id,
        title: cls.title,
        description: cls.description,
        instructor: cls.instructor,
        isActive: cls.is_active,
        createdAt: cls.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching admin classes:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve classes. Please try again.',
        statusCode: 500,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

/**
 * POST /api/classes
 * Create a new class. Only title, description, and instructor are required.
 * Modality, schedule, and days are configured during student enrollment.
 */
export const createClass = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const validated = req.validated;

    const classData = await Class.create({
      adminId,
      title: validated.title,
      description: validated.description,
      instructor: validated.instructor
    });

    res.status(201).json({
      message: 'Class created successfully',
      data: {
        id: classData.id,
        adminId: classData.admin_id,
        title: classData.title,
        description: classData.description,
        instructor: classData.instructor,
        isActive: classData.is_active,
        createdAt: classData.created_at
      }
    });
  } catch (error) {
    console.error('Error creating class:', error);
    res.status(500).json({
      error: {
        message: 'Failed to create class. Please try again.',
        statusCode: 500,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

/**
 * GET /api/classes
 * Returns classes dynamically based on the authenticated user's role.
 * Admins receive all their classes; students receive only enrolled classes.
 */
export const getClasses = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(500).json({
        error: {
          message: 'Internal server error: Invalid user context',
          statusCode: 500
        }
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const { queryAll } = await import('../config/database.js');

    let result;

    if (userRole === 'admin') {
      const text = `
        SELECT id, admin_id, title, description, instructor, is_active, created_at
        FROM classes
        WHERE admin_id = $1
        ORDER BY created_at DESC
      `;
      result = await queryAll(text, [userId]);
    } else {
      const text = `
        SELECT c.id, c.admin_id, c.title, c.description, c.instructor, c.is_active, c.created_at,
               ci.days_of_week
        FROM classes c
        INNER JOIN class_inscriptions ci ON c.id = ci.class_id
        WHERE ci.student_id = $1
        ORDER BY c.created_at DESC
      `;
      result = await queryAll(text, [userId]);
    }

    const parsePgArray = (val) => {
      if (Array.isArray(val)) return val;
      if (!val || typeof val !== 'string') return [];
      const s = val.trim();
      if (!s || s === '{}') return [];
      return s.replace(/^\{|\}$/g, '').split(',').map(v => v.trim());
    };

    res.status(200).json({
      data: (result || []).map(cls => ({
        id: cls.id,
        adminId: cls.admin_id,
        title: cls.title,
        description: cls.description,
        instructor: cls.instructor,
        isActive: cls.is_active,
        createdAt: cls.created_at,
        daysOfWeek: parsePgArray(cls.days_of_week),
      }))
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch classes',
        statusCode: 500,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

/**
 * GET /api/classes/:id
 * Returns a single class by ID.
 */
export const getClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const classData = await Class.findById(parseInt(id));

    if (!classData) {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404 }
      });
    }

    res.status(200).json({
      data: {
        id: classData.id,
        adminId: classData.admin_id,
        title: classData.title,
        description: classData.description,
        instructor: classData.instructor,
        isActive: classData.is_active,
        createdAt: classData.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch class', statusCode: 500 }
    });
  }
};

/**
 * PUT /api/classes/:id
 * Update a class. Only the owning admin may update it.
 */
export const updateClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { title, description, instructor, is_active } = req.body;

    const classData = await Class.findById(parseInt(id));

    if (!classData) {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404 }
      });
    }

    if (classData.admin_id !== adminId) {
      return res.status(403).json({
        error: { message: 'You do not have permission to update this class', statusCode: 403 }
      });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (instructor !== undefined) updates.instructor = instructor;
    if (is_active !== undefined) updates.is_active = is_active;

    const updated = await Class.update(parseInt(id), updates);

    res.status(200).json({
      message: 'Class updated successfully',
      data: {
        id: updated.id,
        adminId: updated.admin_id,
        title: updated.title,
        description: updated.description,
        instructor: updated.instructor,
        isActive: updated.is_active,
        createdAt: updated.created_at
      }
    });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({
      error: { message: 'Failed to update class', statusCode: 500 }
    });
  }
};

/**
 * DELETE /api/classes/:id
 * Delete a class. Cascade in the DB removes related inscriptions automatically.
 * Only the owning admin may delete it.
 */
export const deleteClass = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const classData = await Class.findById(parseInt(id));

    if (!classData) {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404 }
      });
    }

    if (classData.admin_id !== adminId) {
      return res.status(403).json({
        error: { message: 'You do not have permission to delete this class', statusCode: 403 }
      });
    }

    await Class.delete(parseInt(id));

    res.status(200).json({
      message: 'Class deleted successfully',
      data: { id: parseInt(id) }
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({
      error: { message: 'Failed to delete class', statusCode: 500 }
    });
  }
};

/**
 * GET /api/classes/by-academy?code=<subdomain>
 * Public endpoint — no authentication required.
 * Verifies the academy code (subdomain) and returns available classes
 * for the student registration flow.
 */
export const getClassesByAcademy = async (req, res) => {
  try {
    const { adminId } = req.query;

    const parsedId = parseInt(adminId, 10);
    if (!adminId || isNaN(parsedId) || parsedId < 1) {
      return res.status(400).json({
        error: { message: 'A valid adminId query parameter is required', statusCode: 400 }
      });
    }

    const { queryAll } = await import('../config/database.js');
    const classes = await queryAll(
      `SELECT id, title, description, instructor
       FROM classes
       WHERE admin_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [parsedId]
    );

    return res.status(200).json({
      data: (classes || []).map(cls => ({
        id: cls.id,
        title: cls.title,
        description: cls.description,
        instructor: cls.instructor,
      }))
    });
  } catch (error) {
    console.error('Error fetching classes by academy:', error);
    return res.status(500).json({
      error: {
        message: 'Failed to fetch classes',
        statusCode: 500,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    });
  }
};

/**
 * GET /api/classes/:id/students
 * Returns all students enrolled in a specific class, with their user info.
 * Only the admin who owns the class can access this.
 *
 * Includes a diagnostic log that shows the raw inscription count for
 * the class regardless of enrollment_status, which helps surface
 * orphaned records created before multi-tenancy was in place.
 */
export const getClassStudents = async (req, res, next) => {
  try {
    const classId = parseInt(req.params.id, 10);
    const adminId = req.user.id;
    const { queryOne, queryAll } = await import('../config/database.js');

    // Verify the class exists and belongs to this admin
    const classRow = await queryOne(
      `SELECT id, admin_id, title FROM classes WHERE id = $1`,
      [classId]
    );

    if (!classRow) {
      return res.status(404).json({
        error: { message: 'Class not found', statusCode: 404 }
      });
    }

    if (classRow.admin_id !== adminId) {
      return res.status(403).json({
        error: { message: 'You do not have permission to view students for this class', statusCode: 403 }
      });
    }

    // Diagnostic: count ALL inscriptions for this class regardless of status or admin
    // Helps detect orphaned records created before multi-tenancy was enforced
    const diagRow = await queryOne(
      `SELECT COUNT(*) AS total FROM class_inscriptions WHERE class_id = $1`,
      [classId]
    );
    console.log(
      `[CLASS_STUDENTS] class_id=${classId} ("${classRow.title}") — ` +
      `total inscriptions in DB (any status/admin): ${diagRow?.total ?? 0}`
    );

    // Main query: enrolled active students with full name, email, and per-student schedule
    const students = await queryAll(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         ci.enrollment_status,
         ci.enrolled_at,
         ci.days_of_week
       FROM users u
       INNER JOIN class_inscriptions ci ON u.id = ci.student_id
       WHERE ci.class_id = $1
         AND ci.enrollment_status = 'active'
         AND u.is_active = true
       ORDER BY u.last_name ASC, u.first_name ASC`,
      [classId]
    );

    console.log(
      `[CLASS_STUDENTS] class_id=${classId} — active+visible students returned: ${students.length}`
    );

    return res.status(200).json({
      data: students.map(s => ({
        id: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        email: s.email,
        enrollmentStatus: s.enrollment_status,
        enrolledAt: s.enrolled_at,
        daysOfWeek: Array.isArray(s.days_of_week)
          ? s.days_of_week
          : (s.days_of_week ? String(s.days_of_week).replace(/^\{|\}$/g, '').split(',').filter(Boolean) : [])
      }))
    });
  } catch (error) {
    console.error('[GET_CLASS_STUDENTS_ERROR]:', error);
    return res.status(500).json({
      error: { message: 'Failed to fetch class students', statusCode: 500 }
    });
  }
};

export default { getAdminClasses, createClass, getClasses, getClass, updateClass, deleteClass, getClassesByAcademy, getClassStudents };
