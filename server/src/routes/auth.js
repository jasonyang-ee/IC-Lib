import express from 'express';
import * as authController from '../controllers/authController.js';
import * as oidcController from '../controllers/oidcController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { changePasswordLimiter, loginLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Public routes. Login is rate-limited per client IP (§V32): repeated failed
// attempts get 429 instead of unbounded credential guesses.
router.post('/login', loginLimiter, authController.login);

// OIDC/SSO routes - public by design (documented in SPEC V10/V29):
// status feeds the login page, login/callback carry the IdP redirect flow
router.get('/oidc/status', oidcController.oidcStatus);
router.get('/oidc/login', oidcController.oidcLogin);
router.get('/oidc/callback', oidcController.oidcCallback);

// Protected routes (require authentication)
router.get('/verify', authenticate, authController.verify);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, changePasswordLimiter, authController.changePassword);

// Profile management routes
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.get('/file-storage-path', authenticate, authController.getFileStoragePath);
router.get('/notification-preferences', authenticate, authController.getNotificationPreferences);
router.put('/notification-preferences', authenticate, authController.updateNotificationPreferences);

// Admin-only routes
router.get('/users', authenticate, isAdmin, authController.getAllUsers);
router.post('/users', authenticate, isAdmin, authController.createUser);
router.put('/users/:id', authenticate, isAdmin, authController.updateUser);
router.delete('/users/:id', authenticate, isAdmin, authController.deleteUser);

export default router;
