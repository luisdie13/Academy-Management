import express from 'express';
import { getPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '../controllers/paymentMethodController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { validate, createPaymentMethodSchema, updatePaymentMethodSchema } from '../middleware/validation.js';

const router = express.Router();

router.get('/payment-methods', authMiddleware, getPaymentMethods);

router.post(
  '/payment-methods',
  authMiddleware,
  authorize('admin'),
  validate(createPaymentMethodSchema),
  createPaymentMethod
);

router.put(
  '/payment-methods/:id',
  authMiddleware,
  authorize('admin'),
  validate(updatePaymentMethodSchema),
  updatePaymentMethod
);

router.delete(
  '/payment-methods/:id',
  authMiddleware,
  authorize('admin'),
  deletePaymentMethod
);

export default router;
