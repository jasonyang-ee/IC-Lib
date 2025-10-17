import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two directories up from src/index.js)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import routes
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

const app = express();
const PORT = process.env.PORT || 3500;

// Log API configuration status (for debugging)
console.log('API Configuration Status:');
console.log('  DIGIKEY_CLIENT_ID:', process.env.DIGIKEY_CLIENT_ID ? '✓ Set' : '✗ Not set');
console.log('  DIGIKEY_CLIENT_SECRET:', process.env.DIGIKEY_CLIENT_SECRET ? '✓ Set' : '✗ Not set');
console.log('  MOUSER_API_KEY:', process.env.MOUSER_API_KEY ? '✓ Set' : '✗ Not set');

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API: http://localhost:${PORT}/api`);
});

export default app;
