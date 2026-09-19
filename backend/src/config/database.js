import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.NEON_DB });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

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

export const query = async (text, params = []) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

export const queryOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0];
};

export const queryAll = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows;
};

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

export const closePool = async () => {
  await pool.end();
};

export default pool;
