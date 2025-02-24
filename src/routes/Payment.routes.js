import { Router } from 'express'
const router = Router()

import * as PaymentController from '../controllers/PaymentController.js'
import SPAuth from '../middleware/ServiceProvide.Auth.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/initiatePurchaseSubcription').post(UserAuth, PaymentController.initiatePurchaseSubcription);
router.route('/initiatePayment').post(PaymentController.initiatePayment);

// GET ROUTES
router.route('/paymentCheckResponse').get(PaymentController.paymentCheckResponse);
router.route('/CheckSubcriptionPaymentResponse').get(PaymentController.CheckSubcriptionPaymentResponse);

// PUT ROUTES

// DELETE ROUTES

export default router;