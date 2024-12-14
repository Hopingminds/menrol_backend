import { Router } from 'express'
const router = Router()

import * as ServicesController from '../controllers/ServicesController.js'
import { uploadCategoryImage, uploadSubCategoryImage } from '../services/aws.service.js';

// POST ROUTES
router.route('/createService').post(uploadSubCategoryImage.array('subcategoryImages', 10), ServicesController.createService);

// GET ROUTES
router.route('/getServices').get(ServicesController.getServices);
router.route('/getAllServices').get(ServicesController.getAllServices);

// PUT ROUTES
router.route('/addSubCategory').put(uploadSubCategoryImage.array('subcategoryImages', 10), ServicesController.addSubCategory);
router.route('/addCategoryImage').put(uploadCategoryImage.single('categoryImage'), ServicesController.addCategoryImage);

// DELETE ROUTES
router.route('/deleteService').delete(ServicesController.deleteService);
router.route('/removeSubCategory').delete(ServicesController.removeSubCategory);

export default router;