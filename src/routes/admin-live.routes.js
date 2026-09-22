import { Router } from 'express';
import {
  listResourceDefinitions,
  listLiveResource,
  getLiveResource,
  createLiveResource,
  updateLiveResource,
  deleteLiveResource,
  getLiveAnalytics,
  getLiveIntegrity
} from '../controllers/admin-live.controller.js';

const router = Router();
router.get('/resources', listResourceDefinitions);
router.get('/analytics', getLiveAnalytics);
router.get('/integrity', getLiveIntegrity);
router.get('/:resource', listLiveResource);
router.post('/:resource', createLiveResource);
router.get('/:resource/:id', getLiveResource);
router.patch('/:resource/:id', updateLiveResource);
router.delete('/:resource/:id', deleteLiveResource);
export default router;
