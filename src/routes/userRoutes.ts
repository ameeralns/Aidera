import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  getCurrentUser,
  updateProfile,
  listUsers,
  getUserById
} from '../controllers/userController';
import { validateRequest } from '../middleware/validateRequest';
import { updateProfileSchema } from '../schemas/userSchema';
import { z } from 'zod';

const router = Router();

router.use(authenticateUser);

router.get('/me', getCurrentUser);
router.get('/', listUsers);
router.get('/:userId', getUserById);
router.get('/profile', getCurrentUser);
router.put('/profile', validateRequest({
  body: z.object({
    full_name: z.string().optional(),
    skills: z.array(z.string()).optional(),
    settings: z.record(z.any()).optional()
  })
}), updateProfile);

export default router; 