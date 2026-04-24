import express from 'express';
import * as projectController from '../controllers/projectController.js';
import { authenticate, canWrite } from '../middleware/auth.js';

const router = express.Router();

// Project CRUD
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', authenticate, canWrite, projectController.createProject);
router.put('/:id', authenticate, canWrite, projectController.updateProject);
router.delete('/:id', authenticate, canWrite, projectController.deleteProject);

// Project components
router.post('/:projectId/components', authenticate, canWrite, projectController.addComponentToProject);
router.put('/:projectId/components/:componentId', authenticate, canWrite, projectController.updateProjectComponent);
router.delete('/:projectId/components/:componentId', authenticate, canWrite, projectController.removeComponentFromProject);

// Consume project components
router.post('/:id/consume', authenticate, canWrite, projectController.consumeProjectComponents);

export default router;
