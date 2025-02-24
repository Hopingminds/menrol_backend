import mongoose from "mongoose";

export const PostSchema = new mongoose.Schema({
    publishedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    contentType: {
        type: String,
        enum: ['image', 'video', 'shortVideo'],
        default: 'image',
        required: true
    },
    postUrls: [
        {
            type: String,
            required: true
        }
    ],
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ],
    comments: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            comment: {
                type: String
            },
            date: {
                type: Date,
                default: Date.now
            }
        }
    ],
}, { timestamps: true });

// **Validation for postUrls based on contentType**
PostSchema.pre("save", function (next) {
    if (this.contentType === "video" || this.contentType === "shortVideo") {
        if (this.postUrls.length > 1) {
            return next(new Error("Videos and short videos must have only one URL."));
        }
    }
    next();
});

export default mongoose.model.Posts || mongoose.model('Post', PostSchema);