import 'dotenv/config'
import axios from 'axios';
import bcrypt from 'bcrypt';
import OtpModel from '../models/Otp.model.js';

const generateOtp = () => {
    // Function to generate a random 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export async function sendOTP(mobileNo) {
    try {
        // Validate mobile number
        const isValidPhone = /^\d{10}$/.test(mobileNo);
        if (!isValidPhone) {
            throw new Error('Invalid mobile number format');
        }

        const key = process.env.OTP_KEY;
        const otp = generateOtp();
        const number = mobileNo;
        const senderid = process.env.SENDER_ID;
        const entityid = process.env.ENTITY_ID;
        const tempid = process.env.TEMP_ID;
        const accusage = 1;
        const message = `Dear HMian, Your OTP for login to HopingMinds is ${otp}. OTP is Valid for 10 minutes. Please do not share this OTP. Regards,HopingMinds`;

        const url = `${process.env.SMS_BASE_URI}?user=HMians&key=${key}&mobile=${number}&message=${message}&senderid=${senderid}&accusage=${accusage}&entityid=${entityid}&tempid=${tempid}`;

        // Send SMS
        const response = await axios.get(url);
        if (!response.data.includes('success')) { // Adjust based on actual API response
            
            throw new Error('Failed to send OTP');
        }
        
        // Hash OTP and save to the database
        const hashedOtp = await bcrypt.hash(otp, 10);
        let otpuser = await OtpModel.findOneAndUpdate(
            { phone: mobileNo },
            { otp: hashedOtp, otpExpires: new Date(Date.now() + 10 * 60 * 1000) },
            { upsert: true, new: true }
        );
        
        return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
        return { success: false, message: 'OTP sent failed' };
    }
}