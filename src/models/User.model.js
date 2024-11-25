import mongoose from "mongoose";

export const UserSchema = new mongoose.Schema({
    name:{
        type: String,
    },
    password: {
        type: String,
        required : [false, "Password is required."],
    },
    email: {
        type: String,
        unique: true,
    },
    phone: {
        type: Number,
        unique: true,
    },
    profileImage:{
        type: String
    },
},{ timestamps: true });

export default mongoose.model.Users || mongoose.model('User', UserSchema);