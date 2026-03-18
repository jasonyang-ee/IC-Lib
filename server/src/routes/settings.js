import express from 'express';
import multer from 'multer';
import {
  getSettings,
  updateSettings,
  getDatabaseStatus,
  clearDatabase,
  resetDatabase,
  verifyDatabase,
  getCategoryConfigs,
  updateCategoryConfig,
  createCategory,
  updateCategoryOrder,
  getCategorySpecifications,
  createCategorySpecification,
  updateCategorySpecification,
  deleteCategorySpecification,
  reorderCategorySpecifications,
  syncComponentsToInventory,
  exportAllSettings,
  importAllSettings,
  exportUsers,
  importUsers,
  exportCategories,
  importCategories,
  getECOSettings,
  updateECOSettings,
  previewECONumber,
  listCISFiles,
  downloadCISFile,
  listLabelTemplates,
  downloadLabelTemplate,
  initSettings,
  deletePartsAndProjectData,
  deleteLibraryFiles,
  deleteUserRecords,
  exportDatabase,
  importDatabase,
} from '../controllers/settingsController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();
const uploadBackup = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Application settings routes
router.get('/', getSettings);
router.put('/', authenticate, isAdmin, updateSettings);

// ECO settings routes
router.get('/eco', getECOSettings);
router.put('/eco', authenticate, isAdmin, updateECOSettings);
router.get('/eco/preview', previewECONumber);

// Export/Import routes - require admin
router.post('/export', authenticate, isAdmin, exportAllSettings);
router.post('/import', authenticate, isAdmin, importAllSettings);
router.post('/export/users', authenticate, isAdmin, exportUsers);
router.post('/import/users', authenticate, isAdmin, importUsers);
router.post('/export/categories', authenticate, isAdmin, exportCategories);
router.post('/import/categories', authenticate, isAdmin, importCategories);

// Category configuration routes
router.get('/categories', getCategoryConfigs);
router.put('/categories/reorder', authenticate, isAdmin, updateCategoryOrder);
router.post('/categories', authenticate, isAdmin, createCategory);
router.put('/categories/:id', authenticate, isAdmin, updateCategoryConfig);

// Category specifications routes
router.get('/categories/:categoryId/specifications', getCategorySpecifications);
router.post('/categories/:categoryId/specifications', authenticate, isAdmin, createCategorySpecification);
router.put('/categories/:categoryId/specifications/reorder', authenticate, isAdmin, reorderCategorySpecifications);
router.put('/specifications/:id', authenticate, isAdmin, updateCategorySpecification);
router.delete('/specifications/:id', authenticate, isAdmin, deleteCategorySpecification);

// Database management routes - require admin
router.get('/database/status', getDatabaseStatus);
router.post('/database/clear', authenticate, isAdmin, clearDatabase);
router.post('/database/reset', authenticate, isAdmin, resetDatabase);
router.get('/database/verify', verifyDatabase);
router.post('/database/sync-inventory', authenticate, isAdmin, syncComponentsToInventory);
router.post('/database/init-settings', authenticate, isAdmin, initSettings);
router.post('/database/delete-parts', authenticate, isAdmin, deletePartsAndProjectData);
router.post('/database/delete-library-files', authenticate, isAdmin, deleteLibraryFiles);
router.post('/database/delete-users', authenticate, isAdmin, deleteUserRecords);
router.get('/database/export', authenticate, isAdmin, exportDatabase);
router.post('/database/import', authenticate, isAdmin, uploadBackup.single('file'), importDatabase);

// CIS file routes
router.get('/cis-files', listCISFiles);
router.get('/cis-files/:filename', downloadCISFile);

// Label template routes
router.get('/label-templates', listLabelTemplates);
router.get('/label-templates/:filename', downloadLabelTemplate);

export default router;
