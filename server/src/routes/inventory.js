import express from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate, canWrite } from '../middleware/auth.js';

const router = express.Router();

// Get all inventory items
router.get('/', inventoryController.getAllInventory);

// Get inventory by ID
router.get('/:id', inventoryController.getInventoryById);

// Get inventory for a specific component
router.get('/component/:componentId', inventoryController.getInventoryByComponent);

// Create inventory entry
router.post('/', authenticate, canWrite, inventoryController.createInventory);

// Update inventory
router.put('/:id', authenticate, canWrite, inventoryController.updateInventory);

// Delete inventory
router.delete('/:id', authenticate, canWrite, inventoryController.deleteInventory);

// Get low stock items
router.get('/alerts/low-stock', inventoryController.getLowStockItems);

// Search by barcode/SKU
router.post('/search/barcode', inventoryController.searchByBarcode);

// Get alternative parts inventory for a component
router.get('/:id/alternatives', inventoryController.getAlternativeInventory);

// Update alternative inventory (location and quantity)
router.put('/alternatives/:altId', authenticate, canWrite, inventoryController.updateAlternativeInventory);

export default router;
