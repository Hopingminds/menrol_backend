import { Router } from 'express'
const router = Router();

import * as SubscriptionController from '../controllers/SubscriptionController.js'
import AdminAuth from '../middleware/Admin.Auth.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/createSubscription').post(AdminAuth, SubscriptionController.createSubscription);
router.route('/purchaseSubscription').post(UserAuth, SubscriptionController.purchaseSubscription);

// GET ROUTES 
router.route('/getAllSubscriptions').get(AdminAuth, SubscriptionController.getAllSubscriptions);
router.route('/getActiveSubscriptions').get(SubscriptionController.getActiveSubscriptions);
router.route('/getSubscription').get(SubscriptionController.getSubscription);

// PUT ROUTES
router.route('/updateSubscription').put(AdminAuth, SubscriptionController.updateSubscription);

// DELETE ROUTES
router.route('/deleteSubscription').delete(AdminAuth, SubscriptionController.deleteSubscription);

export default router;