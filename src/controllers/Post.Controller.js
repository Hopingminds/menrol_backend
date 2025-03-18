import crypto from "crypto";
import PostModel from "../models/Post.model.js";

export async function createPost(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID;
        if (!userID) {
            return res.status(401).json({ success: false, message: "Unauthorized. User ID is required." });
        }

        const { title, content, contentType } = req.body;

        if (!title || !content || !contentType) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded."
            });
        }

        if ((contentType === "video" || contentType === "shortVideo") && req.files.length > 1) {
            return res.status(400).json({ success: false, message: "Videos and short videos must have only one URL." });
        }

        const fileLocations = req.files.map(file => file.location);

        const newPost = new PostModel({
            publishedBy: userID,
            title,
            content,
            contentType,
            postUrls: fileLocations
        });

        const savedPost = await newPost.save();

        return res.status(201).json({ success: true, message: "Post Created Successfully.", post: savedPost });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function likePost(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID;
        const { postId } = req.body;

        const post = await PostModel.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        const likeIndex = post.likes.indexOf(userID);
        if (likeIndex === -1) {
            post.likes.push(userID);
        } else {
            post.likes.splice(likeIndex, 1);
        }

        const updatedPost = await post.save();

        res.status(200).json({
            success: true,
            message: likeIndex === -1 ? "Post liked!" : "Post unliked!",
            likesCount: updatedPost.likes.length,
            post: updatedPost
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function commentOnPost(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID;
        const { postId, comment } = req.body;

        if (!postId || !comment || comment.trim() === "") {
            return res.status(400).json({ success: false, message: "Comment cannot be empty." });
        }

        // Find the post
        const post = await PostModel.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        // Add new comment
        const newComment = {
            user: userID,
            comment,
            date: new Date()
        };
        post.comments.push(newComment);

        // Save updated post
        const updatedPost = await post.save();

        return res.status(200).json({
            success: true,
            message: "Comment added successfully!",
            post: updatedPost
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function deleteCommentFromPost(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID;
        const { postId, commentId } = req.body;

        if (!postId || !commentId) {
            return res.status(400).json({ success: false, message: "Missing field." });
        }

        // Find the post
        const post = await PostModel.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        // Find the comment inside the post
        const commentIndex = post.comments.findIndex(comment => comment._id.toString() === commentId);

        if (commentIndex === -1) {
            return res.status(404).json({ success: false, message: "Comment not found." });
        }

        // Check if the comment belongs to the user
        if (post.comments[commentIndex].user.toString() !== userID) {
            return res.status(403).json({ success: false, message: "You can only delete your own comments." });
        }

        // Remove the comment
        post.comments.splice(commentIndex, 1);

        // Save updated post
        const updatedPost = await post.save();

        return res.status(200).json({
            success: true,
            message: "Comment deleted successfully!",
            post: updatedPost
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function deleteYourPost(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID;
        const { postId } = req.params;

        if (!postId) {
            return res.status(400).json({ success: false, message: "Missing field." });
        }

        const post = await PostModel.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        if (post.publishedBy.toString() !== userID) {
            return res.status(403).json({ success: false, message: "You can only delete your own posts." });
        }

        // Delete the post
        await PostModel.findByIdAndDelete(postId);

        return res.status(200).json({
            success:true,
            message: "Post deleted successfully!"
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getNextPosts(req, res) {
    try {
        let { page, contentType } = req.query;
        if(!page || !contentType){
            return res.status(400).json({ success: false, message: "Missing field." });
        }

        const filter = {};

        if (contentType) {
            if (!["image", "video", "shortVideo"].includes(contentType)) {
                return res.status(400).json({ success: false, message: "Invalid contentType. Must be 'image', 'video', or 'shortVideo'." });
            }
            filter.contentType = contentType;
        }
        page = parseInt(page) || 1;

        const uniqueKey = req.ip || Math.random().toString();

        const limit = 5;
        const skip = (page - 1) * limit;

        const hash = crypto.createHash("md5").update(uniqueKey).digest("hex");
        const hashNumber = parseInt(hash.substring(0, 8), 16);
        const sortOrder = hashNumber % 2 === 0 ? -1 : 1;

        const posts = await PostModel.find(filter)
            .sort({ createdAt: sortOrder })
            .skip(skip)
            .limit(limit)
            .select("-comments")
            .populate("publishedBy", "name profileImage")
            .populate("likes", "name profileImage")
            .populate("comments.user", "name profileImage");

        const totalPosts = await PostModel.countDocuments(filter);
        const totalPages = Math.ceil(totalPosts / limit);

        return res.status(200).json({
            success: true,
            currentPage: page,
            totalPages,
            totalPosts,
            posts
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getUserPosts(req, res) {
    try {
        const userID = req.sp?.userID || req.user?.userID; // Extract user ID

        if (!userID) {
            return res.status(401).json({ success: false, message: "Unauthorized. User ID is required." });
        }

        const userPosts = await PostModel.find({ publishedBy: userID })
            .sort({ createdAt: -1 }) // Sort by latest posts first
            .populate("publishedBy", "name email")
            .populate("likes", "name")
            .populate("comments.user", "name");

        return res.status(200).json({
            success: true,
            totalPosts: userPosts.length,
            posts: userPosts
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getPostsComments(req, res) {
    try {
        const { postId } = req.params;
        let { page = 1 } = req.query;
        page = parseInt(page, 10);

        if (!postId) {
            return res.status(400).json({ success: false, message: "Post ID is required." });
        }

        const post = await PostModel.findById(postId)
            .select("comments")
            .populate({
                path: "comments.user",
                select: "username profileImage"
            })
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found." });
        }

        const commentsPerPage = 10;
        const totalComments = post.comments.length;
        const totalPages = Math.ceil(totalComments / commentsPerPage);

        // If page exceeds total pages, return empty result
        if (page > totalPages) {
            return res.json({
                comments: [],
                currentPage: page,
                totalComments,
                totalPages,
                message: "No more comments available."
            });
        }

        // Reverse comments to get latest ones first
        const reversedComments = post.comments.reverse();

        const startIndex = (page - 1) * commentsPerPage;
        const endIndex = startIndex + commentsPerPage;

        const paginatedComments = reversedComments.slice(startIndex, endIndex);

        return res.status(200).json({
            success: true,
            comments: paginatedComments,
            currentPage: page,
            totalComments,
            totalPages,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getTrendingPosts(req, res) {
    try {
        const { contentType = 'shortVideo' } = req.query;

        if (!contentType || !['shortVideo', 'video'].includes(contentType)) {
            return res.status(400).json({ success: false, message: "Invalid content type. Use 'shortVideo' or 'video'." });
        }

        const allTrendingPosts = await PostModel.find({ contentType })
            .populate("publishedBy", "name profileImage")
            .lean();

        if (allTrendingPosts.length === 0) {
            return res.status(404).json({ success: false, message: "No trending posts found." });
        }

        const shuffledPosts = allTrendingPosts.sort(() => 0.5 - Math.random());
        const randomPosts = shuffledPosts.slice(0, 4);

        return res.status(200).json({ success: true, data: randomPosts });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}