import { Router } from 'express'
const router = Router()

import * as AdminController from '../controllers/AdminController.js'

// POST ROUTES
router.route('/registerAdmin').post(AdminController.registerAdmin);
router.route('/loginWithEmailFirstStep').post(AdminController.loginWithEmailFirstStep);
router.route('/verifyAdminOtp').post(AdminController.verifyAdminOtp);

// GET ROUTES   

// PUT ROUTES

// DELETE ROUTES

export default router;