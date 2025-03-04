import { Router } from 'express'
const router = Router()

import * as ServiceOrderController from '../controllers/ServiceOrderController.js'
import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import UserAuth from '../middleware/User.Auth.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';

// POST ROUTES
router.route('/purchaseService').post(UserAuth, ServiceOrderController.purchaseService);
router.route('/acceptServiceOrder').post(UserAuth, ServiceProviderController.acceptServiceOrder);
router.route('/confirmStartWorkingOtp').post(UserAuth, ServiceProviderController.confirmStartWorkingOtp);
router.route('/confirmEndWorkingOtp').post(UserAuth, ServiceProviderController.confirmEndWorkingOtp);
router.route('/paymentCollectForOrder').post(UserAuth, ServiceProviderController.paymentCollectForOrder);
router.route('/sendOrderRequestToProvider').post(UserAuth, ServiceOrderController.sendOrderRequestToProvider);
router.route('/acceptOrderRequest').post(UserAuth, ServiceOrderController.acceptOrderRequest);

// GET ROUTES
router.route('/getUserAllOrders').get(UserAuth, ServiceOrderController.getUserAllOrders);
router.route('/getUserOrderDetails').get(UserAuth, ServiceOrderController.getUserOrderDetails);
router.route('/getUserRasiedOrders').get(UserAuth, ServiceOrderController.getUserRasiedOrders);
router.route('/fetchEligibleServiceProviders').get(UserAuth, ServiceOrderController.fetchEligibleServiceProviders);
router.route('/getAllOrderRequestForProvider').get(UserAuth, ServiceOrderController.getAllOrderRequestForProvider);

// PUT ROUTES
router.route('/updateOrderSubcategoryViewer').put(UserAuth, ServiceProviderController.updateOrderSubcategoryViewer);
router.route('/updateOrderTiming').put(UserAuth, ServiceOrderController.updateOrderTiming);
router.route('/cancelOrderRequest').put(UserAuth, ServiceOrderController.cancelOrderRequest);

// DELETE ROUTES

export default router;