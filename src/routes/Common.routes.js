import { Router } from 'express'
const router = Router()

import * as CommonController from '../controllers/CommonController.js'
import { apiLimiter } from '../middleware/access.limiter.js';

// POST ROUTES
router.route('/sendOtp').post(apiLimiter, CommonController.sendOtp);
router.route('/sendEmailQuery').post(CommonController.sendEmailQuery);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;