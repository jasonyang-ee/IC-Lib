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
  createCategory,
  getCategorySpecifications,
  createCategorySpecification,
  updateCategorySpecification,
  deleteCategorySpecification,
  reorderCategorySpecifications
} from '../controllers/settingsController.js';

const router = express.Router();

// Application settings routes
router.get('/', getSettings);
router.put('/', updateSettings);

// Category configuration routes
router.get('/categories', getCategoryConfigs);
router.put('/categories/:id', updateCategoryConfig);
router.post('/categories', createCategory);

// Category specifications routes
router.get('/categories/:categoryId/specifications', getCategorySpecifications);
router.post('/categories/:categoryId/specifications', createCategorySpecification);
router.put('/categories/:categoryId/specifications/reorder', reorderCategorySpecifications);
router.put('/specifications/:id', updateCategorySpecification);
router.delete('/specifications/:id', deleteCategorySpecification);

// Database management routes
router.get('/database/status', getDatabaseStatus);
router.post('/database/clear', clearDatabase);
router.post('/database/reset', resetDatabase);
router.post('/database/init', initDatabase);
router.post('/database/sample-data', loadSampleData);
router.get('/database/verify', verifyDatabase);

export default router;
