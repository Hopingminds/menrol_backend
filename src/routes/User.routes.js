import { Router } from 'express'
const router = Router()

import * as UsersController from '../controllers/UsersController.js'
import * as ServiceRequestController from '../controllers/ServiceRequestController.js'
import * as CommonController from '../controllers/CommonController.js'
import { uploadServiceInstructionAudio, uploadServiceInstructionImage, uploadUserProfileImage } from '../services/aws.service.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/verifyUserOtp').post(UsersController.verifyUserOtp);
router.route('/addUserAddress').post(UserAuth, UsersController.addUserAddress);
router.route('/uploadServiceInstructionAudio').post(UserAuth, uploadServiceInstructionAudio.single('instAudio'), CommonController.uploadedFileResponse);
router.route('/uploadServiceInstructionImage').post(UserAuth, uploadServiceInstructionImage.array('instImages',10), CommonController.uploadedFileResponse);
router.route('/addServiceRequest').post(UserAuth, ServiceRequestController.addServiceRequest);

// GET ROUTES
router.route('/getUserServiceRequests').get(UserAuth, ServiceRequestController.getUserServiceRequests);
router.route('/getUser').get(UserAuth, UsersController.getUser);

// PUT ROUTES
router.route('/uploadUserProfile').put(UserAuth, uploadUserProfileImage.single('profile'), UsersController.uploadUserProfile);
router.route('/editUserProfile').put(UserAuth, UsersController.editUserProfile);
router.route('/updateUserAddress').put(UserAuth, UsersController.updateUserAddress);
router.route('/updateServiceRequest').put(UserAuth, ServiceRequestController.updateServiceRequest);

// DELETE ROUTES
router.route('/deleteUserAddress').delete(UserAuth, UsersController.deleteUserAddress);
router.route('/removeServiceRequest').delete(UserAuth, ServiceRequestController.removeServiceRequest);
router.route('/deleteUserAccount').delete(UserAuth, UsersController.deleteUserAccount);

export default router;