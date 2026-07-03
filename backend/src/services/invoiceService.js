import { transaction, queryAll } from '../config/database.js';
import Invoice from '../models/Invoice.js';
import StudentConfig from '../models/StudentConfig.js';
import Attendance from '../models/Attendance.js';

/**
 * Invoice Service
 * Handles complex business logic for invoice generation and billing automation
 * Implements ACID transactions for postpaid/prepaid payment modes
 */

/**
 * Generate or update the invoice for a given month.
 * postpaid: total = attended classes × price_per_class
 * prepaid:  total = monthly_fixed_amount − credit_balance
 *
 * @param {Object} invoiceData - { adminId, studentId, invoiceMonth }
 * @returns {Promise<Object>} Created or updated invoice record
 */
export const generateMonthlyInvoice = async (invoiceData) => {
  const { adminId, studentId, invoiceMonth } = invoiceData;

  try {
    const result = await transaction(async (client) => {
      // Step 1: Load student payment configuration
      const configText = `
        SELECT id, student_id, payment_mode, price_per_class, monthly_fixed_amount, credit_balance
        FROM student_config
        WHERE student_id = $1
      `;
      const configResult = await client.query(configText, [studentId]);
      const studentConfig = configResult.rows[0];

      if (!studentConfig) {
        throw new Error('Student configuration not found');
      }

      // Step 2: Resolve month boundaries as DATE strings
      const monthStart = new Date(`${invoiceMonth}-01`);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      const monthEndStr = monthEnd.toISOString().split('T')[0];

      // Step 3: Fetch attendance records for the month (a.class_date = the day attendance was taken)
      const attendanceText = `
        SELECT a.id, a.status
        FROM attendance a
        JOIN classes c ON a.class_id = c.id
        WHERE a.student_id = $1
          AND a.class_date >= $2::date
          AND a.class_date <= $3::date
      `;
      const attendanceResult = await client.query(attendanceText, [studentId, monthStartStr, monthEndStr]);
      const attendanceRecords = attendanceResult.rows;

      let subtotal = 0;
      let creditApplied = 0;

      if (studentConfig.payment_mode === 'postpaid') {
        const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
        subtotal = parseFloat(studentConfig.price_per_class || 0) * presentCount;
        creditApplied = 0;
      } else if (studentConfig.payment_mode === 'prepaid') {
        subtotal = parseFloat(studentConfig.monthly_fixed_amount || 0);
        creditApplied = parseFloat(studentConfig.credit_balance || 0);
      }

      const totalAmount = Math.max(0, subtotal - creditApplied);

      const existingResult = await client.query(
        `SELECT id FROM invoices WHERE admin_id = $1 AND student_id = $2 AND invoice_month = $3`,
        [adminId, studentId, invoiceMonth]
      );
      const existingInvoice = existingResult.rows[0];

      let invoiceRecord;
      const now = new Date().toISOString();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      if (existingInvoice) {
        const updateResult = await client.query(
          `UPDATE invoices
           SET subtotal = $1, credit_applied = $2, total_amount = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4
           RETURNING id, admin_id, student_id, invoice_month, status, subtotal, credit_applied,
                     total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at`,
          [subtotal, creditApplied, totalAmount, existingInvoice.id]
        );
        invoiceRecord = updateResult.rows[0];
      } else {
        const createText = `
          INSERT INTO invoices (
            admin_id, student_id, invoice_month, status, subtotal, credit_applied,
            total_amount, notes, issued_at, due_date, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id, admin_id, student_id, invoice_month, status, subtotal, credit_applied,
                    total_amount, notes, pdf_path, issued_at, due_date, paid_at, created_at, updated_at
        `;

        const notes = studentConfig.payment_mode === 'prepaid' && creditApplied > 0
          ? `Fixed monthly payment — credit of ${creditApplied.toFixed(2)} applied for absences`
          : null;

        const createResult = await client.query(createText, [
          adminId,
          studentId,
          invoiceMonth,
          'pending',
          subtotal,
          creditApplied,
          totalAmount,
          notes,
          now,
          dueDate.toISOString().split('T')[0]
        ]);
        invoiceRecord = createResult.rows[0];
      }

      // Reset credit_balance after applying it to avoid double-crediting on the next invoice run
      if (studentConfig.payment_mode === 'prepaid' && creditApplied > 0) {
        await client.query(
          `UPDATE student_config SET credit_balance = 0.00 WHERE student_id = $1`,
          [studentId]
        );
      }

      return invoiceRecord;
    });

    return result;
  } catch (error) {
    console.error('Error in generateMonthlyInvoice:', error);
    throw error;
  }
};

/**
 * Generate invoices for all active students enrolled under a given admin for a month.
 * Uses class_inscriptions to determine which students belong to this admin.
 *
 * @param {number} adminId - Admin ID
 * @param {string} invoiceMonth - Month in YYYY-MM format
 * @returns {Promise<Array>} Array of created/updated invoices
 */
export const generateBulkMonthlyInvoices = async (adminId, invoiceMonth) => {
  try {
    // Resolve students associated with this admin through their class enrollments
    const text = `
      SELECT DISTINCT ci.student_id
      FROM class_inscriptions ci
      JOIN classes c ON ci.class_id = c.id
      JOIN users u ON ci.student_id = u.id
      WHERE c.admin_id = $1
        AND u.status = 'active'
        AND u.role = 'student'
        AND ci.enrollment_status = 'active'
    `;
    const result = await queryAll(text, [adminId]);
    const studentIds = result.map(r => r.student_id);

    const invoices = await Promise.all(
      studentIds.map(studentId =>
        generateMonthlyInvoice({ adminId, studentId, invoiceMonth })
      )
    );

    return invoices;
  } catch (error) {
    console.error('Error in generateBulkMonthlyInvoices:', error);
    throw error;
  }
};

/**
 * Get a financial summary for a student: balances, invoice counts, and payment config.
 * @param {number} studentId - Student ID
 * @returns {Promise<Object>} Financial summary
 */
export const getStudentFinancialSummary = async (studentId) => {
  try {
    const studentConfig = await StudentConfig.findByStudentId(studentId);

    if (!studentConfig) {
      throw new Error('Student configuration not found');
    }

    const pendingInvoices = await Invoice.getByStudent(studentId, 'pending');
    const paidInvoices = await Invoice.getByStudent(studentId, 'paid');

    let totalPending = 0;
    let totalPaid = 0;

    pendingInvoices.forEach(inv => {
      totalPending += parseFloat(inv.total_amount || 0);
    });
    paidInvoices.forEach(inv => {
      totalPaid += parseFloat(inv.total_amount || 0);
    });

    return {
      studentId,
      paymentMode: studentConfig.payment_mode,
      pricePerClass: studentConfig.price_per_class,
      monthlyFixedAmount: studentConfig.monthly_fixed_amount,
      creditBalance: studentConfig.credit_balance,
      totalPending,
      totalPaid,
      pendingInvoicesCount: pendingInvoices.length,
      paidInvoicesCount: paidInvoices.length
    };
  } catch (error) {
    console.error('Error in getStudentFinancialSummary:', error);
    throw error;
  }
};

export default {
  generateMonthlyInvoice,
  generateBulkMonthlyInvoices,
  getStudentFinancialSummary
};
