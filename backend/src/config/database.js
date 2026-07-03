import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory if not in Docker (Docker provides env vars directly)
if (process.env.NODE_ENV !== 'docker' && !process.env.DB_HOST) {
  const backendEnvPath = path.join(__dirname, '../../.env');
  dotenv.config({ path: backendEnvPath });
}

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'academy_db',
  user: process.env.DB_USER || 'academy_user',
  password: process.env.DB_PASSWORD || 'academy_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Initialize database connection
 * Test the connection and verify the database is ready
 */
export const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test:', result.rows[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {array} params - Query parameters
 */
export const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

/**
 * Get a single row from a query
 */
export const queryOne = async (text, params) => {
  const result = await query(text, params);
  return result.rows[0];
};

/**
 * Get all rows from a query
 */
export const queryAll = async (text, params) => {
  const result = await query(text, params);
  return result.rows;
};

/**
 * Execute a transaction
 */
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close the pool
 */
export const closePool = async () => {
  await pool.end();
};

export default pool;
