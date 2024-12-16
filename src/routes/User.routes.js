import { Router } from 'express'
const router = Router()

import * as UsersController from '../controllers/UsersController.js'
import * as ServiceRequestController from '../controllers/ServiceRequestController.js'
import { uploadServiceInstructionImage, uploadUserProfileImage } from '../services/aws.service.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/verifyUserOtp').post(UsersController.verifyUserOtp);
router.route('/createServiceRequest').post(UserAuth, uploadServiceInstructionImage.array('instImages',10), ServiceRequestController.createServiceRequest);
router.route('/addServiceRequest').post(UserAuth, uploadServiceInstructionImage.array('instImages',10), ServiceRequestController.addServiceRequest);

// GET ROUTES
router.route('/getUserServiceRequests').get(UserAuth, ServiceRequestController.getUserServiceRequests);

// PUT ROUTES
router.route('/uploadUserProfile').put(UserAuth, uploadUserProfileImage.single('profile'), UsersController.uploadUserProfile);

// DELETE ROUTES

export default router;