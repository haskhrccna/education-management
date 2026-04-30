import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { SendMessageSchema } from '@edu/shared';

const router = Router();
router.use(authenticate);

router.get('/', messageController.getMessages);
router.post('/', validate(SendMessageSchema), messageController.sendMessage);
router.put('/:id/read', messageController.markRead);

export default router;
