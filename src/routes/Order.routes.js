import { Router } from 'express'
const router = Router()

import * as ServiceOrderController from '../controllers/ServiceOrderController.js'
import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import UserAuth from '../middleware/User.Auth.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';

// POST ROUTES
router.route('/purchaseService').post(UserAuth, ServiceOrderController.purchaseService);
router.route('/acceptServiceOrder').post(SPAuth, ServiceProviderController.acceptServiceOrder);

// GET ROUTES
router.route('/getUserAllOrders').get(UserAuth, ServiceOrderController.getUserAllOrders);
router.route('/getUserOrderDetails').get(UserAuth, ServiceOrderController.getUserOrderDetails);

// PUT ROUTES

// DELETE ROUTES

export default router;