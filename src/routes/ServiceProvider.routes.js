import { Router } from 'express'
const router = Router()

import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import * as ServiceRequestController from '../controllers/ServiceRequestController.js'
import { uploadServiceProviderAadharCard, uploadServiceProviderImage, uploadServiceProviderWorkImage } from '../services/aws.service.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';

// POST ROUTES
router.route('/verifyServiceProviderOtp').post(ServiceProviderController.verifyServiceProviderOtp);
router.route('/acceptServiceRequest').post(SPAuth, ServiceRequestController.acceptServiceRequest);
router.route('/addServiceProviderSkills').post(SPAuth, ServiceProviderController.addServiceProviderSkills);

// GET ROUTES
router.route('/getServiceProvider').get(SPAuth, ServiceProviderController.getServiceProvider);
router.route('/getServicesRequestNearSPLocation').get(SPAuth, ServiceProviderController.getServicesRequestNearSPLocation);
router.route('/getServiceProviderAllOrders').get(SPAuth, ServiceProviderController.getServiceProviderAllOrders);

// PUT ROUTES
router.route('/completeServiceProviderRegistrationDetails').put(SPAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.completeServiceProviderRegistrationDetails);
router.route('/completeServiceProviderDetails').put(SPAuth, ServiceProviderController.completeServiceProviderDetails);
router.route('/uploadServiceProviderProfile').put(SPAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.uploadUserProfile);
router.route('/uploadWork').put(SPAuth, uploadServiceProviderWorkImage.array('gallery',10), ServiceProviderController.uploadWork);
router.route('/uploadServiceProviderDocuments').put(SPAuth, uploadServiceProviderAadharCard.single('aadharCard'), ServiceProviderController.uploadServiceProviderDocuments);
router.route('/updateSPLocation').put(SPAuth, ServiceProviderController.updateSPLocation);
router.route('/updateServiceProviderSkills').put(SPAuth, ServiceProviderController.updateServiceProviderSkills);

// DELETE ROUTES
router.route('/removeServiceProviderSubcategory').delete(SPAuth, ServiceProviderController.removeServiceProviderSubcategory);

export default router;