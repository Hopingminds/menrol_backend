import { Router } from 'express'
const router = Router()

import * as ServiceProviderController from '../controllers/ServiceProviderController.js'
import * as ServiceRequestController from '../controllers/ServiceRequestController.js'
import { uploadServiceProviderAadharCard, uploadServiceProviderImage, uploadServiceProviderWorkImage } from '../services/aws.service.js';
import SPAuth from '../middleware/ServiceProvide.Auth.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/verifyForExistingServiceProvide').post(ServiceProviderController.verifyForExistingServiceProvide);
router.route('/verifyServiceProviderOtp').post(ServiceProviderController.verifyServiceProviderOtp);
router.route('/acceptServiceRequest').post(UserAuth, ServiceRequestController.acceptServiceRequest);
router.route('/addServiceProviderSkills').post(UserAuth, ServiceProviderController.addServiceProviderSkills);

// GET ROUTES
router.route('/getServiceProvider').get(UserAuth, ServiceProviderController.getServiceProvider);
router.route('/getServicesRequestNearSPLocation').get(UserAuth, ServiceProviderController.getServicesRequestNearSPLocation);
router.route('/getServiceProviderAllOrders').get(UserAuth, ServiceProviderController.getServiceProviderAllOrders);

// PUT ROUTES
router.route('/completeServiceProviderRegistrationDetails').put(UserAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.completeServiceProviderRegistrationDetails);
router.route('/completeServiceProviderDetails').put(UserAuth, ServiceProviderController.completeServiceProviderDetails);
router.route('/uploadServiceProviderProfile').put(UserAuth, uploadServiceProviderImage.single('profile'), ServiceProviderController.uploadUserProfile);
router.route('/uploadWork').put(UserAuth, uploadServiceProviderWorkImage.array('gallery',10), ServiceProviderController.uploadWork);
router.route('/uploadServiceProviderDocuments').put(UserAuth, uploadServiceProviderAadharCard.single('aadharCard'), ServiceProviderController.uploadServiceProviderDocuments);
router.route('/updateSPLocation').put(UserAuth, ServiceProviderController.updateSPLocation);
router.route('/updateServiceProviderSkills').put(UserAuth, ServiceProviderController.updateServiceProviderSkills);
router.route('/changeWorkStatus').put(UserAuth, ServiceProviderController.changeWorkStatus);

// DELETE ROUTES
router.route('/removeServiceProviderSubcategory').delete(UserAuth, ServiceProviderController.removeServiceProviderSubcategory);
router.route('/deleteServiceProviderAccount').delete(UserAuth, ServiceProviderController.deleteServiceProviderAccount);

export default router;