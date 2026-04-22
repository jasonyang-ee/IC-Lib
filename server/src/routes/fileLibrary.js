import express from 'express';
import { authenticate, canWrite } from '../middleware/auth.js';
import {
  getFilesByType,
  getFileTypeStats,
  getComponentsByFile,
  massUpdateFileName,
  searchFiles,
  renamePhysicalFile,
  renameFootprintGroup,
  deletePhysicalFile,
  deleteFileGroup,
  bulkDeleteOrphanFiles,
  getOrphanFiles,
  getCadFilesForComponent,
  linkFileToComponent,
  unlinkFileFromComponent,
  getComponentsByCategory,
  getSharingComponents,
  getAvailableFiles,
  scanLibraryFiles,
} from '../controllers/fileLibraryController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Scan library folder for untracked files and register them (requires write permission)
router.post('/scan', canWrite, scanLibraryFiles);

// Get statistics for all file types (counts)
router.get('/stats', getFileTypeStats);

// Search files across all types
router.get('/search', searchFiles);

// Get orphan files (not linked to any component)
router.get('/orphans', getOrphanFiles);

// Get available files for linking (file picker)
router.get('/available', getAvailableFiles);

// Get CAD files for a specific component
router.get('/component/:componentId', getCadFilesForComponent);

// Get components in a category with CAD file counts
router.get('/category/:categoryId', getComponentsByCategory);

// Get components sharing files with a component
router.get('/sharing/:componentId', getSharingComponents);

// Get files by type (footprint, schematic, step, pspice, pad)
router.get('/type/:type', getFilesByType);

// Get components using a specific file
router.get('/type/:type/components', getComponentsByFile);

// Mass update file name in DB (requires write permission)
router.put('/type/:type/rename', canWrite, massUpdateFileName);

// Rename physical file on disk + update DB refs (requires write permission)
router.put('/type/:type/rename-file', canWrite, renamePhysicalFile);

// Rename grouped footprint files together (requires write permission)
router.put('/type/footprint/rename-group', canWrite, renameFootprintGroup);

// Delete physical file from disk + remove DB refs (requires write permission)
router.delete('/type/:type/delete-file', canWrite, deletePhysicalFile);

// Delete multiple files of the same type together (requires write permission)
router.post('/type/:type/delete-group', canWrite, deleteFileGroup);

// Bulk delete orphan files for a type (requires write permission)
router.post('/type/:type/delete-orphans', canWrite, bulkDeleteOrphanFiles);

// Link an existing CAD file to a component (requires write permission)
router.post('/link', canWrite, linkFileToComponent);

// Unlink a CAD file from a component (requires write permission)
router.post('/unlink', canWrite, unlinkFileFromComponent);

export default router;
