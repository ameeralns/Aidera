import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization
} from '../controllers/organizationController';
import { validateRequest } from '../middleware/validateRequest';
import { organizationSchema } from '../schemas/organizationSchema';

const router = Router();

router.use(authenticateUser);

router.post('/', validateRequest({ body: organizationSchema.shape.body }), createOrganization);
router.get('/:id', getOrganization);
router.patch('/:id', validateRequest({ body: organizationSchema.shape.body }), updateOrganization);
router.delete('/:id', deleteOrganization);

export default router; 