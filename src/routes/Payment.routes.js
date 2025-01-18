import { Router } from 'express'
const router = Router()

import * as PaymentController from '../controllers/PaymentController.js'

// POST ROUTES
router.route('/initiatePayment').post(PaymentController.initiatePayment);
router.route('/paymentCheckResponse').get(PaymentController.paymentCheckResponse);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;