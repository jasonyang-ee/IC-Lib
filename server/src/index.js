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
import specificationTemplateRoutes from './routes/specificationTemplates.js';
import projectRoutes from './routes/projects.js';
import ecoRoutes from './routes/eco.js';
import smtpRoutes from './routes/smtp.js';
import fileUploadRoutes from './routes/fileUpload.js';
import fileLibraryRoutes from './routes/fileLibrary.js';

// Import initialization service
import { initializeAuthentication, getAuthenticationStatus } from './services/initializationService.js';

const app = express();
const PORT = process.env.PORT || 3500;

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const BASE_URL = process.env.BASE_URL || '';
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'http://localhost';

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
      '/api/database/status',
      '/api/dashboard/stats',
    ];
    return silentPaths.some(p => req.originalUrl === p || req.originalUrl.startsWith(p + '?'));
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint (silent - no logging)
app.get('/api/health', async (req, res) => {
  try {
    const authStatus = await getAuthenticationStatus();
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      authentication: authStatus,
    });
  } catch (error) {
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      authentication: { error: error.message },
    });
  }
});

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
app.use('/api/specification-templates', specificationTemplateRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/eco', ecoRoutes);
app.use('/api/smtp', smtpRoutes);
app.use('/api/files', fileUploadRoutes);
app.use('/api/file-library', fileLibraryRoutes);

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Server]\x1b[0m ${err.message}`);
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

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Server]\x1b[0m Unhandled Rejection: ${error.message}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Server]\x1b[0m Uncaught Exception: ${error.message}`);
});

// Initialize authentication and start server
async function startServer() {
  try {
    // Print ASCII banner
    console.log('');
    console.log('\x1b[33m ,---.   ,-----. ,--.   ,--. ,-----.  \x1b[0m');
    console.log('\x1b[33m|  .-\'  /  .--./  |  |   |  ||  |) /_ \x1b[0m');
    console.log('\x1b[33m|  `-,  |  |      |  |   |  ||  .-.  \\\x1b[0m');
    console.log('\x1b[33m|  .-\'  \'  \'--\'\\  |  \'--.|  ||  \'--\' /\x1b[0m');
    console.log('\x1b[33m`--\'     `-----\'  `-----\'`--\'`------\' \x1b[0m');
    console.log('\x1b[36m        IC Component Library Manager\x1b[0m');
    console.log('');

    // Initialize authentication (check/create users table)
    await initializeAuthentication();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Server]\x1b[0m Running on port ${PORT}`);
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Server]\x1b[0m Environment: ${NODE_ENV}`);
      if (BASE_URL) {
        console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[Server]\x1b[0m Base URL: ${BASE_URL}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[Server]\x1b[0m Failed to start: ${error.message}`);
    process.exit(1);
  }
}

startServer();

export default app;
