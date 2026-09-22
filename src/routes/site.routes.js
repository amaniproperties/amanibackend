import { Router } from 'express';
import {
  getPropertyCategories,
  getProperties,
  getPropertiesWithAvailability,
  getPropertyHead,
  getPropertyDetails,
  getPropertyUnits,
  getPropertyAvailability,
  getAgents,
  getLocationsTree,
  getDefaultFilters,
  getPropertyTabs,
  getNavigation,
  getFooter,
  createPropertyVisitRequest
} from '../controllers/site.controller.js';

const router = Router();

router.get('/navigation', getNavigation);
router.get('/footer', getFooter);
router.post('/book-visit', createPropertyVisitRequest);
router.get('/property-categories', getPropertyCategories);
router.get('/properties', getProperties);
router.get('/properties-with-availability', getPropertiesWithAvailability);
router.get('/properties/:slugOrId/head', getPropertyHead);
router.get('/properties/:slugOrId/details', getPropertyDetails);
router.get('/properties/:slugOrId/units', getPropertyUnits);
router.get('/properties/:slugOrId/availability', getPropertyAvailability);
router.get('/agents', getAgents);
router.get('/locations/tree', getLocationsTree);
router.get('/filters/default', getDefaultFilters);
router.get('/property-tabs', getPropertyTabs);

export default router;
