import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initializeSchema = async () => {
  const sqlDir = path.join(__dirname, '../../db/init.sql');

  if (!fs.existsSync(sqlDir)) {
    console.log('SQL initialization directory not found, skipping schema initialization');
    return true;
  }

  const stat = fs.statSync(sqlDir);
  if (!stat.isDirectory()) {
    console.error('Expected a directory at db/init.sql but found a file. Skipping.');
    return false;
  }

  const sqlFiles = fs.readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    console.log('No SQL files found in db/init.sql/, skipping schema initialization');
    return true;
  }

  const client = await pool.connect();
  try {
    for (const file of sqlFiles) {
      const filePath = path.join(sqlDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log(`Schema file executed: ${file}`);
    }
    return true;
  } catch (error) {
    console.error('Error executing schema:', error.message);
    throw error;
  } finally {
    client.release();
  }
};
