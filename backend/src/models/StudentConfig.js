import { query, queryOne, transaction } from '../config/database.js';

/**
 * StudentConfig Model
 * Handles all database operations for student payment configuration
 */

export class StudentConfig {
  /**
   * Create student configuration record
   * Usually called when a new student is created
   * @param {Object} configData - Configuration data
   * @returns {Promise<Object>} Created config
   */
  static async create(configData) {
    const {
      studentId,
      paymentMode = 'postpaid',
      pricePerClass = 0,
      monthlyFixedAmount = null,
      creditBalance = 0.00
    } = configData;

    const text = `
      INSERT INTO student_config (student_id, payment_mode, price_per_class, monthly_fixed_amount, credit_balance)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, student_id, payment_mode, price_per_class, monthly_fixed_amount, credit_balance, created_at, updated_at
    `;

    const result = await query(text, [studentId, paymentMode, pricePerClass, monthlyFixedAmount, creditBalance]);
    return result.rows[0];
  }

  /**
   * Find student config by student ID
   * @param {number} studentId - Student user ID
   * @returns {Promise<Object>} Config object or null
   */
  static async findByStudentId(studentId) {
    const text = `
      SELECT id, student_id, payment_mode, price_per_class, monthly_fixed_amount, credit_balance, created_at, updated_at
      FROM student_config
      WHERE student_id = $1
    `;

    const result = await queryOne(text, [studentId]);
    return result || null;
  }

  /**
   * Update student configuration
   * @param {number} studentId - Student ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated config
   */
  static async update(studentId, updates) {
        const allowedFields = ['payment_mode', 'price_per_class', 'monthly_fixed_amount', 'credit_balance'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        
        if (['price_per_class', 'monthly_fixed_amount', 'credit_balance'].includes(key)) {
          if (value !== null && value !== undefined) {
            values.push(Number(value));
          } else {
            values.push(null);
          }
        } else {
          values.push(value);
        }
        
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.findByStudentId(studentId);
    }

    values.push(studentId);

    const text = `
      UPDATE student_config
      SET ${fields.join(', ')}
      WHERE student_id = $${paramCount}
      RETURNING id, student_id, payment_mode, price_per_class, monthly_fixed_amount, credit_balance, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Delete student configuration
   * @param {number} studentId - Student ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(studentId) {
    const text = `
      DELETE FROM student_config
      WHERE student_id = $1
      RETURNING id
    `;

    const result = await queryOne(text, [studentId]);
    return !!result;
  }
}

export default StudentConfig;
