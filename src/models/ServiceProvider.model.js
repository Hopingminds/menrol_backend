import mongoose from "mongoose";

export const ServiceProviderSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    password: {
        type: String,
        required: [false, "Password is required."],
    },
    email: {
        type: String,
        unique: true,
    },
    phone: {
        type: Number,
        unique: true,
    },
    profileImage: { type: String },
    bio: {
        type: String,
        required: false,
    },
    location: { type: String },
    rating: { type: Number, max: 5 },
    pricing: {
        pricingtype: {
            type: String,
            enum: ["hourly", "daily", "contract"],
        },
        from: { type: Number },
        to: { type: Number },
    },
    availability: {
        type: String,
        enum: ["available", "not available", "on request"],
        default: "available",
    },
    availableHours: {
        type: [
        {
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
        },
        ],
        default: [],
    },
    emergencyAvailability: {
        type: Boolean,
        default: false, // Indicates if the provider can be available for emergency work
    },
    category: { type: String },
    subcategory:[{ 
        title: {
            type: String
        },
        pricing: {
            pricingtype: {
                type: String,
                enum: ["hourly", "daily", "contract"],
            },
            from: { type: Number },
            to: { type: Number },
        },
    }],
    languagesSpoken: {
        type: [String],
        required: false,
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
    isVerified: {
        type: Boolean,
        default: false,
    },
    gallery: {
        type: [String], // Array of image URLs for provider's previous work
        required: false,
    },
    socialProfiles: {
        type: Map,
        of: String,
        required: false,
        default: {}, // Example: { LinkedIn: "https://linkedin.com/in/johndoe", Instagram: "https://instagram.com/johndoe" }
    },
},{ timestamps: true });

export default mongoose.model.ServiceProviders || mongoose.model("ServiceProvider", ServiceProviderSchema);
