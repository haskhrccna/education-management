import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '@quran-review/shared';

const router = Router();
router.post('/register', validate(RegisterSchema), authController.register);
router.post('/login', validate(LoginSchema), authController.login);
router.post('/refresh', validate(RefreshTokenSchema), authController.refresh);
router.post('/verify-email', authenticate, authController.verifyEmail);
router.post('/resend-verification', authenticate, authController.resendVerification);
export default router;
