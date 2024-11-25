import { Router } from 'express'
const router = Router()

import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import { uploadServiceProviderImage } from '../services/aws.service.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';

// POST ROUTES
router.route('/sendOtpForRegister').post( ServiceProviderController.sendOtpForRegister);
router.route('/verifyServiceProviderOtpAndRegister').post( ServiceProviderController.verifyServiceProviderOtpAndRegister);
router.route('/uploadUserProfile').post(SPAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.uploadUserProfile);

// GET ROUTES

// PUT ROUTES
router.route('/completeServiceProviderDetails').put(SPAuth, ServiceProviderController.completeServiceProviderDetails);

// DELETE ROUTES

export default router;