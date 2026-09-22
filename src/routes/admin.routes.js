import { Router } from 'express';
import liveRoutes from './admin-live.routes.js';
import contractDeliveryRoutes from './admin-contract-delivery.routes.js';
import {
  listLiveResource,
  getLiveResource,
  createLiveResource,
  updateLiveResource,
  deleteLiveResource,
  getLiveAnalytics,
  getLiveIntegrity
} from '../controllers/admin-live.controller.js';

const router = Router();

function withResource(resource, handler) {
  return (req, res, next) => {
    req.params.resource = resource;
    return handler(req, res, next);
  };
}

function resourceRouter(resource) {
  const child = Router();
  child.get('/', withResource(resource, listLiveResource));
  child.post('/', withResource(resource, createLiveResource));
  child.get('/:id', withResource(resource, getLiveResource));
  child.patch('/:id', withResource(resource, updateLiveResource));
  child.delete('/:id', withResource(resource, deleteLiveResource));
  return child;
}

router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Amani unified admin API',
      status: 'ok',
      source: 'Amani database base tables',
      endpoints: ['/dashboard', '/live', '/properties', '/units', '/clients', '/tenancies', '/payments', '/notices', '/contracts', '/agents', '/locations', '/maintenance', '/reservations', '/reports', '/system']
    }
  });
});

router.use('/live', liveRoutes);

// Dashboard compatibility. All variants are calculated from the same current Amani base tables.
router.get('/dashboard', getLiveAnalytics);
router.get('/dashboard/stats', getLiveAnalytics);
router.get('/dashboard/dashboard-2', getLiveAnalytics);
router.get('/dashboard/dashboard-3', getLiveAnalytics);
router.get('/dashboard/dashboard-4', getLiveAnalytics);

// Stable resource aliases kept for existing callers.
router.use('/properties', resourceRouter('properties'));
router.use('/units', resourceRouter('units'));
router.use('/clients', resourceRouter('clients'));
router.use('/clients-tenants', resourceRouter('clients'));
router.use('/tenancies', resourceRouter('tenancies'));
router.use('/payments', resourceRouter('payments'));
router.use('/notices', resourceRouter('notices'));
router.use('/contracts', resourceRouter('contracts'));
router.use('/agents', resourceRouter('agents'));
router.use('/agents-staff', resourceRouter('agents'));
router.use('/locations', resourceRouter('locations'));
router.use('/maintenance', resourceRouter('maintenance'));
router.use('/reservations', resourceRouter('reservations'));
router.use('/documents', resourceRouter('documents'));
router.use('/features', resourceRouter('features'));
router.use('/media', resourceRouter('media'));
router.use('/content', resourceRouter('content'));
router.use('/services', resourceRouter('services'));

router.get('/reports', getLiveAnalytics);
router.get('/reports/dashboard', getLiveAnalytics);
router.get('/reports/overview', getLiveAnalytics);
router.get('/system', getLiveIntegrity);
router.get('/system/health', getLiveIntegrity);
router.get('/system/integrity', getLiveIntegrity);

// Delivery processing remains available for the existing worker/workflow.
router.use('/contract-delivery', contractDeliveryRoutes);

export default router;
