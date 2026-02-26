import express from 'express';
import { getAllDistributors } from '../controllers/distributorController.js';

const router = express.Router();

router.get('/', getAllDistributors);

export default router;
