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
// Connection logging is handled by initialization service.
//
// §V31: a pg idle-client error is recoverable (network blip, DB failover,
// idle-timeout reset). The pool evicts the bad client and keeps serving from
// the rest, so we log and continue - never process.exit here, which would turn
// a transient backend hiccup into a crash-loop under `restart: unless-stopped`.
pool.on('error', (err) => {
  logError('Database', `Idle client error (evicted, pool continues): ${err.message}`);
});

export default pool;
