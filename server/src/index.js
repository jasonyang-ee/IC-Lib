import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two directories up from src/index.js)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import routes
import authRoutes from './routes/auth.js';
import componentRoutes from './routes/components.js';
import categoryRoutes from './routes/categories.js';
import distributorRoutes from './routes/distributors.js';
import manufacturerRoutes from './routes/manufacturers.js';
import inventoryRoutes from './routes/inventory.js';
import searchRoutes from './routes/search.js';
import reportsRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import projectRoutes from './routes/projects.js';
import ecoRoutes from './routes/eco.js';
import smtpRoutes from './routes/smtp.js';
import fileUploadRoutes from './routes/fileUpload.js';
import fileLibraryRoutes from './routes/fileLibrary.js';

// Import initialization service
import { initializeAuthentication } from './services/initializationService.js';

// Import health/readiness handlers (SPEC §V30: liveness != readiness)
import { liveness, readiness } from './controllers/healthController.js';

// Import CAD file scan service
import { scanAndRegisterFiles, detectMissingFiles } from './services/cadFileService.js';
import { logError, logFatal, logInfo, logWarn } from './utils/logger.js';

// Process resilience (SPEC §V31): pool handle for drain, shutdown sequencer
import pool from './config/database.js';
import { gracefulShutdown } from './utils/gracefulShutdown.js';

// Rate limiting (SPEC §V32): global ceiling for the public read surface
import { globalLimiter } from './middleware/rateLimit.js';

const app = express();
const PORT = process.env.PORT || 3500;

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const SUBDIRECTORY_PATH = process.env.CONFIG_SUBDIRECTORY_PATH || process.env.BASE_URL || '';

// Trust the single nginx reverse-proxy hop so req.ip reflects the real client
// (X-Forwarded-For) - required for per-IP rate limiting (§V32) to key correctly
// in production. A fixed hop count (not `true`) keeps clients from spoofing IPs.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());

// Custom morgan logger - silence health check and polling endpoints
app.use(morgan('dev', {
  skip: (req, _res) => {
    const silentPaths = [
      '/api/health',
      '/api/ready',
      '/api/database/status',
      '/api/dashboard/stats',
    ];
    return silentPaths.some(p => req.originalUrl === p || req.originalUrl.startsWith(p + '?'));
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Liveness probe (silent - no logging). Cheap, DB-free: 200 while the process
// is up. See §V30 - orchestrators must route on /api/ready, not this.
app.get('/api/health', liveness);

// Readiness probe (silent - no logging). Reflects DB reachability + schema
// verified; 503 when the app cannot serve. This is what the container
// HEALTHCHECK / reverse proxy consumes.
app.get('/api/ready', readiness);

// Global per-IP request ceiling (§V32). Mounted AFTER the probes so the
// container HEALTHCHECK polling /api/ready is never throttled, and BEFORE the
// API routes so it guards the public read surface (§V10) from abuse.
app.use('/api', globalLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/eco', ecoRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/files', fileUploadRoutes);
app.use('/api/file-library', fileLibraryRoutes);

// Error handling middleware
app.use((err, req, res, _next) => {
  logError('Server', `${err.message}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Live server handle, populated once app.listen succeeds. Held at module scope
// so the signal/fault handlers below can drain it (§V31).
let server;
let shuttingDown = false;

// §V31: SIGTERM/SIGINT -> stop accepting connections, drain in-flight, close
// the pool, exit 0. Guarded so a repeated signal during drain is a no-op.
const onSignal = (signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  gracefulShutdown({ server, pool, signal });
};
process.on('SIGTERM', () => onSignal('SIGTERM'));
process.on('SIGINT', () => onSignal('SIGINT'));

// §V31: an uncaught exception / unhandled rejection leaves the process in an
// undefined state. Log FATAL, drain, and exit non-zero so the orchestrator
// restarts a clean process - never keep serving corrupted state.
const onFatal = (kind, error) => {
  logFatal('Server', `${kind}: ${error?.message || error}`);
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  gracefulShutdown({ server, pool, signal: kind, exitCode: 1 });
};
process.on('unhandledRejection', reason => onFatal('Unhandled Rejection', reason));
process.on('uncaughtException', error => onFatal('Uncaught Exception', error));

// Initialize authentication and start server
async function startServer() {
  try {
    // Print ASCII banner
    console.log('');
    logInfo('Server', '\x1b[33m    ,--. ,-----.    ,--.   ,--.,------.\x1b[0m');
    logInfo('Server', '\x1b[33m    |  |\'  .--./    |  |   |  ||  | ) /\x1b[0m');
    logInfo('Server', '\x1b[33m    |  ||  |        |  |   |  ||  .-. `\\\x1b[0m');
    logInfo('Server', '\x1b[33m    |  |\'  \'--\'\\    |  \'--.|  ||  \'--\' /\x1b[0m');
    logInfo('Server', '\x1b[33m    `--\' `-----\'    `-----\'`--\'`------\'\x1b[0m');
    logInfo('Server', '\x1b[36m        IC Component Library Manager\x1b[0m');
    console.log('');


    // Initialize authentication (check/create users table)
    const initializationReady = await initializeAuthentication();

    if (!initializationReady) {
      throw new Error('Database initialization did not complete successfully');
    }
    
    // Start server (capture handle so SIGTERM/SIGINT can drain it - §V31)
    server = app.listen(PORT, async () => {
      logInfo('Server', `Running on port ${PORT}`);
      logInfo('Server', `Environment: ${NODE_ENV}`);
      if (SUBDIRECTORY_PATH) {
        logInfo('Server', `Subdirectory path: ${SUBDIRECTORY_PATH}`);
      }
      console.log('');

      // Run CAD file scan on startup (non-blocking).
      // Note: the cad_files.missing column is owned by the migration system
      // (init-schema.sql for fresh DBs, 1_legacy_schema_repairs.sql for existing
      // DBs) and enforced by startup schema inspection — no online ALTER here.
      try {
        const registered = await scanAndRegisterFiles();
        if (registered > 0) {
          logInfo('Scan', `Registered ${registered} new file(s)`);
        }
        const removed = await detectMissingFiles();
        if (removed > 0) {
          logInfo('Scan', `Tagged ${removed} missing file(s)`);
        }
      } catch (scanErr) {
        logWarn('Scan', `Startup scan failed: ${scanErr.message}`);
      }
    });
  } catch (error) {
    logError('Server', `Failed to start: ${error.message}`);
    process.exit(1);
  }
}

startServer();

export default app;
