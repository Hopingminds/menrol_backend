import mongoose from "mongoose";

export const ServicesSubcategorySchema = new mongoose.Schema({
    category:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Services',
        required: true,
    },
    title:{
        type: String,
        required: true
    },
    description:{
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
    dailyWageWorker:{
        type: Number,
        default:0
    },
    hourlyWorker:{
        type: Number,
        default:0
    },
    contractWorker:{
        type: Number,
        default:0
    },
    image:{
        type: String,
        required: [true, "Image is required with specific dimensions."]
    }
},{ timestamps: true });

export default mongoose.model.ServicesSubcategory || mongoose.model('ServicesSubcategory', ServicesSubcategorySchema);