import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', authController.login);

// Protected routes (require authentication)
router.get('/verify', authenticate, authController.verify);
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

// Admin-only routes
router.get('/users', authenticate, isAdmin, authController.getAllUsers);
router.post('/users', authenticate, isAdmin, authController.createUser);
router.put('/users/:id', authenticate, isAdmin, authController.updateUser);
router.delete('/users/:id', authenticate, isAdmin, authController.deleteUser);

export default router;
