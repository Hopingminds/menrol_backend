import { Router } from 'express'
const router = Router()

import * as CallController from '../controllers/Call.Controller.js'
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/callProvider').post(CallController.callProvider);
router.route('/voiceCallResponse').post(CallController.voiceCallResponse);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;