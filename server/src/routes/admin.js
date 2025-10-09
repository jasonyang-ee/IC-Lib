import express from 'express';
import {
  initializeDatabase,
  resetDatabase,
  loadSampleData,
  getDatabaseStats,
  verifyCISCompliance
} from '../controllers/adminController.js';

const router = express.Router();

// Database management operations
router.post('/init', initializeDatabase);
router.post('/reset', resetDatabase);
router.post('/load-sample-data', loadSampleData);
router.get('/stats', getDatabaseStats);
router.get('/verify-cis', verifyCISCompliance);

export default router;
