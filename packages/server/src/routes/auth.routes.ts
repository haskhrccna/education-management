import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { passwordResetLimiter } from '../middleware/rate-limit.middleware';
import {
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '@quran-review/shared';

const router = Router();
router.post('/register', validate(RegisterSchema), authController.register);
router.post('/login', validate(LoginSchema), authController.login);
router.post('/refresh', validate(RefreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.post('/verify-email', authenticate, authController.verifyEmail);
router.post('/resend-verification', authenticate, authController.resendVerification);
router.post('/forgot-password', passwordResetLimiter, validate(ForgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(ResetPasswordSchema), authController.resetPassword);
export default router;
