import { Router } from 'express'
const router = Router()

import * as ServicesController from '../controllers/ServicesController.js'
import { uploadSubCategoryImage } from '../services/awsUpload.service.js';

router.route('/createService').post(uploadSubCategoryImage.array('subcategoryImages',10), ServicesController.createService);

router.route('/getAllServices').get(ServicesController.getAllServices);

export default router;