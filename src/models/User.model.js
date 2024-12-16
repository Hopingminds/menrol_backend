import mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    password: {
        type: String,
        required: [false, "Password is required."],
        select: false
    },
    email: {
        type: String,
    },
    phone: {
        type: Number,
        unique: true,
    },
    profileImage: {
        type: String
    },
    authToken: {
        type: String,
        select: false
    },
    isAccountBlocked: {
        type: Boolean,
        default: false,
    },
    perferredLanguage: {
        type: String,
        enum: ["English", "Hindi"],
        default: "English",
    }
}, { timestamps: true });

export default mongoose.model.Users || mongoose.model('User', UserSchema);