import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', dashboardController.getDashboardStats);

// Get recent activities
router.get('/recent-activities', dashboardController.getRecentActivities);

// Get all activities (for audit page)
router.get('/activities/all', dashboardController.getAllActivities);

// Get category breakdown
router.get('/category-breakdown', dashboardController.getCategoryBreakdown);

export default router;
