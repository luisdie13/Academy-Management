import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * Handles JWT token verification and protected route access
 */

/**
 * Verify JWT token from cookie or Authorization header
 */
export const authMiddleware = (req, res, next) => {
  try {
    // Extract token from HttpOnly cookie or Authorization header
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token || token === 'null' || token.trim() === '') {
      return res.status(401).json({
        error: {
          message: 'Access denied. No token provided.',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to request object
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Unauthorized: Token expired',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: {
          message: 'Unauthorized: Invalid token',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Internal Server Error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - Allowed user roles
 * @returns {Function} Express middleware
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Unauthorized: No user found',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          message: 'Forbidden: Insufficient permissions',
          statusCode: 403,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

/**
 * Generate JWT token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  if (!user || user.id === undefined || user.id === null) {
    throw new Error(`generateToken: user object is invalid — received: ${JSON.stringify(user)}`);
  }
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)
  };

  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

export default { authMiddleware, authorize, generateToken };
