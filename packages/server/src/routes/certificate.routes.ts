import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { standardLimiter } from '../middleware/rate-limit.middleware';
import { listCertificates } from '../controllers/certificate.controller';

const router = Router();

router.use(authenticate);
router.use(standardLimiter);

router.get('/', listCertificates);

export default router;
