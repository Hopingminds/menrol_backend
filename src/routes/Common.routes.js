import { Router } from 'express'
const router = Router()

import * as CommonController from '../controllers/CommonController.js'

// POST ROUTES
router.route('/sendOtp').post(CommonController.sendOtp);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;