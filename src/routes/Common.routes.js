import { Router } from 'express'
const router = Router()

import * as CommonController from '../controllers/CommonController.js'

// POST ROUTES
router.route('/sendOtp').post(CommonController.sendOtp);
router.route('/sendEmailQuery').post(CommonController.sendEmailQuery);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;