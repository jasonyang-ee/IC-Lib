import express from 'express';
import * as projectController from '../controllers/projectController.js';

const router = express.Router();

// Project CRUD
router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Project components
router.post('/:projectId/components', projectController.addComponentToProject);
router.put('/:projectId/components/:componentId', projectController.updateProjectComponent);
router.delete('/:projectId/components/:componentId', projectController.removeComponentFromProject);

// Consume project components
router.post('/:id/consume', projectController.consumeProjectComponents);

export default router;
