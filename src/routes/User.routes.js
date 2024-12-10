import { Router } from 'express'
const router = Router()

import * as UsersController from '../controllers/UsersController.js'
import * as ServiceRequestController from '../controllers/ServiceRequestController.js'
import { uploadServiceInstructionImage } from '../services/aws.service.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/verifyUserOtp').post(UsersController.verifyUserOtp);
router.route('/createServiceRequest').post(UserAuth, uploadServiceInstructionImage.array('instImages',10), ServiceRequestController.createServiceRequest);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;