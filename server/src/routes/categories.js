import express from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = express.Router();

// Get all categories
router.get('/', categoryController.getAllCategories);

// Get category by ID
router.get('/:id', categoryController.getCategoryById);

// Get next part number for a category (checks all categories with same prefix)
router.get('/:id/next-part-number', categoryController.getNextPartNumber);

// Create new category
router.post('/', categoryController.createCategory);

// Update category
router.put('/:id', categoryController.updateCategory);

// Update all part numbers in a category (for prefix change)
router.post('/:id/update-part-numbers', categoryController.updateCategoryPartNumbers);

// Delete category
router.delete('/:id', categoryController.deleteCategory);

// Get components in a category
router.get('/:id/components', categoryController.getComponentsByCategory);

export default router;
