import mongoose from "mongoose";

export const ServiceProviderSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    password: {
        type: String,
        select: false
    },
    email: {
        type: String,
    },
    phone: {
        type: Number,
        unique: true,
    },
    authToken:{
        type:String,
        select: false
    },
    newUser:{
        type:Boolean,
        default:true
    },
    isOnline:{
        type:Boolean,
        default:true
    },
    isProfileComplete:{
        type:Boolean,
        default:false
    },
    isAccountBlocked: {
        type: Boolean,
        default: false,
    },
    profileImage: { type: String },
    bio: {
        type: String,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0,0],
        }
    },
    rating: { type: Number, max: 5 },
    totalEarnings: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    availability: {
        type: String,
        enum: ["available", "not available", "on request"],
        default: "available",
    },
    availableTiming: {
        type: [{
            day: {
                type: String,
                enum: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                ],
            },
            start: { type: String }, // format: HH:MM
            end: { type: String }, // format: HH:MM
        }],
        default: [],
    },
    instantAvailability: {
        type: Boolean,
        default: false, // Indicates if the provider can be available for instant work
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
        default: [],
    },
    experience: { type: Number },
    workHistory: [
        {
            companyName: { type: String },
            role: { type: String },
            duration: { type: String }, // e.g., "3 years", "6 months"
            description: { type: String },
        },
    ],
    feedback: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
            rating: {
                type: Number,
                max: 5,
            },
            comment: { type: String },
            date: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    aadharCard:{
        Image:{
            type: String
        },
        aadharVerified: {
            type: Boolean,
            default: false,
        },
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    gallery: {
        type: [String], // Array of image URLs for provider's previous work
    },
    socialProfiles: {
        type: Map,
        of: String,
        default: {}, // Example: { LinkedIn: "https://linkedin.com/in/johndoe", Instagram: "https://instagram.com/johndoe" }
    },
    activeSubscription:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderSubscription",
        default: null,
    },
    providerSubscription:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProviderSubscription",
        default: null,
    }],
},{ timestamps: true });

ServiceProviderSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceProviders || mongoose.model("ServiceProvider", ServiceProviderSchema);
