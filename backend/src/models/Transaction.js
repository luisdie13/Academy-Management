import { query, queryOne, queryAll } from '../config/database.js';

/**
 * Transaction Model
 * Handles all database operations for immutable transaction records
 * Transactions are append-only (never updated), only created
 */

export class Transaction {
  /**
   * Create a new transaction (immutable record)
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  static async create(transactionData) {
    const {
      invoiceId = null,
      studentId,
      adminId,
      type,
      amount,
      description = null,
      paymentMethod = null,
      referenceNumber = null
    } = transactionData;

    const text = `
      INSERT INTO transactions (
        invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
    `;

    const result = await query(text, [
      invoiceId,
      studentId,
      adminId,
      type,
      amount,
      description,
      paymentMethod,
      referenceNumber
    ]);

    return result.rows[0];
  }

  /**
   * Find transaction by ID
   * @param {number} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction object or null
   */
  static async findById(transactionId) {
    const text = `
      SELECT id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
      FROM transactions
      WHERE id = $1
    `;

    const result = await queryOne(text, [transactionId]);
    return result || null;
  }

  /**
   * Get all transactions for a student
   * @param {number} studentId - Student ID
   * @param {string} type - Transaction type filter ('charge' | 'payment' | 'credit' | null for all)
   * @returns {Promise<Array>} Array of transactions
   */
  static async getByStudent(studentId, type = null) {
    let text = `
      SELECT id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
      FROM transactions
      WHERE student_id = $1
    `;

    const params = [studentId];

    if (type) {
      text += ` AND type = $2`;
      params.push(type);
    }

    text += ` ORDER BY created_at DESC`;

    const result = await queryAll(text, params);
    return result || [];
  }

  /**
   * Get all transactions for an invoice
   * @param {number} invoiceId - Invoice ID
   * @returns {Promise<Array>} Array of transactions
   */
  static async getByInvoice(invoiceId) {
    const text = `
      SELECT id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
      FROM transactions
      WHERE invoice_id = $1
      ORDER BY created_at DESC
    `;

    const result = await queryAll(text, [invoiceId]);
    return result || [];
  }

  /**
   * Get all transactions for an admin
   * @param {number} adminId - Admin ID
   * @param {string} type - Transaction type filter ('charge' | 'payment' | 'credit' | null for all)
   * @returns {Promise<Array>} Array of transactions
   */
  static async getByAdmin(adminId, type = null) {
    let text = `
      SELECT id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
      FROM transactions
      WHERE admin_id = $1
    `;

    const params = [adminId];

    if (type) {
      text += ` AND type = $2`;
      params.push(type);
    }

    text += ` ORDER BY created_at DESC`;

    const result = await queryAll(text, params);
    return result || [];
  }

  /**
   * Get transactions within a date range for an admin
   * @param {number} adminId - Admin ID
   * @param {string} startDate - ISO format date (YYYY-MM-DD)
   * @param {string} endDate - ISO format date (YYYY-MM-DD)
   * @returns {Promise<Array>} Array of transactions
   */
  static async getByAdminAndDateRange(adminId, startDate, endDate) {
    const text = `
      SELECT id, invoice_id, student_id, admin_id, type, amount, description, payment_method, reference_number, created_at
      FROM transactions
      WHERE admin_id = $1 AND DATE(created_at) BETWEEN $2 AND $3
      ORDER BY created_at DESC
    `;

    const result = await queryAll(text, [adminId, startDate, endDate]);
    return result || [];
  }

  /**
   * Get total amount paid for an invoice
   * @param {number} invoiceId - Invoice ID
   * @returns {Promise<number>} Total amount paid
   */
  static async getTotalPaidForInvoice(invoiceId) {
    const text = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE invoice_id = $1 AND type = 'payment'
    `;

    const result = await queryOne(text, [invoiceId]);
    return result ? parseFloat(result.total) : 0;
  }

  /**
   * Get total amount charged for a student in a period
   * @param {number} studentId - Student ID
   * @param {string} startDate - ISO format date
   * @param {string} endDate - ISO format date
   * @returns {Promise<number>} Total charged
   */
  static async getTotalChargedForStudentInPeriod(studentId, startDate, endDate) {
    const text = `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE student_id = $1 AND type = 'charge' AND DATE(created_at) BETWEEN $2 AND $3
    `;

    const result = await queryOne(text, [studentId, startDate, endDate]);
    return result ? parseFloat(result.total) : 0;
  }
}

export default Transaction;
