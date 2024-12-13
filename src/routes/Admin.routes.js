import { Router } from 'express'
const router = Router()

import * as AdminController from '../controllers/AdminController.js'
import AdminAuth from '../middleware/Admin.Auth.js';

// POST ROUTES
router.route('/registerAdmin').post(AdminController.registerAdmin);
router.route('/loginWithEmailFirstStep').post(AdminController.loginWithEmailFirstStep);
router.route('/verifyAdminOtp').post(AdminController.verifyAdminOtp);

// GET ROUTES   
router.route('/getAllServiceProviders').get(AdminAuth, AdminController.getAllServiceProviders);
router.route('/getAllUsers').get(AdminAuth, AdminController.getAllUsers);

// PUT ROUTES

// DELETE ROUTES

export default router;