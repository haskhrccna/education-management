import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { paginate } from '../middleware/pagination.middleware';
import {
  getNotifications,
  markOneRead,
  markEveryRead,
  getUnreadCount,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

// Read feed (paginated)
router.get('/', paginate(20, 100), getNotifications);

// Bulk mark all read
router.post('/read-all', markEveryRead);

// Unread count (header badge source)
router.get('/unread-count', getUnreadCount);

// Mark single notification as read
router.patch('/:id/read', markOneRead);

export default router;
