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
    categoryDescription:{
        type: String,
        default: null,
    },
    subcategory:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServicesSubcategory',
        required: true,
    }]
},{ timestamps: true });

export default mongoose.model.Services || mongoose.model('Services', ServicesSchema);