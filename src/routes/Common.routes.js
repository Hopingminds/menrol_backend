import { Router } from 'express'
const router = Router()

import * as CommonController from '../controllers/CommonController.js'
import { apiLimiter } from '../middleware/access.limiter.js';
import AdminAuth from '../middleware/Admin.Auth.js';

// POST ROUTES
router.route('/sendOtp').post(apiLimiter, CommonController.sendOtp);
router.route('/sendEmailQuery').post(CommonController.sendEmailQuery);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES
router.route('/deleteFileFromAWS').delete(AdminAuth, CommonController.deleteAFileAWS);

export default router;