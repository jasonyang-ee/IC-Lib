import express from 'express';
import * as componentController from '../controllers/componentController.js';

const router = express.Router();

// Get all components with optional filtering
router.get('/', componentController.getAllComponents);

// Get sub-category suggestions
router.get('/subcategories/suggestions', componentController.getSubCategorySuggestions);

// Get field suggestions (package, footprint, schematic)
router.get('/field-suggestions', componentController.getFieldSuggestions);

// Bulk update stock info for all components (MUST be before /:id routes)
router.post('/bulk/update-stock', componentController.bulkUpdateStock);

// Bulk update specifications for all components (MUST be before /:id routes)
router.post('/bulk/update-specifications', componentController.bulkUpdateSpecifications);

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

// Update distributor info for component
router.put('/:id/distributors', componentController.updateDistributorInfo);

// Get alternative parts for a component
router.get('/:id/alternatives', componentController.getAlternatives);

// Create alternative part
router.post('/:id/alternatives', componentController.createAlternative);

// Update alternative part
router.put('/:id/alternatives/:altId', componentController.updateAlternative);

// Delete alternative part
router.delete('/:id/alternatives/:altId', componentController.deleteAlternative);

// Update stock info for a single component (primary + alternatives)
router.post('/:id/update-stock', componentController.updateComponentStock);

export default router;
