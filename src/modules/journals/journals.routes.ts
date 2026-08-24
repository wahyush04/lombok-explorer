import { Router } from 'express';
import { journalsController } from './journals.controller';
import { authenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import {
  CreateJournalDtoSchema,
  JournalQuerySchema,
  UpdateJournalDtoSchema,
} from './dto/journal.dto';

const router = Router();

// GET /journals (List user journals)
router.get(
  '/',
  authenticate,
  validate({ query: JournalQuerySchema }),
  journalsController.getJournals,
);

// POST /journals (Create journal)
router.post(
  '/',
  authenticate,
  validate({ body: CreateJournalDtoSchema }),
  journalsController.createJournal,
);

// GET /journals/:id (Get journal by ID)
router.get('/:id', authenticate, journalsController.getJournalById);

// PUT /journals/:id (Update journal)
router.put(
  '/:id',
  authenticate,
  validate({ body: UpdateJournalDtoSchema }),
  journalsController.updateJournal,
);

// DELETE /journals/:id (Delete journal)
router.delete('/:id', authenticate, journalsController.deleteJournal);

export const journalRoutes: Router = router;
