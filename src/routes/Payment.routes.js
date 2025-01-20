import { Router } from 'express'
const router = Router()

import * as PaymentController from '../controllers/PaymentController.js'

// POST ROUTES
router.route('/initiatePurchaseSubcription').post(PaymentController.initiatePurchaseSubcription);
router.route('/initiatePayment').post(PaymentController.initiatePayment);

// GET ROUTES
router.route('/paymentCheckResponse').get(PaymentController.paymentCheckResponse);
router.route('/CheckSubcriptionPaymentResponse').get(PaymentController.CheckSubcriptionPaymentResponse);

// PUT ROUTES

// DELETE ROUTES

export default router;