import { Router } from 'express'
const router = Router()

import * as ServicesController from '../controllers/ServicesController.js'
import { uploadCategoryImage, uploadSubCategoryImage } from '../services/aws.service.js';
import AdminAuth from '../middleware/Admin.Auth.js';

// POST ROUTES
router.route('/createService').post(AdminAuth, uploadSubCategoryImage.array('subcategoryImages', 10), ServicesController.createService);

// GET ROUTES
router.route('/getServices').get(ServicesController.getServices);
router.route('/getAllServices').get(ServicesController.getAllServices);
router.route('/getCategory').get(ServicesController.getCategory);
router.route('/getSubcategory').get(ServicesController.getSubcategory);
router.route('/searchCategory').get(ServicesController.searchCategory);
router.route('/searchSubCategory').get(ServicesController.searchSubCategoryInCategory);
router.route('/searchSubCategoryInAllCategories').get(ServicesController.searchSubCategoryInAllCategories);

// PUT ROUTES
router.route('/editServiceData').put(AdminAuth, ServicesController.editServiceData);
router.route('/editServiceSubCategory').put(AdminAuth, ServicesController.editServiceSubCategory);
router.route('/editServiceSubCategoryImage').put(AdminAuth, uploadSubCategoryImage.single('subcategoryImages'), ServicesController.editServiceSubCategoryImage);
router.route('/addSubCategory').put(AdminAuth, uploadSubCategoryImage.array('subcategoryImages', 10), ServicesController.addSubCategory);
router.route('/addCategoryImage').put(AdminAuth, uploadCategoryImage.single('categoryImage'), ServicesController.addCategoryImage);

// DELETE ROUTES
router.route('/deleteService').delete(AdminAuth, ServicesController.deleteService);
router.route('/removeSubCategory').delete(AdminAuth, ServicesController.removeSubCategory);

export default router;