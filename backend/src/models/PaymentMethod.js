import { query, queryOne, queryAll } from '../config/database.js';

/**
 * PaymentMethod Model
 * Handles all database operations for payment methods (bank accounts, payment gateways)
 */

export class PaymentMethod {
  /**
   * Create a new payment method
   * @param {Object} methodData - Payment method data
   * @returns {Promise<Object>} Created payment method
   */
  static async create(methodData) {
    const {
      adminId,
      methodName,
      accountNumber = null,
      accountHolder = null,
      bankName = null,
      additionalInfo = null,
      isActive = true
    } = methodData;

    const text = `
      INSERT INTO payment_methods (admin_id, method_name, account_number, account_holder, bank_name, additional_info, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, admin_id, method_name, account_number, account_holder, bank_name, additional_info, is_active, created_at, updated_at
    `;

    const result = await query(text, [
      adminId,
      methodName,
      accountNumber,
      accountHolder,
      bankName,
      additionalInfo,
      isActive
    ]);

    return result.rows[0];
  }

  /**
   * Find payment method by ID
   * @param {number} methodId - Payment method ID
   * @returns {Promise<Object>} Payment method object or null
   */
  static async findById(methodId) {
    const text = `
      SELECT id, admin_id, method_name, account_number, account_holder, bank_name, additional_info, is_active, created_at, updated_at
      FROM payment_methods
      WHERE id = $1
    `;

    const result = await queryOne(text, [methodId]);
    return result || null;
  }

  /**
   * Get all active payment methods for an admin
   * @param {number} adminId - Admin ID
   * @param {boolean} activeOnly - Get only active methods
   * @returns {Promise<Array>} Array of payment methods
   */
  static async getByAdmin(adminId, activeOnly = true) {
    let text = `
      SELECT id, admin_id, method_name, account_number, account_holder, bank_name, additional_info, is_active, created_at, updated_at
      FROM payment_methods
      WHERE admin_id = $1
    `;

    const params = [adminId];

    if (activeOnly) {
      text += ` AND is_active = true`;
    }

    text += ` ORDER BY created_at ASC`;

    const result = await queryAll(text, params);
    return result || [];
  }

  /**
   * Update payment method
   * @param {number} methodId - Payment method ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated payment method
   */
  static async update(methodId, updates) {
    const allowedFields = [
      'method_name',
      'account_number',
      'account_holder',
      'bank_name',
      'additional_info',
      'is_active'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.findById(methodId);
    }

    values.push(methodId);

    const text = `
      UPDATE payment_methods
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, admin_id, method_name, account_number, account_holder, bank_name, additional_info, is_active, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Delete payment method
   * @param {number} methodId - Payment method ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(methodId) {
    const text = `
      DELETE FROM payment_methods
      WHERE id = $1
      RETURNING id
    `;

    const result = await queryOne(text, [methodId]);
    return !!result;
  }
}

export default PaymentMethod;
