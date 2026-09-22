import { Router } from 'express';
import {
  listContractDeliveryQueue,
  listContractDeliveryLog,
  listContractDeliverySummary,
  processContractDelivery
} from '../controllers/admin-contract-delivery.controller.js';

const router = Router();

router.get('/summary', listContractDeliverySummary);
router.get('/queue', listContractDeliveryQueue);
router.get('/log', listContractDeliveryLog);
router.post('/process', processContractDelivery);

export default router;
