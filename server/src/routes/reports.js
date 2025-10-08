import express from 'express';
import * as reportsController from '../controllers/reportsController.js';

const router = express.Router();

// Component summary report
router.get('/component-summary', reportsController.getComponentSummary);

// Category distribution report
router.get('/category-distribution', reportsController.getCategoryDistribution);

// Inventory value report
router.get('/inventory-value', reportsController.getInventoryValue);

// Missing footprints report
router.get('/missing-footprints', reportsController.getMissingFootprints);

// Manufacturer report
router.get('/manufacturers', reportsController.getManufacturerReport);

// Low stock alert report
router.get('/low-stock', reportsController.getLowStockReport);

// Custom query report
router.post('/custom', reportsController.customReport);

export default router;
