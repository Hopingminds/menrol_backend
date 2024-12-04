import { Router } from 'express'
const router = Router()

import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import { uploadServiceProviderImage, uploadServiceProviderWorkImage } from '../services/aws.service.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';

// POST ROUTES
router.route('/verifyServiceProviderOtp').post( ServiceProviderController.verifyServiceProviderOtp);

// GET ROUTES

// PUT ROUTES
router.route('/completeServiceProviderDetails').put(SPAuth, ServiceProviderController.completeServiceProviderDetails);
router.route('/uploadUserProfile').put(SPAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.uploadUserProfile);
router.route('/uploadWork').put(SPAuth, uploadServiceProviderWorkImage.array('gallery',10), ServiceProviderController.uploadWork);

// DELETE ROUTES

export default router;