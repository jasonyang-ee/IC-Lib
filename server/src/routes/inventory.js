import express from 'express';
import * as inventoryController from '../controllers/inventoryController.js';

const router = express.Router();

// Get all inventory items
router.get('/', inventoryController.getAllInventory);

// Get inventory by ID
router.get('/:id', inventoryController.getInventoryById);

// Get inventory for a specific component
router.get('/component/:componentId', inventoryController.getInventoryByComponent);

// Create inventory entry
router.post('/', inventoryController.createInventory);

// Update inventory
router.put('/:id', inventoryController.updateInventory);

// Delete inventory
router.delete('/:id', inventoryController.deleteInventory);

// Get low stock items
router.get('/alerts/low-stock', inventoryController.getLowStockItems);

export default router;
