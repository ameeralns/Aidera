import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  getCurrentUser,
  updateProfile,
  listUsers
} from '../controllers/userController';
import { validateRequest } from '../middleware/validateRequest';
import { updateProfileSchema } from '../schemas/userSchema';

const router = Router();

router.use(authenticateUser);

router.get('/me', getCurrentUser);
router.get('/', listUsers);
router.get('/profile', getCurrentUser);
router.put('/profile', validateRequest({ body: updateProfileSchema.shape.body }), updateProfile);

export default router; 