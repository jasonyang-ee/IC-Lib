import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

// Get recent activities
router.get('/recent-activities', dashboardController.getRecentActivities);

// Get all activities (for audit page) - full audit feed incl. actor data, not public
router.get('/activities/all', authenticate, dashboardController.getAllActivities);

// Clear all audit logs - destructive, requires admin
router.delete('/activities/all', authenticate, isAdmin, dashboardController.clearAllActivities);

// Get category breakdown
router.get('/category-breakdown', dashboardController.getCategoryBreakdown);

// Get extended dashboard statistics
router.get('/extended-stats', dashboardController.getExtendedDashboardStats);

// Get database information (host/version details) - authenticated dashboard card
router.get('/db-info', authenticate, dashboardController.getDatabaseInfo);

export default router;
