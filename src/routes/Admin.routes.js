import { Router } from 'express'
const router = Router()

import * as AdminController from '../controllers/AdminController.js'
import AdminAuth from '../middleware/Admin.Auth.js';

// POST ROUTES
router.route('/registerAdmin').post(AdminController.registerAdmin);
router.route('/loginWithEmailFirstStep').post(AdminController.loginWithEmailFirstStep);
router.route('/verifyAdminOtp').post(AdminController.verifyAdminOtp);
router.route('/BlockServiceProviderAccount').post(AdminAuth, AdminController.BlockServiceProviderAccount);
router.route('/UnblockServiceProviderAccount').post(AdminAuth, AdminController.UnblockServiceProviderAccount);
router.route('/DeactivateServiceProviderAccount').post(AdminAuth, AdminController.DeactivateServiceProviderAccount);
router.route('/BlockUserAccount').post(AdminAuth, AdminController.BlockUserAccount);
router.route('/UnblockUserAccount').post(AdminAuth, AdminController.UnblockUserAccount);
router.route('/DeactivateUserAccount').post(AdminAuth, AdminController.DeactivateUserAccount);
router.route('/verifyServiceProviderAccount').post(AdminAuth, AdminController.verifyServiceProviderAccount);

// GET ROUTES   
router.route('/getAdminDetails').get(AdminAuth, AdminController.getAdminDetails);
router.route('/getAllServiceProviders').get(AdminAuth, AdminController.getAllServiceProviders);
router.route('/getAllUsers').get(AdminAuth, AdminController.getAllUsers);
router.route('/getServiceProvidersDetails').get(AdminAuth, AdminController.getServiceProvidersDetails);
router.route('/getUserDetails').get(AdminAuth, AdminController.getUserDetails);

// PUT ROUTES

// DELETE ROUTES

export default router;