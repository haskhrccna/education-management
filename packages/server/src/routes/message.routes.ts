import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { paginate } from '../middleware/pagination.middleware';
import { SendMessageSchema } from '@quran-review/shared';

const router = Router();
router.use(authenticate);

router.get('/', paginate(20, 100), messageController.getMessages);
router.post('/', validate(SendMessageSchema), messageController.sendMessage);
router.put('/:id/read', messageController.markRead);

export default router;
