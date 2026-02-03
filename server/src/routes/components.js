import express from 'express';
import * as componentController from '../controllers/componentController.js';
import { authenticate, canWrite } from '../middleware/auth.js';

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

// Bulk update distributors for all components (MUST be before /:id routes)
router.post('/bulk/update-distributors', componentController.bulkUpdateDistributors);

// Get component by ID
router.get('/:id', componentController.getComponentById);

// Create new component
router.post('/', authenticate, canWrite, componentController.createComponent);

// Update component
router.put('/:id', authenticate, canWrite, componentController.updateComponent);

// Delete component
router.delete('/:id', authenticate, canWrite, componentController.deleteComponent);

// Get component specifications
router.get('/:id/specifications', componentController.getComponentSpecifications);

// Update component specifications
router.put('/:id/specifications', authenticate, canWrite, componentController.updateComponentSpecifications);

// Get distributor info for component
router.get('/:id/distributors', componentController.getDistributorInfo);

// Update distributor info for component
router.put('/:id/distributors', authenticate, canWrite, componentController.updateDistributorInfo);

// Get alternative parts for a component
router.get('/:id/alternatives', componentController.getAlternatives);

// Create alternative part
router.post('/:id/alternatives', authenticate, canWrite, componentController.createAlternative);

// Update alternative part
router.put('/:id/alternatives/:altId', authenticate, canWrite, componentController.updateAlternative);

// Delete alternative part
router.delete('/:id/alternatives/:altId', authenticate, canWrite, componentController.deleteAlternative);

// Update approval status for component (permission check done in controller)
router.post('/:id/approval', authenticate, componentController.updateComponentApproval);

// Update stock info for a single component (primary + alternatives)
router.post('/:id/update-stock', componentController.updateComponentStock);

// Change component category (admin only - regenerates part number)
router.put('/:id/change-category', authenticate, canWrite, componentController.changeComponentCategory);

export default router;
