import { Router } from 'express';
import { checklistsController } from './checklists.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import {
  ChecklistQuerySchema,
  CreateChecklistDtoSchema,
  UpdateChecklistDtoSchema,
} from './dto/checklist.dto';

const router = Router();

// GET /checklists (List user checklists)
router.get(
  '/',
  authenticate,
  validate({ query: ChecklistQuerySchema }),
  checklistsController.getChecklists,
);

// POST /checklists (Create checklist with items)
router.post(
  '/',
  authenticate,
  validate({ body: CreateChecklistDtoSchema }),
  checklistsController.createChecklist,
);

// GET /checklists/:id (Get checklist by ID)
router.get('/:id', authenticate, checklistsController.getChecklistById);

// PUT /checklists/:id (Update checklist and items)
router.put(
  '/:id',
  authenticate,
  validate({ body: UpdateChecklistDtoSchema }),
  checklistsController.updateChecklist,
);

// DELETE /checklists/:id (Delete checklist)
router.delete('/:id', authenticate, checklistsController.deleteChecklist);

export const checklistRoutes: Router = router;
