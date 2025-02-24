import mongoose from "mongoose";

const ServiceProviderInfoSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isProfileComplete: {
        type: Boolean,
        default: false
    },
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
    address: { type: String },
    rating: { type: Number, max: 5 },
    totalEarnings: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    availability: {
        type: String,
        enum: ["available", "not available", "on request"],
        default: "available",
    },
    availableTiming: [{
        day: {
            type: String,
            enum: [
                "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday", "Sunday",
            ],
        },
        start: { type: String }, // HH:MM
        end: { type: String },   // HH:MM
    }],
    instantAvailability: {
        type: Boolean,
        default: false
    },
    skills: [{
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Services",
            default: null,
        },
        subcategories: [{
            subcategory: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
            pricing: [{
                pricingtype: {
                    type: String,
                    enum: ["hourly", "daily", "contract"],
                },
                from: { type: Number },
                to: { type: Number },
            }],
        }],
    }],
    languagesSpoken: {
        type: [String],
        default: []
    },
    experience: { type: Number },
    workHistory: [{
        workName: { type: String },
        role: { type: String },
        duration: { type: String }, // e.g., "3 years", "6 months"
        description: { type: String },
    }],
    feedback: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        rating: { type: Number, max: 5 },
        comment: { type: String },
        date: { type: Date, default: Date.now },
    }],
    aadharCard: {
        image: { type: String },
        aadharVerified: { type: Boolean, default: false },
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    gallery: { type: [String] },
    socialProfiles: {
        type: Map,
        of: String,
        default: {}, // Example: { LinkedIn: "...", Instagram: "..." }
    },
    activeSubscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderSubscription",
        default: null,
    },
    providerSubscription: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderSubscription",
        default: null,
    }],
}, { timestamps: true });

ServiceProviderInfoSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceProviderInfo || mongoose.model('ServiceProviderInfo', ServiceProviderInfoSchema);