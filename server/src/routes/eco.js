import express from 'express';
import { authenticate, canApprove, canWrite } from '../middleware/auth.js';
import {
  getAllECOs,
  getECOById,
  createECO,
  approveECO,
  rejectECO,
  deleteECO
} from '../controllers/ecoController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all ECO orders (all authenticated users can view)
router.get('/', getAllECOs);

// Get single ECO order by ID (all authenticated users can view)
router.get('/:id', getECOById);

// Create new ECO order (write, approver, admin)
router.post('/', canWrite, createECO);

// Approve ECO order (approver, admin)
router.post('/:id/approve', canApprove, approveECO);

// Reject ECO order (approver, admin)
router.post('/:id/reject', canApprove, rejectECO);

// Delete ECO order (creator or admin, only if pending)
router.delete('/:id', deleteECO);

export default router;
