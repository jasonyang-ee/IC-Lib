import express from 'express';
import { 
  getSettings, 
  updateSettings,
  getDatabaseStatus,
  clearDatabase,
  resetDatabase,
  initDatabase,
  loadSampleData,
  verifyDatabase,
  getCategoryConfigs,
  updateCategoryConfig,
  createCategory
} from '../controllers/settingsController.js';

const router = express.Router();

// Application settings routes
router.get('/', getSettings);
router.put('/', updateSettings);

// Category configuration routes
router.get('/categories', getCategoryConfigs);
router.put('/categories/:id', updateCategoryConfig);
router.post('/categories', createCategory);

// Database management routes
router.get('/database/status', getDatabaseStatus);
router.post('/database/clear', clearDatabase);
router.post('/database/reset', resetDatabase);
router.post('/database/init', initDatabase);
router.post('/database/sample-data', loadSampleData);
router.get('/database/verify', verifyDatabase);

export default router;
