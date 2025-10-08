import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// GET /api/settings - Get all application settings
router.get('/', getSettings);

// PUT /api/settings - Update application settings
router.put('/', updateSettings);

export default router;
