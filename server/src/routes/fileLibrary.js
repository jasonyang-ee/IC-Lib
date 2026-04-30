import express from 'express';
import {
  authenticate,
  canAccessFileLibrary,
  canDeleteLibraryFiles,
  canDirectEditComponentByBody,
  canWrite,
  isAdmin,
} from '../middleware/auth.js';
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
  linkPadFootprintFiles,
  unlinkFileFromComponent,
  unlinkPadFootprintFiles,
  getComponentsByCategory,
  getSharingComponents,
  getAvailableFiles,
  scanLibraryFiles,
} from '../controllers/fileLibraryController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Scan library folder for untracked files and register them (requires write permission)
router.post('/scan', canAccessFileLibrary, canWrite, scanLibraryFiles);

// Get statistics for all file types (counts)
router.get('/stats', canAccessFileLibrary, getFileTypeStats);

// Search files across all types
router.get('/search', canAccessFileLibrary, searchFiles);

// Get orphan files (not linked to any component)
router.get('/orphans', canAccessFileLibrary, getOrphanFiles);

// Get available files for linking (file picker)
router.get('/available', getAvailableFiles);

// Get CAD files for a specific component
router.get('/component/:componentId', getCadFilesForComponent);

// Get components in a category with CAD file counts
router.get('/category/:categoryId', canAccessFileLibrary, getComponentsByCategory);

// Get components sharing files with a component
router.get('/sharing/:componentId', canAccessFileLibrary, getSharingComponents);

// Get files by type (footprint, schematic, step, pspice, pad)
router.get('/type/:type', canAccessFileLibrary, getFilesByType);

// Get components using a specific file
router.get('/type/:type/components', canAccessFileLibrary, getComponentsByFile);

// Mass update file name in DB (requires write permission)
router.put('/type/:type/rename', canAccessFileLibrary, canWrite, massUpdateFileName);

// Rename physical file on disk + update DB refs (requires write permission)
router.put('/type/:type/rename-file', canAccessFileLibrary, canWrite, renamePhysicalFile);

// Rename grouped footprint files together (requires write permission)
router.put('/type/footprint/rename-group', canAccessFileLibrary, canWrite, renameFootprintGroup);

// Delete physical file from disk + remove DB refs (requires write permission)
router.delete('/type/:type/delete-file', canAccessFileLibrary, canDeleteLibraryFiles, deletePhysicalFile);

// Delete multiple files of the same type together (requires write permission)
router.post('/type/:type/delete-group', canAccessFileLibrary, canDeleteLibraryFiles, deleteFileGroup);

// Bulk delete orphan files for a type (requires write permission)
router.post('/type/:type/delete-orphans', canAccessFileLibrary, canDeleteLibraryFiles, bulkDeleteOrphanFiles);

// Link an existing CAD file to a component (requires write permission)
router.post('/link', canWrite, canDirectEditComponentByBody, linkFileToComponent);

// Unlink a CAD file from a component (requires write permission)
router.post('/unlink', canWrite, canDirectEditComponentByBody, unlinkFileFromComponent);

// Link footprint-pad history records (admin only)
router.post('/pad-footprint-links', canAccessFileLibrary, isAdmin, linkPadFootprintFiles);

// Remove footprint-pad history records (admin only)
router.delete('/pad-footprint-links', canAccessFileLibrary, isAdmin, unlinkPadFootprintFiles);

export default router;
