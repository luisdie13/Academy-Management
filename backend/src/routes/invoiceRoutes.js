import express from 'express';
import {
  getInvoices,
  getInvoice,
  payInvoice,
  generateInvoicePDF,
  generateMonthlyInvoices,
  getStudentInvoices
} from '../controllers/invoiceController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { validate, payInvoiceSchema } from '../middleware/validation.js';

const router = express.Router();

// POST /api/invoices/generate — bulk generate monthly invoices (admin)
router.post('/generate', authMiddleware, authorize('admin'), generateMonthlyInvoices);

// GET /api/invoices — admin list with optional ?status filter
router.get('/', authMiddleware, authorize('admin'), getInvoices);

// GET /api/invoices/student/:studentId — invoices for a student
router.get('/student/:studentId', authMiddleware, getStudentInvoices);

// GET /api/invoices/:id — single invoice (admin owner or student owner)
router.get('/:id', authMiddleware, getInvoice);

// POST /api/invoices/:id/pay — mark invoice as paid
router.post('/:id/pay', authMiddleware, authorize('admin'), validate(payInvoiceSchema), payInvoice);

// GET /api/invoices/:id/pdf — download PDF receipt
router.get('/:id/pdf', authMiddleware, generateInvoicePDF);

export default router;
