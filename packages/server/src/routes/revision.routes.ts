import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';
import * as revisionController from '../controllers/revision.controller';

const router = Router();

router.use(authenticate);
router.get('/', revisionController.getMyRevisions);
router.post('/', authorize(UserRole.TEACHER), revisionController.createRevision);
router.put('/:id', revisionController.markRevision);
router.delete('/:id', revisionController.deleteRevision);

export default router;
