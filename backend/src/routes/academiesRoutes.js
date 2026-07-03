import express from 'express';
import { validateAcademy, getAcademyTheme } from '../controllers/academyController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public route — no auth required (used by registration form)
router.get('/validate', validateAcademy);

// Protected route — returns branding colors for the caller's academy
router.get('/settings', authMiddleware, getAcademyTheme);

export default router;
