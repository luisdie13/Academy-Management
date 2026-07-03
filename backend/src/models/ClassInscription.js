import { query, queryOne, queryAll } from '../config/database.js';

/**
 * ClassInscription Model (aka user_classes)
 * Handles formal student-class enrollment with payment plan tracking AND personalized class details
 * Now also stores: modality, days_of_week, and class_time per student-class combination
 * This allows each student to have different schedules for the same global class
 */

export class ClassInscription {
  /**
   * Create a new class inscription with personalized details
   * @param {Object} inscriptionData - Inscription data including modality, days_of_week, class_time
   * @returns {Promise<Object>} Created inscription
   */
  static async create(inscriptionData) {
    const {
      classId,
      studentId,
      adminId,
      enrollmentStatus = 'active',
      studyPlan,
      paymentMode,
      pricePerClass,
      monthlyAmount,
      modality = null,
      daysOfWeek = null,
      classTime = null
    } = inscriptionData;

    const text = `
      INSERT INTO class_inscriptions (
        class_id, student_id, admin_id, enrollment_status,
        study_plan, payment_mode, price_per_class, monthly_amount,
        modality, days_of_week, class_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, class_id, student_id, admin_id, enrollment_status,
        study_plan, payment_mode, price_per_class, monthly_amount,
        modality, days_of_week, class_time,
        enrolled_at, created_at, updated_at
    `;

    const result = await query(text, [
      classId,
      studentId,
      adminId,
      enrollmentStatus,
      studyPlan,
      paymentMode,
      pricePerClass,
      monthlyAmount,
      modality,
      daysOfWeek ? `{${daysOfWeek.join(',')}}` : null, // PostgreSQL array format
      classTime
    ]);

    return result.rows[0];
  }

  /**
   * Find inscription by ID
   * @param {number} inscriptionId - Inscription ID
   * @returns {Promise<Object>} Inscription or null
   */
  static async findById(inscriptionId) {
    const text = `
      SELECT id, class_id, student_id, admin_id, enrollment_status,
        study_plan, payment_mode, price_per_class, monthly_amount,
        enrolled_at, created_at, updated_at
      FROM class_inscriptions
      WHERE id = $1
    `;

    const result = await queryOne(text, [inscriptionId]);
    return result || null;
  }

  /**
   * Find inscription by class and student
   * @param {number} classId - Class ID
   * @param {number} studentId - Student ID
   * @returns {Promise<Object>} Inscription or null
   */
  static async findByClassAndStudent(classId, studentId) {
    const text = `
      SELECT id, class_id, student_id, admin_id, enrollment_status,
        study_plan, payment_mode, price_per_class, monthly_amount,
        enrolled_at, created_at, updated_at
      FROM class_inscriptions
      WHERE class_id = $1 AND student_id = $2
    `;

    const result = await queryOne(text, [classId, studentId]);
    return result || null;
  }

  /**
   * Get all inscriptions for a class
   * @param {number} classId - Class ID
   * @returns {Promise<Array>} Array of inscriptions
   */
  static async getByClass(classId) {
    const text = `
      SELECT ci.id, ci.class_id, ci.student_id, ci.admin_id, ci.enrollment_status,
        ci.study_plan, ci.payment_mode, ci.price_per_class, ci.monthly_amount,
        ci.enrolled_at, ci.created_at, ci.updated_at,
        u.first_name, u.last_name, u.email
      FROM class_inscriptions ci
      JOIN users u ON ci.student_id = u.id
      WHERE ci.class_id = $1
      ORDER BY ci.enrolled_at DESC
    `;

    const result = await queryAll(text, [classId]);
    return result || [];
  }

