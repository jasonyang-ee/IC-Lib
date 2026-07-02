import express from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = express.Router();

// Get all categories
router.get('/', categoryController.getAllCategories);

// Get category by ID
router.get('/:id', categoryController.getCategoryById);

// Get next part number for a category (checks all categories with same prefix)
router.get('/:id/next-part-number', categoryController.getNextPartNumber);

// Category mutations live on the admin-guarded /api/settings/categories surface.
// This router is read-only.

// Get components in a category
router.get('/:id/components', categoryController.getComponentsByCategory);

export default router;
