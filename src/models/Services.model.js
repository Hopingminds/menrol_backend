import mongoose from "mongoose";

export const ServicesSchema = new mongoose.Schema({
    category:{
        type: String,
        required: true
    },
    categoryImage:{
        type: String,
        default: null,
    },
    subcategory:[{
        title:{
            type: String,
            required: true
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
    }]
},{ timestamps: true });

export default mongoose.model.Services || mongoose.model('Services', ServicesSchema);