  /**
   * Get all inscriptions for a student
   * @param {number} studentId - Student ID
   * @returns {Promise<Array>} Array of inscriptions
   */
  static async getByStudent(studentId) {
    const text = `
      SELECT ci.id, ci.class_id, ci.student_id, ci.admin_id, ci.enrollment_status,
        ci.study_plan, ci.payment_mode, ci.price_per_class, ci.monthly_amount,
        ci.days_of_week, ci.modality, ci.class_time,
        ci.enrolled_at, ci.created_at, ci.updated_at,
        c.title, c.description, c.instructor, c.start_time, c.end_time
      FROM class_inscriptions ci
      JOIN classes c ON ci.class_id = c.id
      WHERE ci.student_id = $1 AND ci.enrollment_status = 'active'
      ORDER BY c.start_time ASC
    `;

    const result = await queryAll(text, [studentId]);
    return result || [];
  }

  /**
   * Get all inscriptions for an admin
   * @param {number} adminId - Admin ID
   * @returns {Promise<Array>} Array of inscriptions
   */
  static async getByAdmin(adminId) {
    const text = `
      SELECT ci.id, ci.class_id, ci.student_id, ci.admin_id, ci.enrollment_status,
        ci.study_plan, ci.payment_mode, ci.price_per_class, ci.monthly_amount,
        ci.enrolled_at, ci.created_at, ci.updated_at,
        c.title, c.instructor,
        u.first_name, u.last_name, u.email
      FROM class_inscriptions ci
      JOIN classes c ON ci.class_id = c.id
      JOIN users u ON ci.student_id = u.id
      WHERE ci.admin_id = $1
      ORDER BY c.title ASC, u.last_name ASC
    `;

    const result = await queryAll(text, [adminId]);
    return result || [];
  }

  /**
   * Update inscription
   * @param {number} inscriptionId - Inscription ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated inscription
   */
  static async update(inscriptionId, updates) {
    const allowedFields = [
      'enrollment_status',
      'study_plan',
      'payment_mode',
      'price_per_class',
      'monthly_amount',
      'modality',
      'class_time'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'days_of_week' && value !== undefined) {
        // PostgreSQL array literal
        fields.push(`days_of_week = $${paramCount}`);
        values.push(Array.isArray(value) ? `{${value.join(',')}}` : null);
        paramCount++;
      } else if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.findById(inscriptionId);
    }

    values.push(inscriptionId);

    const text = `
      UPDATE class_inscriptions
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, class_id, student_id, admin_id, enrollment_status,
        study_plan, payment_mode, price_per_class, monthly_amount,
        days_of_week, modality, class_time,
        enrolled_at, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Update days_of_week for a student-class inscription (by classId + studentId)
   * @param {number} classId
   * @param {number} studentId
   * @param {string[]} daysOfWeek
   * @returns {Promise<Object>} Updated inscription
   */
  static async updateSchedule(classId, studentId, daysOfWeek) {
    const text = `
      UPDATE class_inscriptions
      SET days_of_week = $1, updated_at = NOW()
      WHERE class_id = $2 AND student_id = $3 AND enrollment_status = 'active'
      RETURNING id, class_id, student_id, days_of_week, enrollment_status
    `;
    const result = await query(text, [
      Array.isArray(daysOfWeek) ? `{${daysOfWeek.join(',')}}` : '{}',
      classId,
      studentId
    ]);
    return result.rows[0] || null;
  }

  /**
   * Delete inscription (soft delete via enrollment_status)
   * @param {number} inscriptionId - Inscription ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(inscriptionId) {
    return this.update(inscriptionId, { enrollment_status: 'inactive' });
  }

  static validatePaymentPlan(studyPlan, paymentMode) {
    const rules = {
      'weekly':    ['postpaid'],
      'monthly':   ['prepaid', 'postpaid'],
      'quarterly': ['prepaid']
    };
    return rules[studyPlan]?.includes(paymentMode) ?? false;
  }

  static getAllowedPaymentModes(studyPlan) {
    const rules = {
      'weekly':    ['postpaid'],
      'monthly':   ['prepaid', 'postpaid'],
      'quarterly': ['prepaid']
    };
    return rules[studyPlan] || [];
  }
}

export default ClassInscription;
