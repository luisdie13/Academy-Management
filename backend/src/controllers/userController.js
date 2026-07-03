import { transaction, queryAll, queryOne } from '../config/database.js';
import User from '../models/User.js';
import StudentConfig from '../models/StudentConfig.js';
import { ClassInscription } from '../models/ClassInscription.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * User Controller
 * Handles HTTP requests for user management
 */

/**
 * Helper: Validate and process class registrations
 * Ensures multi-tenant security: all classes must belong to the admin
 */
async function validateAndProcessClasses(selectedClassIds, adminId, studentId, isCreate = true) {
  if (!selectedClassIds || !Array.isArray(selectedClassIds) || selectedClassIds.length === 0) {
    if (!isCreate) {
      // On update with empty list: deactivate all existing inscriptions for this student under this admin
      await queryOne(
        `UPDATE class_inscriptions ci
         SET enrollment_status = 'inactive', updated_at = CURRENT_TIMESTAMP
         FROM classes c
         WHERE ci.class_id = c.id AND c.admin_id = $1 AND ci.student_id = $2`,
        [adminId, studentId]
      );
    }
    return { success: true, classIds: [] };
  }

  try {
    // Verify all requested classes belong to this admin (multi-tenant security)
    const validClasses = await queryAll(
      `SELECT id FROM classes WHERE admin_id = $1 AND id = ANY($2::int[]) AND is_active = true`,
      [adminId, selectedClassIds]
    );

    if (validClasses.length !== selectedClassIds.length) {
      const validIds = new Set(validClasses.map(c => c.id));
      const invalid = selectedClassIds.find(id => !validIds.has(id));
      return {
        success: false,
        error: `Class ID ${invalid} does not belong to your academy or is not active`
      };
    }

    if (!isCreate) {
      // Deactivate all existing inscriptions not in the new list
      await queryOne(
        `UPDATE class_inscriptions ci
         SET enrollment_status = 'inactive', updated_at = CURRENT_TIMESTAMP
         FROM classes c
         WHERE ci.class_id = c.id AND c.admin_id = $1 AND ci.student_id = $2
           AND ci.class_id <> ALL($3::int[])`,
        [adminId, studentId, selectedClassIds]
      );
    }

    // Upsert active inscriptions for each selected class
    for (const classId of selectedClassIds) {
      await queryOne(
        `INSERT INTO class_inscriptions (class_id, student_id, admin_id, enrollment_status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (class_id, student_id) DO UPDATE
           SET enrollment_status = 'active', updated_at = CURRENT_TIMESTAMP`,
        [classId, studentId, adminId]
      );
    }

    return { success: true, classIds: selectedClassIds };
  } catch (error) {
    console.error('Error validating/processing classes:', error);
    return { success: false, error: 'Error processing class registrations' };
  }
}

/**
 * GET /api/users/students
 * List all students belonging to the authenticated admin, with optional status filter.
 */
