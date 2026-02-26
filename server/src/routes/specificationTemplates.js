import express from 'express';
import {
  getSpecificationTemplates,
  createSpecificationTemplate,
  updateSpecificationTemplate,
  deleteSpecificationTemplate,
} from '../controllers/specificationTemplateController.js';

const router = express.Router();

router.get('/', getSpecificationTemplates);
router.post('/', createSpecificationTemplate);
router.put('/:id', updateSpecificationTemplate);
router.delete('/:id', deleteSpecificationTemplate);

export default router;
