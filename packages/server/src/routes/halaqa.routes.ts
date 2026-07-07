import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { standardLimiter } from '../middleware/rate-limit.middleware';
import * as halaqaController from '../controllers/halaqa.controller';

const router = Router();

router.use(standardLimiter);

// Registered before /:id so "groups" isn't swallowed as a room id.
router.get('/groups', halaqaController.listGroups);
router.post('/groups', halaqaController.createGroup);
router.get('/groups/:id', halaqaController.getGroup);

router.get('/', halaqaController.listRooms);
router.post('/', halaqaController.createRoom);
router.get('/:id', halaqaController.getRoom);
router.patch('/:id/start', halaqaController.startRoom);
router.patch('/:id/end', halaqaController.endRoom);

export default router;
