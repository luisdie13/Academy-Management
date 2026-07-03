import express from 'express';
import { register, login, logout, getProfile } from '../controllers/authController.js';
import { validate, registerSchema, loginSchema } from '../middleware/validation.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * Authentication Routes
 * Handles user registration, login, logout, and profile retrieval
 */

/**
 * POST /api/auth/register
 * Register a new user
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "phone": "+502 1234 5678" (optional)
 * }
 * 
 * Response: 201 Created
 * {
 *   "success": true,
 *   "message": "User registered successfully",
 *   "data": {
 *     "user": { "id": 1, "email": "...", "firstName": "...", "lastName": "...", "role": "student" },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   },
 *   "timestamp": "2024-01-01T12:00:00.000Z"
 * }
 */
router.post('/register', validate(registerSchema), register);

/**
 * POST /api/auth/login
 * Login user and return JWT token
 * 
 * Request Body:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 * 
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Login successful",
 *   "data": {
 *     "user": { "id": 1, "email": "...", "firstName": "...", "lastName": "...", "role": "student" },
 *     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *   },
 *   "timestamp": "2024-01-01T12:00:00.000Z"
 * }
 */
router.post('/login', validate(loginSchema), login);

/**
 * POST /api/auth/logout
 * Logout user by clearing token cookie
 * 
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Logout successful",
 *   "timestamp": "2024-01-01T12:00:00.000Z"
 * }
 */
router.post('/logout', logout);

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 * 
 * Headers:
 * Authorization: Bearer <token>
 * or
 * Cookie: token=<token>
 * 
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Profile retrieved successfully",
 *   "data": {
 *     "user": { "id": 1, "email": "...", "firstName": "...", "lastName": "...", "role": "student", "status": "active" }
 *   },
 *   "timestamp": "2024-01-01T12:00:00.000Z"
 * }
 */
router.get('/profile', authMiddleware, getProfile);

export default router;
