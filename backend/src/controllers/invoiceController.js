import Invoice from '../models/Invoice.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import AcademySettings from '../models/AcademySettings.js';
import PaymentMethod from '../models/PaymentMethod.js';
import PDFDocument from 'pdfkit';
import sequelize from '../config/database.js';
import { generateBulkMonthlyInvoices } from '../services/invoiceService.js';

/**
 * Invoice Controller
 * Handles HTTP requests for invoice management and payment processing
 */

/**
 * GET /api/invoices
 * Get invoices filtered by status (admin view)
 * Query params: ?status=pending|paid (optional)
 */
export const getInvoices = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { status } = req.query;

    const invoices = await Invoice.getByAdmin(adminId, status || null);

    const data = Array.isArray(invoices) ? invoices.map(invoice => ({
      id: invoice.id,
      adminId: invoice.admin_id,
      studentId: invoice.student_id,
      invoiceMonth: invoice.invoice_month,
      status: invoice.status,
      subtotal: invoice.subtotal,
      creditApplied: invoice.credit_applied,
      totalAmount: invoice.total_amount,
      amount: invoice.total_amount,
      notes: invoice.notes,
      pdfPath: invoice.pdf_path,
      issuedAt: invoice.issued_at,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at
    })) : [];

    res.status(200).json({
      success: true,
      data,
      total: data.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      error: {
        message: 'Failed to retrieve invoices',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * GET /api/invoices/:id
 * Get invoice by ID
 */
export const getInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const invoice = await Invoice.findById(parseInt(id));

    if (!invoice) {
      return res.status(404).json({
        error: {
          message: 'Invoice not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check access: admin owner or student owner
    if (userRole !== 'admin' && invoice.student_id !== userId && invoice.admin_id !== userId) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: You do not have access to this invoice',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      data: {
        id: invoice.id,
        adminId: invoice.admin_id,
        studentId: invoice.student_id,
        invoiceMonth: invoice.invoice_month,
        status: invoice.status,
        subtotal: invoice.subtotal,
        creditApplied: invoice.credit_applied,
        totalAmount: invoice.total_amount,
        notes: invoice.notes,
        pdfPath: invoice.pdf_path,
        issuedAt: invoice.issued_at,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      }
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch invoice',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * POST /api/invoices/:id/pay
 * Process invoice payment (admin only) - ACID Transaction
 * Updates invoice status AND creates immutable transaction record
 */
export const payInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const validated = req.validated;

    const rawQ = async (sql, params, t) => {
      const [rows] = await sequelize.query(sql, {
        bind: params,
        transaction: t,
        raw: true,
      });
      return { rows: Array.isArray(rows) ? rows : [] };
    };

    await sequelize.transaction(async (t) => {
      const invoiceResult = await rawQ(
        'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
        [parseInt(id)],
        t
      );
      const invoice = invoiceResult.rows[0];

      if (!invoice) {
        const err = new Error('Invoice not found');
        err.statusCode = 404;
        throw err;
      }

      if (invoice.admin_id !== adminId) {
        const err = new Error('Forbidden: You do not own this invoice');
        err.statusCode = 403;
        throw err;
      }

      if (invoice.status !== 'pending') {
        const err = new Error(`Invoice cannot be paid. Current status: ${invoice.status}`);
        err.statusCode = 400;
        throw err;
      }

      await rawQ(
        'UPDATE invoices SET status = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['paid', parseInt(id)],
        t
      );

      await rawQ(
        `INSERT INTO transactions (invoice_id, student_id, admin_id, transaction_type, amount, payment_method, reference_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          parseInt(id),
          invoice.student_id,
          adminId,
          'payment',
          parseFloat(invoice.total_amount),
          validated.paymentMethod || null,
          validated.referenceNumber || null,
        ],
        t
      );
    });

    const updatedInvoice = await Invoice.findById(parseInt(id));

    res.status(200).json({
      message: 'Invoice paid successfully',
      data: {
        id: updatedInvoice.id,
        adminId: updatedInvoice.admin_id,
        studentId: updatedInvoice.student_id,
        invoiceMonth: updatedInvoice.invoice_month,
        status: updatedInvoice.status,
        subtotal: updatedInvoice.subtotal,
        creditApplied: updatedInvoice.credit_applied,
        totalAmount: updatedInvoice.total_amount,
        notes: updatedInvoice.notes,
        pdfPath: updatedInvoice.pdf_path,
        issuedAt: updatedInvoice.issued_at,
        dueDate: updatedInvoice.due_date,
        paidAt: updatedInvoice.paid_at,
        createdAt: updatedInvoice.created_at,
        updatedAt: updatedInvoice.updated_at,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error('Error processing payment:', error);
    res.status(statusCode).json({
      error: {
        message: statusCode !== 500 ? error.message : 'Failed to process payment',
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * GET /api/invoices/:id/pdf
 * Generate PDF receipt for invoice
 * Accessible by admin or student owner of the invoice
 */
export const generateInvoicePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch invoice
    const invoice = await Invoice.findById(parseInt(id));

    if (!invoice) {
      return res.status(404).json({
        error: {
          message: 'Invoice not found',
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check access: admin owner or student owner
    if (userRole === 'student' && invoice.student_id !== userId) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: You do not have access to this invoice',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (userRole === 'admin' && invoice.admin_id !== userId) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: You do not own this invoice',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

     const [student, academySettings, paymentMethods] = await Promise.all([
       User.findById(invoice.student_id),
       AcademySettings.findByAdminId(invoice.admin_id),
       PaymentMethod.getByAdmin(invoice.admin_id, true),
     ]);

     if (!student) {
       return res.status(404).json({
         error: {
           message: 'Student not found',
           statusCode: 404,
           timestamp: new Date().toISOString()
         }
       });
     }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'letter',
      margin: 50
    });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`);

    // Handle stream errors
    doc.on('error', (error) => {
      console.error('PDF generation error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: 'Failed to generate PDF',
            statusCode: 500,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    // Pipe document to response
    doc.pipe(res);

    const academyName = academySettings?.name || 'Academy Management System';
    doc.fontSize(24).font('Helvetica-Bold').text(academyName, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text('INVOICE / RECEIPT', { align: 'center' });
    doc.moveDown(0.5);

    if (academySettings) {
      if (academySettings.contact_email) doc.fontSize(9).text(academySettings.contact_email, { align: 'center' });
      if (academySettings.contact_phone) doc.fontSize(9).text(academySettings.contact_phone, { align: 'center' });
    }

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Invoice details
    doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice #: ${invoice.id}`, { continued: true });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' });
    doc.text(`Period: ${invoice.invoice_month}`);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, { continued: !!invoice.paid_at });
    if (invoice.paid_at) {
      doc.text(`Paid Date: ${new Date(invoice.paid_at).toLocaleDateString()}`, { align: 'right' });
    }
    doc.moveDown(1);

    // Student information
    doc.fontSize(12).font('Helvetica-Bold').text('Student Information');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Name: ${student.first_name} ${student.last_name}`);
    doc.text(`Email: ${student.email}`);
    if (student.phone) doc.text(`Phone: ${student.phone}`);
    doc.moveDown(1);

    // Billing breakdown
    doc.fontSize(12).font('Helvetica-Bold').text('Billing Breakdown');
    doc.fontSize(10).font('Helvetica');
    
    const tableTop = doc.y;
    doc.text('Description', 50, tableTop);
    doc.text('Amount', 450, tableTop, { align: 'right' });
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    
    doc.text('Monthly Fee/Classes', 50, tableTop + 20);
    doc.text(`$${parseFloat(invoice.subtotal).toFixed(2)}`, 450, tableTop + 20, { align: 'right' });
    
    if (invoice.credit_applied > 0) {
      doc.text('Credits Applied', 50, doc.y);
      doc.text(`-$${parseFloat(invoice.credit_applied).toFixed(2)}`, 450, doc.y - 16, { align: 'right' });
    }
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total Amount Due:', 50);
    doc.text(`$${parseFloat(invoice.total_amount).toFixed(2)}`, 450, doc.y - 16, { align: 'right' });
    doc.moveDown(1);

    // Payment instructions
    if (invoice.status === 'pending') {
      if (paymentMethods && paymentMethods.length > 0) {
        paymentMethods.forEach((pm) => {
          const blockTop = doc.y;
          const leftX = 50;
          const rightX = 300;
          const colWidth = 230;

          // Right column: Payment Details subtitle + all method info
          let rightY = blockTop;
          doc.fontSize(10).font('Helvetica-Bold').text('Payment Details', rightX, rightY, { width: colWidth });
          rightY = doc.y;
          doc.fontSize(10).font('Helvetica').text(pm.method_name, rightX, rightY, { width: colWidth });
          rightY = doc.y;
          if (pm.bank_name)       { doc.text(`Bank: ${pm.bank_name}`, rightX, rightY, { width: colWidth }); rightY = doc.y; }
          if (pm.account_holder)  { doc.text(`Account Holder: ${pm.account_holder}`, rightX, rightY, { width: colWidth }); rightY = doc.y; }
          if (pm.account_number)  { doc.text(`Account Number: ${pm.account_number}`, rightX, rightY, { width: colWidth }); rightY = doc.y; }
          if (pm.additional_info) { doc.text(pm.additional_info, rightX, rightY, { width: colWidth }); rightY = doc.y; }

          // Left column: vertically centered relative to right column height
          const rightHeight = rightY - blockTop;
          const leftColEstimatedHeight = 48; // ~title line + 3 wrapped lines
          const leftTopOffset = Math.max(0, Math.round((rightHeight - leftColEstimatedHeight) / 2));
          doc.fontSize(11).font('Helvetica-Bold').text('Payment Instructions:', leftX, blockTop + leftTopOffset, { width: colWidth });
          let leftY = doc.y;
          doc.fontSize(10).font('Helvetica').text(
            'Please transfer the total amount shown above to one of the following accounts:',
            leftX, leftY, { width: colWidth }
          );

          // Advance past whichever column is taller
          doc.y = Math.max(doc.y, rightY);
          doc.moveDown(0.8);
        });
      } else {
        doc.text('Contact your academy for payment method details.', { align: 'center' });
      }
    } else if (invoice.status === 'paid') {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('green').text('✓ PAID');
      doc.fillColor('black');
      if (invoice.paid_at) {
        doc.fontSize(10).font('Helvetica').text(`Paid on: ${new Date(invoice.paid_at).toLocaleDateString()}`);
      }
    }

    doc.moveDown(2);

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text('This is an automatically generated receipt. No signature is required.', { align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: 'Failed to generate PDF',
          statusCode: 500,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
};

/**
 * POST /api/invoices/generate
 * Generate (or update) monthly invoices for all active students under this admin.
 * Body: { invoiceMonth: "YYYY-MM" }
 */
export const generateMonthlyInvoices = async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { invoiceMonth } = req.body;

    if (!invoiceMonth || !/^\d{4}-\d{2}$/.test(invoiceMonth)) {
      return res.status(400).json({
        error: { message: 'invoiceMonth must be in YYYY-MM format', statusCode: 400, timestamp: new Date().toISOString() }
      });
    }

    const invoices = await generateBulkMonthlyInvoices(adminId, invoiceMonth);

    res.status(200).json({
      message: `Generated ${invoices.length} invoice(s) for ${invoiceMonth}`,
      data: invoices.map(inv => ({
        id: inv.id,
        studentId: inv.student_id,
        invoiceMonth: inv.invoice_month,
        status: inv.status,
        subtotal: inv.subtotal,
        creditApplied: inv.credit_applied,
        totalAmount: inv.total_amount,
        notes: inv.notes
      }))
    });
  } catch (error) {
    console.error('Error generating invoices:', error);
    res.status(500).json({
      error: { message: 'Failed to generate invoices', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * GET /api/invoices/student/:studentId
 * Get all invoices for a specific student (admin or student self).
 */
export const getStudentInvoices = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userId !== parseInt(studentId)) {
      return res.status(403).json({
        error: { message: 'Access denied', statusCode: 403, timestamp: new Date().toISOString() }
      });
    }

    const invoices = await Invoice.getByStudent(parseInt(studentId));

    res.status(200).json({
      success: true,
      data: invoices.map(inv => ({
        id: inv.id,
        adminId: inv.admin_id,
        studentId: inv.student_id,
        invoiceMonth: inv.invoice_month,
        status: inv.status,
        subtotal: parseFloat(inv.subtotal),
        creditApplied: parseFloat(inv.credit_applied),
        totalAmount: parseFloat(inv.total_amount),
        notes: inv.notes,
        issuedAt: inv.issued_at,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
        createdAt: inv.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching student invoices:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch invoices', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

/**
 * DELETE /api/invoices/:id
 * Delete an invoice (admin only, must own the invoice)
 */
export const deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const invoice = await Invoice.findById(parseInt(id));

    if (!invoice) {
      return res.status(404).json({
        error: { message: 'Invoice not found', statusCode: 404, timestamp: new Date().toISOString() }
      });
    }

    if (invoice.admin_id !== adminId) {
      return res.status(403).json({
        error: { message: 'Forbidden: You do not own this invoice', statusCode: 403, timestamp: new Date().toISOString() }
      });
    }

    await Invoice.delete(parseInt(id));

    res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      error: { message: 'Failed to delete invoice', statusCode: 500, timestamp: new Date().toISOString() }
    });
  }
};

export default { getInvoices, getInvoice, payInvoice, generateInvoicePDF, generateMonthlyInvoices, getStudentInvoices, deleteInvoice };
