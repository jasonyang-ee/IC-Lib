import express from 'express';
import { authenticate, canWrite } from '../middleware/auth.js';
import {
  getFilesByType,
  getFileTypeStats,
  getComponentsByFile,
  massUpdateFileName,
  searchFiles
} from '../controllers/fileLibraryController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get statistics for all file types (counts)
router.get('/stats', getFileTypeStats);

// Search files across all types
router.get('/search', searchFiles);

// Get files by type (footprint, schematic, step, pspice)
router.get('/type/:type', getFilesByType);

// Get components using a specific file
router.get('/type/:type/components', getComponentsByFile);

// Mass update file name (requires write permission)
router.put('/type/:type/rename', canWrite, massUpdateFileName);

export default router;
