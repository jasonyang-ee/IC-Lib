import express from 'express';
import { authenticate, canWrite } from '../middleware/auth.js';
import {
  upload,
  uploadTempFile,
  finalizeTempFile,
  cleanupTempFiles,
  checkCollisionsBatch,
  listFiles,
  renameFile,
  deleteFile,
  downloadFile,
  exportFiles,
  restoreDeletedFile,
  confirmDeleteFile,
} from '../controllers/fileUploadController.js';

const router = express.Router();

const handleUploadMiddleware = (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Upload exceeded the 250MB per-file limit' });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded at once' });
    }

    return res.status(400).json({ error: err.message || 'Failed to parse uploaded files' });
  });
};

// Upload files to temp directory (no MPN required)
router.post('/upload-temp', authenticate, canWrite, handleUploadMiddleware, uploadTempFile);

// Finalize temp files — move from temp to category directories and register in DB
router.post('/finalize-temp', authenticate, canWrite, finalizeTempFile);

// Cleanup temp files — delete staged files that were not finalized (cancel flow)
router.post('/cleanup-temp', authenticate, canWrite, cleanupTempFiles);

// Batch collision check — check multiple files at save time
router.post('/check-collisions-batch', authenticate, checkCollisionsBatch);

// List files for a component
router.get('/list/:mfgPartNumber', authenticate, listFiles);

// Rename a file
router.put('/rename', authenticate, canWrite, renameFile);

// Delete a file (soft-delete with shared-file protection)
router.delete('/delete', authenticate, canWrite, deleteFile);

// Download a file
router.get('/download/:category/:mfgPartNumber/:filename', authenticate, downloadFile);

// Export all files for a component as a ZIP archive
router.get('/export/:mfgPartNumber', authenticate, exportFiles);

// Restore soft-deleted files (move back from temp to category directory)
router.post('/restore-deleted', authenticate, canWrite, restoreDeletedFile);

// Confirm soft-deleted files (permanently delete from temp)
router.post('/confirm-delete', authenticate, canWrite, confirmDeleteFile);

export default router;
