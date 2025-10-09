import express from 'express';
import { 
  getSettings, 
  updateSettings,
  getDatabaseStatus,
  clearDatabase,
  resetDatabase,
  initDatabase,
  loadSampleData
} from '../controllers/settingsController.js';

const router = express.Router();

// Application settings routes
router.get('/', getSettings);
router.put('/', updateSettings);

// Database management routes
router.get('/database/status', getDatabaseStatus);
router.post('/database/clear', clearDatabase);
router.post('/database/reset', resetDatabase);
router.post('/database/init', initDatabase);
router.post('/database/sample-data', loadSampleData);

export default router;
