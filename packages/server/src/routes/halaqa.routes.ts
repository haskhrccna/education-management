import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { standardLimiter } from '../middleware/rate-limit.middleware';
import * as halaqaController from '../controllers/halaqa.controller';

const router = Router();

router.use(authenticate);
router.use(standardLimiter);

router.get('/', halaqaController.listRooms);
router.post('/', halaqaController.createRoom);
router.get('/:id', halaqaController.getRoom);
router.patch('/:id/start', halaqaController.startRoom);
router.patch('/:id/end', halaqaController.endRoom);

export default router;
