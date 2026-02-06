import express from 'express';
import { authenticate, canApprove, canWrite, isAdmin } from '../middleware/auth.js';
import {
  getAllECOs,
  getECOById,
  createECO,
  approveECO,
  rejectECO,
  deleteECO,
  getApprovalStages,
  createApprovalStage,
  updateApprovalStage,
  deleteApprovalStage,
  reorderApprovalStages,
  setStageApprovers,
} from '../controllers/ecoController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Approval stage management routes (admin only) — must be before /:id
router.get('/stages', getApprovalStages);
router.post('/stages', isAdmin, createApprovalStage);
router.put('/stages/reorder', isAdmin, reorderApprovalStages);
router.put('/stages/:id', isAdmin, updateApprovalStage);
router.delete('/stages/:id', isAdmin, deleteApprovalStage);
router.put('/stages/:id/approvers', isAdmin, setStageApprovers);

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

// Delete ECO order (creator or admin, only if pending/in_review)
router.delete('/:id', deleteECO);

export default router;
