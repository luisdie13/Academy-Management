import express from 'express';
import {
  getStudents,
  createStudent,
  getStudent,
  updateStudent,
  deleteStudent,
  updateProfile
} from '../controllers/userController.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import { validate, createStudentSchema, updateStudentSchema } from '../middleware/validation.js';

const router = express.Router();

/**
 * User Profile Routes (Authenticated users)
 */

/**
 * PUT /api/users/profile
 * Update the authenticated user's own profile
 */
router.put(
  '/profile',
  authMiddleware,
  validate(updateStudentSchema),
  updateProfile
);

/**
 * Student Management Routes (Admin only)
 */

/**
 * GET /api/users/students
 * List all students with optional filtering
 * Query params: ?status=active|inactive
 */
router.get(
  '/students',
  authMiddleware,
  getStudents
);

/**
 * POST /api/users/students
 * Create a new student with payment configuration
 */
router.post(
  '/students',
  authMiddleware,
  authorize('admin'),
  validate(createStudentSchema),
  createStudent
);

/**
 * GET /api/users/students/:id
 * Get detailed student profile with payment configuration
 */
router.get(
  '/students/:id',
  authMiddleware,
  authorize('admin'),
  getStudent
);

/**
 * PUT /api/users/students/:id
 * Update student profile and/or payment configuration
 */
router.put(
  '/students/:id',
  authMiddleware,
  authorize('admin'),
  validate(updateStudentSchema),
  updateStudent
);

/**
 * DELETE /api/users/students/:id
 * Delete a student (soft delete - marks as inactive)
 */
router.delete(
  '/students/:id',
  authMiddleware,
  authorize('admin'),
  deleteStudent
);

export default router;
