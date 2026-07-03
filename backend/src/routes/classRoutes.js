import express from 'express';
import { createClass, getClasses, getClass, updateClass, deleteClass, getAdminClasses, getClassesByAcademy, getClassStudents } from '../controllers/classController.js';
import { getAvailableClasses } from '../controllers/enrollController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { validate, createClassSchema, getClassesSchema } from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/classes/admin-classes
 * Get all classes for the authenticated admin
 * Protected: requires authentication as admin
 */
router.get(
  '/admin-classes',
  authMiddleware,
  authorize('admin'),
  getAdminClasses
);

/**
 * POST /api/classes
 * Create a new class (admin only)
 */
router.post(
  '/',
  authMiddleware,
  authorize('admin'),
  validate(createClassSchema),
  createClass
);

/**
 * GET /api/classes
 * Get classes - admin gets all their classes, students get their enrolled classes
 * Backend filters by student_id via INNER JOIN with class_inscriptions table
 * Accessible to both admin and students
 */
router.get(
  '/',
  authMiddleware,
  (req, res, next) => {
    try {
      const validated = getClassesSchema.parse(req.query);
      req.validated = validated;
      next();
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          error: {
            message: 'Validation failed',
            statusCode: 400,
            details: errors,
            timestamp: new Date().toISOString()
          }
        });
      }
      next(error);
    }
  },
  getClasses
);

/**
 * GET /api/classes/by-academy?code=<subdomain>
 * Public — no auth required.
 * Used during student registration to verify the academy code and
 * retrieve available classes. Must be declared before /:id so Express
 * does not capture 'by-academy' as a dynamic segment.
 */
router.get('/by-academy', getClassesByAcademy);

/**
 * GET /api/classes/available
 * Returns active classes the authenticated student can still enroll in.
 * Excludes classes the student is already enrolled in.
 * Protected: student only. Must be before /:id to avoid route collision.
 */
router.get('/available', authMiddleware, authorize('student'), getAvailableClasses);

/**
 * GET /api/classes/:id/students
 * Returns enrolled students for a specific class (admin only).
 * Must be declared before /:id to avoid Express capturing "students" as an id segment.
 */
router.get(
  '/:id/students',
  authMiddleware,
  authorize('admin'),
  getClassStudents
);

/**
 * GET /api/classes/:id
 * Get class by ID
 */
router.get(
  '/:id',
  authMiddleware,
  getClass
);

/**
 * PUT /api/classes/:id
 * Update a class (admin only)
 */
router.put(
  '/:id',
  authMiddleware,
  authorize('admin'),
  updateClass
);

/**
 * DELETE /api/classes/:id
 * Delete a class (admin only)
 */
router.delete(
  '/:id',
  authMiddleware,
  authorize('admin'),
  deleteClass
);

export default router;
