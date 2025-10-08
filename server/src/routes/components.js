import express from 'express';
import * as componentController from '../controllers/componentController.js';

const router = express.Router();

// Get all components with optional filtering
router.get('/', componentController.getAllComponents);

// Get component by ID
router.get('/:id', componentController.getComponentById);

// Create new component
router.post('/', componentController.createComponent);

// Update component
router.put('/:id', componentController.updateComponent);

// Delete component
router.delete('/:id', componentController.deleteComponent);

// Get component specifications
router.get('/:id/specifications', componentController.getComponentSpecifications);

// Update component specifications
router.put('/:id/specifications', componentController.updateComponentSpecifications);

// Get distributor info for component
router.get('/:id/distributors', componentController.getDistributorInfo);

export default router;
