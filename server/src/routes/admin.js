import express from 'express';
import {
  initializeDatabase,
  resetDatabase,
  getDatabaseStats,
  verifyDatabaseSchema,
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Database management operations - require admin authentication
router.post('/init', authenticate, isAdmin, initializeDatabase);
router.post('/reset', authenticate, isAdmin, resetDatabase);
router.get('/stats', authenticate, isAdmin, getDatabaseStats);
router.get('/verify-schema', authenticate, isAdmin, verifyDatabaseSchema);

export default router;
