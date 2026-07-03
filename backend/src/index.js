import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database.js';
import { initializeSchema } from './utils/initializeSchema.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import academyRoutes from './routes/academyRoutes.js';
import classRoutes from './routes/classRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import geolocationRoutes from './routes/geolocationRoutes.js';
import enrollRoutes from './routes/enrollRoutes.js';
import academiesRoutes from './routes/academiesRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

if (process.env.NODE_ENV !== 'docker' && !process.env.API_PORT) {
  dotenv.config();
}

const app = express();
const PORT = process.env.API_PORT || 3000;

// Required when running behind a reverse proxy (Nginx, Cloudflare, etc.) so that
// rate limiting uses the real client IP instead of the proxy's IP.
app.set('trust proxy', 1);

app.use(helmet());
app.disable('x-powered-by');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:8080', 'http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));

const isDev = process.env.NODE_ENV === 'development';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => isDev,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skip: () => isDev,
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ============================================
// BODY PARSER & COOKIE MIDDLEWARE
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser()); // Parse cookies for JWT token extraction

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);    // payment-methods endpoints
app.use('/api/academy', academyRoutes);       // academy profile endpoints
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/geolocation', geolocationRoutes);
app.use('/api/enroll', enrollRoutes);
app.use('/api/academies', academiesRoutes); // public routes (no auth)
app.use('/api/stats', statsRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack Trace:', err.stack); // Log full details server-side for debugging
  
  const statusCode = err.statusCode || 500;
  
  // Sanitize error message for production (Security: Error Information Disclosure)
  let message = err.message || 'Internal Server Error';
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    // In production, never expose internal error details to clients
    message = 'An internal server error occurred. Please contact support.';
  }
  
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString()
    }
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      statusCode: 404,
      path: req.originalUrl
    }
  });
});

// ============================================
// SERVER INITIALIZATION
// ============================================
const startServer = async () => {
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('✓ Database connected successfully');

    // Initialize database schema
    await initializeSchema();
    console.log('✓ Database schema initialized successfully');

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
      console.log('✓ Ready to receive requests');
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

export default app;
