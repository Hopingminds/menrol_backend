import mongoose from "mongoose";

export const ServicesSchema = new mongoose.Schema({
    category:{
        type: String,
        required: true
    },
    subcategory:[{
        title:{
            type: String,
            required: true
        },
        image:{
            type: String,
            required: [true, "Image is required with specific dimensions."]
        }
    }]
});

export default mongoose.model.Services || mongoose.model('Services', ServicesSchema);