export const getStudents = async (req, res, next) => {
  try {
    const { status } = req.query;
    const adminId = req.user.id;

    if (status && !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        error: {
          message: 'Invalid status filter. Must be "active" or "inactive"',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    let text = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.phone, u.status,
        u.is_active, u.created_at, u.must_change_password,
        u.birthday, u.dpi, u.department, u.municipality,
        u.guardian_name, u.guardian_phone, u.guardian_email, u.guardian_relationship,
        sc.payment_mode, sc.price_per_class, sc.monthly_fixed_amount, sc.class_modality
      FROM users u
      INNER JOIN student_admin_association saa ON u.id = saa.student_id AND saa.admin_id = $1
      LEFT JOIN student_config sc ON u.id = sc.student_id
      WHERE u.role = 'student' AND u.is_active = true
    `;
    const params = [adminId];

    if (status === 'active') {
      text += ` AND u.status = 'active'`;
    } else if (status === 'inactive') {
      text += ` AND u.status = 'inactive'`;
    }

    text += ` ORDER BY u.created_at DESC`;

    const students = await queryAll(text, params);

    res.status(200).json({
      success: true,
      data: students.map(student => ({
        id: student.id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        phone: student.phone,
        status: student.status,
        isActive: student.is_active,
        createdAt: student.created_at,
        mustChangePassword: student.must_change_password,
        birthday: student.birthday
          ? (student.birthday instanceof Date
              ? student.birthday.toISOString().split('T')[0]
              : String(student.birthday).split('T')[0])
          : null,
        dpi: student.dpi || null,
        department: student.department || null,
        municipality: student.municipality || null,
        guardianName: student.guardian_name || null,
        guardianPhone: student.guardian_phone || null,
        guardianEmail: student.guardian_email || null,
        guardianRelationship: student.guardian_relationship || null,
        paymentMode: student.payment_mode || 'postpaid',
        classPrice: student.price_per_class || 0,
        monthlyFixedAmount: student.monthly_fixed_amount || null,
        classModality: student.class_modality || null
      })),
      total: students.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve students',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * POST /api/users/students
 * Create a new student with payment configuration
 * Supports optional password field: if not provided, generates a secure random password
 */
export const createStudent = async (req, res, next) => {
  try {
    const validated = req.validated;
    const adminId = req.user.id;

    // Check if email already exists
    const emailExists = await User.emailExists(validated.email);
    if (emailExists) {
      return res.status(409).json({
        error: {
          message: 'Email already exists',
          statusCode: 409,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Generate temporary password or use the one provided
    let tempPassword;
    if (validated.password) {
      // Admin provided a manual password
      tempPassword = validated.password;
    } else {
      // Generate a secure random password
      tempPassword = generateSecurePassword();
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);


    let student;
    let studentConfig;

    try {
      // Execute as transaction for ACID compliance
      const result = await transaction(async (client) => {
        // Admin-created accounts require a password change on first login
        const userText = `
          INSERT INTO users (
            email, password_hash, first_name, last_name, role, status, phone, must_change_password,
            birthday, dpi, department, municipality,
            guardian_name, guardian_phone, guardian_email, guardian_relationship
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id, email, first_name, last_name, role, status, phone, must_change_password, is_active, created_at, updated_at
        `;
        const userResult = await client.query(userText, [
          validated.email,
          passwordHash,
          validated.firstName,
          validated.lastName,
          'student',
          validated.status || 'active',
          validated.phone || null,
          true,
          validated.birthday || null,
          validated.dpi || null,
          validated.department || null,
          validated.municipality || null,
          validated.guardianName || null,
          validated.guardianPhone || null,
          validated.guardianEmail || null,
          validated.guardianRelationship || null,
        ]);
        const newStudent = userResult.rows[0];

        // Create student config
        const configText = `
          INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, class_modality)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, student_id, payment_mode, price_per_class, monthly_fixed_amount, class_modality, created_at, updated_at
        `;
        const configResult = await client.query(configText, [
          newStudent.id,
          validated.paymentMode || 'postpaid',
          validated.classPrice !== undefined ? Number(validated.classPrice) : 0,
          validated.monthlyFixedAmount !== undefined && validated.monthlyFixedAmount !== null
            ? Number(validated.monthlyFixedAmount)
            : null,
          validated.classModality || null,
        ]);
        const newConfig = configResult.rows[0];

        // Register the admin-student ownership so future queries respect multi-tenancy
        await client.query(
          `INSERT INTO student_admin_association (admin_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (admin_id, student_id) DO NOTHING`,
          [adminId, newStudent.id]
        );

        return { student: newStudent, config: newConfig };
      });

      student = result.student;
      studentConfig = result.config;
    } catch (transactionError) {
      console.error('Error creating student:', transactionError.message);
      throw transactionError;
    }

    let classRegistrationResult = { success: true, classIds: [] };
    if (validated.selectedClassIds && Array.isArray(validated.selectedClassIds) && validated.selectedClassIds.length > 0) {
      classRegistrationResult = await validateAndProcessClasses(
        validated.selectedClassIds,
        adminId,
        student.id,
        true
      );

      if (!classRegistrationResult.success) {
        console.error('Class registration error:', classRegistrationResult.error);
      }
    }

    res.status(201).json({
      message: 'Student created successfully',
      data: {
        id: student.id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        phone: student.phone,
        role: student.role,
        status: student.status,
        isActive: student.is_active,
        mustChangePassword: student.must_change_password,
        createdAt: student.created_at,
        updatedAt: student.updated_at,
        config: {
          id: studentConfig.id,
          studentId: studentConfig.student_id,
          paymentMode: studentConfig.payment_mode,
          classPrice: studentConfig.price_per_class,
          monthlyFixedAmount: studentConfig.monthly_fixed_amount,
          createdAt: studentConfig.created_at,
          updatedAt: studentConfig.updated_at
        },
        enrolledClasses: classRegistrationResult.classIds || [],
        tempPassword: tempPassword
      }
    });
  } catch (error) {
    console.error('Error creating student:', error);
    if (error.code === '23505') {
      const constraint = error.constraint || '';
      let message = 'An account with this information already exists';
      if (constraint.includes('dpi')) message = 'DPI already registered by another account';
      else if (constraint.includes('email')) message = 'Email already exists';
      return res.status(409).json({
        error: { message, statusCode: 409, timestamp: new Date().toISOString() }
      });
    }
    res.status(500).json({
      error: {
        message: 'Failed to create student',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

function generateSecurePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;

  const randomByte = () => crypto.randomBytes(1)[0];
  const pick = (charset) => charset[randomByte() % charset.length];

  // Guarantee at least one character of each required class
  const required = [pick(uppercase), pick(lowercase), pick(numbers), pick(special)];

  // Fill remaining positions with cryptographically random characters
  const remaining = Array.from({ length: 8 }, () => pick(allChars));

  // Fisher-Yates shuffle using crypto.randomBytes to avoid bias
  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomByte() % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

/**
 * GET /api/users/students/:id
 * Get detailed student profile with payment configuration.
 * Enforces admin ownership — admins can only read their own students.
 */
export const getStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const ownershipCheck = await queryOne(
      `SELECT 1 FROM student_admin_association WHERE admin_id = $1 AND student_id = $2`,
      [adminId, parseInt(id)]
    );
    if (!ownershipCheck) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    const student = await User.getStudentWithConfig(parseInt(id));

    if (!student) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      data: {
        id: student.id,
        email: student.email,
        firstName: student.first_name,
        lastName: student.last_name,
        phone: student.phone,
        status: student.status,
        isActive: student.is_active,
        mustChangePassword: student.must_change_password,
        createdAt: student.created_at,
        updatedAt: student.updated_at,
        config: {
          id: student.config_id,
          studentId: student.student_id,
          paymentMode: student.payment_mode,
          classPrice: student.price_per_class,
          monthlyFixedAmount: student.monthly_fixed_amount,
          createdAt: student.config_created_at,
          updatedAt: student.config_updated_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch student',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * PUT /api/users/students/:id
 * Update student profile and/or payment configuration.
 * Enforces admin ownership — admins can only update their own students.
 */
export const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = req.validated;
    const studentId = parseInt(id);
    const adminId = req.user.id;

    const ownershipCheck = await queryOne(
      `SELECT 1 FROM student_admin_association WHERE admin_id = $1 AND student_id = $2`,
      [adminId, studentId]
    );
    if (!ownershipCheck) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Separate user fields from config fields using explicit maps to avoid wrong snake_case
    const userFields = {};
    const configFields = {};

    const USER_FIELD_MAP = {
      firstName: 'first_name', lastName: 'last_name', phone: 'phone', status: 'status',
      password: 'password', mustChangePassword: 'must_change_password',
      birthday: 'birthday', dpi: 'dpi', department: 'department', municipality: 'municipality',
      guardianName: 'guardian_name', guardianPhone: 'guardian_phone',
      guardianEmail: 'guardian_email', guardianRelationship: 'guardian_relationship',
    };
    const CONFIG_FIELD_MAP = {
      paymentMode: 'payment_mode',
      classPrice: 'price_per_class',
      monthlyFixedAmount: 'monthly_fixed_amount',
      classModality: 'class_modality',
    };

    for (const [key, value] of Object.entries(validated)) {
      if (USER_FIELD_MAP[key] !== undefined) {
        userFields[USER_FIELD_MAP[key]] = value;
      } else if (CONFIG_FIELD_MAP[key] !== undefined) {
        configFields[CONFIG_FIELD_MAP[key]] = value;
      }
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (userFields.password) {
      userFields.password_hash = await bcrypt.hash(userFields.password, 12);
      delete userFields.password;
      userFields.must_change_password = true;
    }

    let updatedStudent = student;
    if (Object.keys(userFields).length > 0) {
      updatedStudent = await User.update(studentId, userFields);
    }

    // Update config fields if any
    let updatedConfig = await StudentConfig.findByStudentId(studentId);
    if (Object.keys(configFields).length > 0) {
      updatedConfig = await StudentConfig.update(studentId, configFields);
    }

    let classRegistrationResult = { success: true, classIds: [] };
    if (validated.selectedClassIds && Array.isArray(validated.selectedClassIds)) {
      classRegistrationResult = await validateAndProcessClasses(
        validated.selectedClassIds,
        adminId,
        studentId,
        false
      );

      if (!classRegistrationResult.success) {
        console.error('Class registration error during update:', classRegistrationResult.error);
      }
    }

    res.status(200).json({
      message: 'Student updated successfully',
      data: {
        id: updatedStudent.id,
        email: updatedStudent.email,
        firstName: updatedStudent.first_name,
        lastName: updatedStudent.last_name,
        phone: updatedStudent.phone,
        status: updatedStudent.status,
        isActive: updatedStudent.is_active,
        mustChangePassword: updatedStudent.must_change_password,
        createdAt: updatedStudent.created_at,
        updatedAt: updatedStudent.updated_at,
        config: {
          id: updatedConfig.id,
          studentId: updatedConfig.student_id,
          paymentMode: updatedConfig.payment_mode,
          classPrice: updatedConfig.price_per_class,
          monthlyFixedAmount: updatedConfig.monthly_fixed_amount,
          classModality: updatedConfig.class_modality || null,
          createdAt: updatedConfig.created_at,
          updatedAt: updatedConfig.updated_at
        },
        enrolledClasses: classRegistrationResult.classIds || []
      }
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update student',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * DELETE /api/users/students/:id
 * Soft-delete a student (marks as inactive).
 * Enforces admin ownership — admins can only delete their own students.
 */
export const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const studentId = parseInt(id);
    const adminId = req.user.id;

    const ownershipCheck = await queryOne(
      `SELECT 1 FROM student_admin_association WHERE admin_id = $1 AND student_id = $2`,
      [adminId, studentId]
    );
    if (!ownershipCheck) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({
        error: {
          message: 'Student not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Delete student (soft delete)
    const deleted = await User.delete(studentId);

    if (!deleted) {
      return res.status(500).json({
        error: {
          message: 'Failed to delete student',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      message: 'Student deleted successfully',
      data: {
        id: studentId,
        deleted: true
      }
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({
      error: {
        message: 'Failed to delete student',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * PUT /api/users/profile
 * Update the authenticated user's own profile
 * Users can update: firstName, lastName, phone, password
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const validated = req.validated;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    const userFields = {};

    const PROFILE_FIELD_MAP = {
      email: 'email',
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      password: 'password',
      birthday: 'birthday',
      dpi: 'dpi',
      department: 'department',
      municipality: 'municipality',
      guardianName: 'guardian_name',
      guardianPhone: 'guardian_phone',
      guardianEmail: 'guardian_email',
      guardianRelationship: 'guardian_relationship',
    };

    for (const [key, dbKey] of Object.entries(PROFILE_FIELD_MAP)) {
      if (validated[key] !== undefined) {
        userFields[dbKey] = validated[key] !== null ? validated[key] : null;
      }
    }

    // classModality lives in student_config, not users — handle separately
    let updatedClassModality = null;
    if (validated.classModality !== undefined && user.role === 'student') {
      const configUpdate = await StudentConfig.update(userId, { class_modality: validated.classModality || null });
      updatedClassModality = configUpdate?.class_modality || null;
    }

    // If email is changing, ensure it isn't already taken by another user
    if (userFields.email && userFields.email.toLowerCase() !== user.email.toLowerCase()) {
      userFields.email = userFields.email.toLowerCase().trim();
      const conflict = await queryOne(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [userFields.email, userId]
      );
      if (conflict) {
        return res.status(409).json({
          error: { message: 'Email already in use by another account', statusCode: 409 }
        });
      }
    } else {
      delete userFields.email;
    }

    if (userFields.password) {
      userFields.password_hash = await bcrypt.hash(userFields.password, 12);
      delete userFields.password;
      userFields.must_change_password = false;
    }

    let updatedUser = user;
    if (Object.keys(userFields).length > 0) {
      updatedUser = await User.update(userId, userFields);
    }

     res.status(200).json({
       message: 'Profile updated successfully',
       data: {
         id: updatedUser.id,
         email: updatedUser.email,
         firstName: updatedUser.first_name,
         lastName: updatedUser.last_name,
         phone: updatedUser.phone,
         role: updatedUser.role,
         status: updatedUser.status,
         isActive: updatedUser.is_active,
         mustChangePassword: updatedUser.must_change_password,
         createdAt: updatedUser.created_at,
         updatedAt: updatedUser.updated_at,
         birthday: updatedUser.birthday
           ? (updatedUser.birthday instanceof Date
               ? updatedUser.birthday.toISOString().split('T')[0]
               : String(updatedUser.birthday).split('T')[0])
           : null,
         dpi: updatedUser.dpi || null,
         department: updatedUser.department || null,
         municipality: updatedUser.municipality || null,
         guardianName: updatedUser.guardian_name || null,
         guardianPhone: updatedUser.guardian_phone || null,
         guardianEmail: updatedUser.guardian_email || null,
         guardianRelationship: updatedUser.guardian_relationship || null,
         classModality: updatedClassModality,
       }
     });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      error: {
        message: 'Failed to update profile',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

export default { getStudents, createStudent, getStudent, updateStudent, deleteStudent, updateProfile };
