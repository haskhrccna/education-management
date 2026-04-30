import { Router } from 'express';
import * as messageController from '../controllers/message.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', messageController.getMessages);
router.post('/', messageController.sendMessage);
router.put('/:id/read', messageController.markRead);

export default router;
