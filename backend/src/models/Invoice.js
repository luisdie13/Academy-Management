import { query, queryOne, queryAll } from '../config/database.js';

/**
 * Invoice Model
 * Handles all database operations for invoices (monthly billing)
 */

export class Invoice {
  /**
   * Create a new invoice
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} Created invoice
   */
  static async create(invoiceData) {
    const {
      adminId,
      studentId,
      invoiceMonth,
      status = 'pending',
      subtotal = 0,
      creditApplied = 0,
      totalAmount = 0,
      notes = null,
      issuedAt = null,
      dueDate = null
    } = invoiceData;

    const text = `
      INSERT INTO invoices (
        admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
        total_amount, notes, issued_at, due_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
                total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
    `;

    const result = await query(text, [
      adminId,
      studentId,
      invoiceMonth,
      status,
      subtotal,
      creditApplied,
      totalAmount,
      notes,
      issuedAt,
      dueDate
    ]);

    return result.rows[0];
  }

  /**
   * Find invoice by ID
   * @param {number} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice object or null
   */
  static async findById(invoiceId) {
    const text = `
      SELECT id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
             total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
      FROM invoices
      WHERE id = $1
    `;

    const result = await queryOne(text, [invoiceId]);
    return result || null;
  }

  /**
   * Find invoice by admin, student, and month (unique constraint)
   * @param {number} adminId - Admin ID
   * @param {number} studentId - Student ID
   * @param {string} invoiceMonth - Month in YYYY-MM format
   * @returns {Promise<Object>} Invoice or null
   */
  static async findByMonthly(adminId, studentId, invoiceMonth) {
    const text = `
      SELECT id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
             total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
      FROM invoices
      WHERE admin_id = $1 AND student_id = $2 AND invoice_month = $3
    `;

    const result = await queryOne(text, [adminId, studentId, invoiceMonth]);
    return result || null;
  }

  /**
   * Get invoices for a student by status
   * @param {number} studentId - Student ID
   * @param {string} status - Status filter ('pending' | 'paid' | null for all)
   * @returns {Promise<Array>} Array of invoices
   */
  static async getByStudent(studentId, status = null) {
    let text = `
      SELECT id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
             total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
      FROM invoices
      WHERE student_id = $1
    `;

    const params = [studentId];

    if (status) {
      text += ` AND status = $2`;
      params.push(status);
    }

    text += ` ORDER BY invoice_month DESC`;

    const result = await queryAll(text, params);
    return result || [];
  }

  /**
   * Get invoices for an admin by status
   * @param {number} adminId - Admin ID
   * @param {string} status - Status filter ('pending' | 'paid' | null for all)
   * @returns {Promise<Array>} Array of invoices
   */
  static async getByAdmin(adminId, status = null) {
    let text = `
      SELECT id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
             total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
      FROM invoices
      WHERE admin_id = $1
    `;

    const params = [adminId];

    if (status) {
      text += ` AND status = $2`;
      params.push(status);
    }

    text += ` ORDER BY invoice_month DESC`;

    const result = await queryAll(text, params);
    return result || [];
  }

  /**
   * Update invoice
   * @param {number} invoiceId - Invoice ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated invoice
   */
  static async update(invoiceId, updates) {
    const allowedFields = [
      'status',
      'subtotal',
      'credit_applied',
      'total_amount',
      'notes',
      'pdf_path',
      'due_date',
      'paid_at'
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
      return this.findById(invoiceId);
    }

    values.push(invoiceId);

    const text = `
      UPDATE invoices
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
                total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
    `;

    const result = await query(text, values);
    return result.rows[0] || null;
  }

  /**
   * Get invoices for a month (admin view)
   * @param {number} adminId - Admin ID
   * @param {string} month - Month in YYYY-MM format
   * @returns {Promise<Array>} Array of invoices
   */
  static async getByMonth(adminId, month) {
    const text = `
      SELECT id, admin_id, student_id, invoice_month, status, subtotal, credit_applied, 
             total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
      FROM invoices
      WHERE admin_id = $1 AND invoice_month = $2
      ORDER BY student_id ASC
    `;

    const result = await queryAll(text, [adminId, month]);
    return result || [];
  }

  /**
   * Delete invoice (typically not used, but available for soft delete scenarios)
   * @param {number} invoiceId - Invoice ID
   * @returns {Promise<boolean>} True if deleted
   */
  static async delete(invoiceId) {
    const text = `
      DELETE FROM invoices
      WHERE id = $1
      RETURNING id
    `;

    const result = await queryOne(text, [invoiceId]);
    return !!result;
  }
}

export default Invoice;
