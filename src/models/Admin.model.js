import mongoose from "mongoose";

export const AdminSchema = new mongoose.Schema({
    name:{
        type: String,
    },
    password: {
        type: String,
        required : [false, "Password is required."],
        select: false,
    },
    email: {
        type: String,
    },
    phone: {
        type: Number,
        unique: true,
    },
    profileImage:{
        type: String
    },
    authToken:{
        type:String,
        select: false
    },
},{ timestamps: true });

export default mongoose.model.Admins || mongoose.model('Admin', AdminSchema);