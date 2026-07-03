import pg from 'pg';
import dotenv from 'dotenv';
import { logError } from '../utils/logger.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Silent on connect - only log errors
// Connection logging is handled by initialization service
pool.on('error', (err) => {
  logError('Database', `Unexpected error on idle client: ${err.message}`);
  process.exit(-1);
});

export default pool;
