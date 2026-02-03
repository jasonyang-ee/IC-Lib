import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

// Get recent activities
router.get('/recent-activities', dashboardController.getRecentActivities);

// Get all activities (for audit page)
router.get('/activities/all', dashboardController.getAllActivities);

// Clear all audit logs
router.delete('/activities/all', dashboardController.clearAllActivities);

// Get category breakdown
router.get('/category-breakdown', dashboardController.getCategoryBreakdown);

// Get extended dashboard statistics
router.get('/extended-stats', dashboardController.getExtendedDashboardStats);

// Get database information
router.get('/db-info', dashboardController.getDatabaseInfo);

export default router;
