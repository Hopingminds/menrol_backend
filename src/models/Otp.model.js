import mongoose from "mongoose";

export const OtpSchema = new mongoose.Schema({
    phone: {
        type: Number,
        unique: true
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    }
},{ timestamps: true });

export default mongoose.model.Otps || mongoose.model('Otp', OtpSchema);