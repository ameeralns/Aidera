import { Router } from 'express';
import { validateRequest } from '../middleware/validateRequest';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import {
  createTeam,
  getTeam,
  getTeamPerformance,
  getOrganizationWorkload,
  updateTeamMembers,
  deleteTeam
} from '../controllers/teamController';
import { createTeamSchema, updateTeamMembersSchema } from '../schemas/teamSchema';

const router = Router();

router.use(authenticateUser);

// Team management routes
router.post('/', validateRequest({ body: createTeamSchema.shape.body }), createTeam);
router.get('/:team_id', getTeam);
router.get('/:team_id/performance', getTeamPerformance);
router.get('/workload', getOrganizationWorkload);
router.patch('/:team_id/members', validateRequest({ body: updateTeamMembersSchema.shape.body }), updateTeamMembers);
router.delete('/:team_id', deleteTeam);

export default router; 