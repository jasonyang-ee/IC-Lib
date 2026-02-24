import express from 'express';
import {
  initializeDatabase,
  resetDatabase,
  getDatabaseStats,
  verifyDatabaseSchema,
} from '../controllers/adminController.js';

const router = express.Router();

// Database management operations
router.post('/init', initializeDatabase);
router.post('/reset', resetDatabase);
router.get('/stats', getDatabaseStats);
router.get('/verify-schema', verifyDatabaseSchema);

export default router;
