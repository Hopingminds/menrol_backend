import { Router } from 'express'
const router = Router()

import * as UsersController from '../controllers/UsersController.js'

// POST ROUTES
router.route('/verifyUserOtp').post(UsersController.verifyUserOtp);

// GET ROUTES

// PUT ROUTES

// DELETE ROUTES

export default router;