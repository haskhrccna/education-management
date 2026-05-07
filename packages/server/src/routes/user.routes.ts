import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UpdateProfileSchema } from '@quran-review/shared'

const router = Router();
router.use(authenticate);
router.get('/profile', userController.getProfile);
router.put('/profile', validate(UpdateProfileSchema), userController.updateProfile);
router.put('/change-password', userController.changePassword);
router.post('/device-token', userController.saveDeviceToken);
export default router;
