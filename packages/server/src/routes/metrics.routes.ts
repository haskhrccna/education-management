import { Router } from 'express';
import { register } from '../metrics';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '@quran-review/shared';

const router = Router();

router.get('/', authenticate, authorize(UserRole.ADMIN), async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export default router;
