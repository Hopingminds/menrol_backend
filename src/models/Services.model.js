import mongoose from "mongoose";

export const ServicesSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true
    },
    categoryImage: {
        type: String,
        default: null,
    },
    categoryAppImage: {
        type: String,
        default: null,
    },
    categoryDescription: {
        type: String,
        default: null,
    },
    subcategory: [{
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: null,
        },
        pricing: [
            {
                pricingtype: {
                    type: String,
                    enum: ["hourly", "daily", "contract"],
                },
                from: { type: Number },
                to: { type: Number },
            }
        ],
        dailyWageWorker: {
            type: Number,
            default: 0
        },
        hourlyWorker: {
            type: Number,
            default: 0
        },
        contractWorker: {
            type: Number,
            default: 0
        },
        noOfBookings: {
            type: Number,
            default: 0
        },
        image: {
            type: String,
            required: [true, "Image is required with specific dimensions."]
        },
        appImage: {
            type: String,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

export default mongoose.model.Services || mongoose.model('Services', ServicesSchema);