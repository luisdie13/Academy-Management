import { registerUser, loginUser, getUserById } from '../services/authService.js';

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

/**
 * POST /api/auth/register
 * Register a new user
 */
export const register = async (req, res, next) => {
  try {
    const userData = req.validated;

    // Call service to register user
    const result = await registerUser(userData);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: result.user,
        token: result.token
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Registration failed';

    res.status(statusCode).json({
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * POST /api/auth/login
 * Login user and return JWT token
 */
export const login = async (req, res, next) => {
  try {
    const credentials = req.validated;

    // Call service to login user
    const result = await loginUser(credentials);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        token: result.token
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Login failed';

    res.status(statusCode).json({
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * POST /api/auth/logout
 * Logout user by clearing token cookie
 */
export const logout = async (req, res, next) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'Logout failed',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * GET /api/auth/profile
 * Get current user profile (requires authentication)
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId);

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Failed to retrieve profile';

    res.status(statusCode).json({
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }
};

export default { register, login, logout, getProfile };
