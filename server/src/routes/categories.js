import express from 'express';
import * as categoryController from '../controllers/categoryController.js';

const router = express.Router();

// Get all categories
router.get('/', categoryController.getAllCategories);

// Get category by ID
router.get('/:id', categoryController.getCategoryById);

// Create new category
router.post('/', categoryController.createCategory);

// Update category
router.put('/:id', categoryController.updateCategory);

// Delete category
router.delete('/:id', categoryController.deleteCategory);

// Get components in a category
router.get('/:id/components', categoryController.getComponentsByCategory);

export default router;
