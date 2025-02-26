import { Router } from 'express'
const router = Router()

import * as ServicesController from '../controllers/ServicesController.js'
import * as CommonController from '../controllers/CommonController.js'
import { uploadCategoryImage, uploadSubCategoryImage } from '../services/aws.service.js';
import AdminAuth from '../middleware/Admin.Auth.js';

// POST ROUTES
router.route('/createService').post(AdminAuth, ServicesController.createService);
router.route('/uploadCategoryImage').post(AdminAuth, uploadCategoryImage.single('categoryImage'), CommonController.uploadedFileResponse);
router.route('/uploadSubCategoryImage').post(AdminAuth, uploadSubCategoryImage.single('subcategoryImages'), CommonController.uploadedFileResponse);

// GET ROUTES
router.route('/getServices').get(ServicesController.getServices);
router.route('/getAllServices').get(ServicesController.getAllServices);
router.route('/getCategory').get(ServicesController.getCategory);
router.route('/getSubcategory').get(ServicesController.getSubcategory);
router.route('/searchCategory').get(ServicesController.searchCategory);
router.route('/searchSubCategory').get(ServicesController.searchSubCategoryInCategory);
router.route('/searchSubCategoryInAllCategories').get(ServicesController.searchSubCategoryInAllCategories);
router.route('/getMostBookedServices').get(ServicesController.getMostBookedServices);
router.route('/getNewlyAddedServices').get(ServicesController.getNewlyAddedServices);

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