import express from 'express';
import * as smtpController from '../controllers/smtpController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All SMTP routes require authentication
router.use(authenticate);

// SMTP settings routes (admin only)
router.get('/', isAdmin, smtpController.getSMTPSettings);
router.post('/', isAdmin, smtpController.saveSMTPSettings);
router.post('/test', isAdmin, smtpController.testSMTP);
router.post('/test-email', isAdmin, smtpController.sendTestEmail);

// Notification preferences (for all authenticated users)
router.get('/preferences', smtpController.getNotificationPreferences);
router.put('/preferences', smtpController.updateNotificationPreferences);

export default router;
