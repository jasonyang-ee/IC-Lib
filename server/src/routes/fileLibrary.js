import express from 'express';
import { authenticate, canWrite } from '../middleware/auth.js';
import {
  getFilesByType,
  getFileTypeStats,
  getComponentsByFile,
  massUpdateFileName,
  searchFiles,
  renamePhysicalFile,
  deletePhysicalFile,
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

// Mass update file name in DB (requires write permission)
router.put('/type/:type/rename', canWrite, massUpdateFileName);

// Rename physical file on disk + update DB refs (requires write permission)
router.put('/type/:type/rename-file', canWrite, renamePhysicalFile);

// Delete physical file from disk + remove DB refs (requires write permission)
router.delete('/type/:type/delete-file', canWrite, deletePhysicalFile);

export default router;
