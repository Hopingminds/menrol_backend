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
    dob: {
        type: Date,
    },
    bio: {
        type: String
    },
    isOnline: {
        type: Boolean,
        default: true
    },
    newUser: {
        type: Boolean,
        default: true
    },
    SavedAddresses: [{
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            }
        },
        address: {
            type: String
        }
    }],
    perferredLanguage: {
        type: String,
        enum: ["English", "Hindi"],
        default: "English",
    },
    userRole: {
        type: String,
        enum: ["serviceProvider", "user"],
        default: "user",
    },
    serviceProviderInfo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceProviderInfo",
        default: null,
    }
}, { timestamps: true });

export default mongoose.model.Users || mongoose.model('User', UserSchema);