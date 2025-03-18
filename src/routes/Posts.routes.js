import { Router } from 'express'
const router = Router()

import * as PostController from '../controllers/Post.Controller.js'
import { uploadPost } from '../services/aws.service.js';
import UserAuth from '../middleware/User.Auth.js';

// POST ROUTES
router.route('/createPost').post(UserAuth, uploadPost.array('post', 10), PostController.createPost);
router.route('/likePost').post(UserAuth, PostController.likePost);
router.route('/commentOnPost').post(UserAuth, PostController.commentOnPost);

// GET ROUTES
router.route('/getUserPosts').get(UserAuth, PostController.getUserPosts);
router.route('/getNextPosts').get(PostController.getNextPosts);
router.route('/getTrendingPosts').get(PostController.getTrendingPosts);
router.route('/getPostsComments/:postId').get(PostController.getPostsComments);

// PUT ROUTES

// DELETE ROUTES
router.route('/deleteYourPost/:postId').delete(UserAuth, PostController.deleteYourPost);
router.route('/deleteCommentFromPost').delete(UserAuth, PostController.deleteCommentFromPost);

export default router;