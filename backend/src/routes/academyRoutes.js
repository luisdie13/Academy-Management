import express from 'express';
import {
  getAcademyProfile,
  updateAcademyProfile
} from '../controllers/academyController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * Academy Settings Routes
 * All routes require admin authentication
 */

/**
 * GET /api/academy/profile
 * Get academy profile and settings for the authenticated admin
 * 
 * Security: Requires authentication + admin role
 * Returns: Academy settings (name, subdomain, colors, logo, etc.)
 */
router.get(
  '/profile',
  authMiddleware,
  authorize('admin'),
  getAcademyProfile
);

/**
 * PUT /api/academy/profile
 * Update academy profile (name, colors, contact info)
 * 
 * Security: Requires authentication + admin role
 * Body: { name?, primary_color?, secondary_color?, logo_url?, bank_account_info? }
 */
router.put(
  '/profile',
  authMiddleware,
  authorize('admin'),
  updateAcademyProfile
);

export default router;
