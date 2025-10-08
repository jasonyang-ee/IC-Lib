import express from 'express';
import * as manufacturerController from '../controllers/manufacturerController.js';

const router = express.Router();

// Get all manufacturers with optional filtering
router.get('/', manufacturerController.getAllManufacturers);

// Get manufacturer by ID
router.get('/:id', manufacturerController.getManufacturerById);

// Create new manufacturer
router.post('/', manufacturerController.createManufacturer);

// Update manufacturer
router.put('/:id', manufacturerController.updateManufacturer);

// Delete manufacturer
router.delete('/:id', manufacturerController.deleteManufacturer);

export default router;
