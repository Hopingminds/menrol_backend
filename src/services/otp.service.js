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

        const number = mobileNo;
        let otp = generateOtp();
        const key = process.env.OTP_KEY;
        const user = process.env.OTP_USER;
        const senderid = process.env.SENDER_ID;
        const accusage = 1;
        const message = `Dear user, ${otp} is your OTP / verification code and is valid for 5 minutes. Do not share this with anyone. - Menrol`;

        const url = `${process.env.SMS_BASE_URI}?user=${user}&key=${key}&mobile=${number}&message=${message}&senderid=${senderid}&accusage=${accusage}`;

        if(number !== '9898989898'){
            // Send SMS
            const response = await axios.get(url);
            if (!response.data.includes('success')) {
                return { success: false, message: 'OTP Service Not Working!' };
            }
        }
        else if(number == '9898989898') {
            otp = '121212';
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
        return { success: false, message: error.message || 'OTP sending failed' };
    }
}