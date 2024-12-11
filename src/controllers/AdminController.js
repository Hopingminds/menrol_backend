import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import AdminModel from "../models/Admin.model.js";
import { sendOTP } from '../services/otp.service.js';
import OtpModel from '../models/Otp.model.js';

export async function registerAdmin(req, res) {
    try {
        const { email, phone, password } = req.body;
        if (!email || !phone || !password) {
            return res.status(404).json({ success: false, message: 'email, phone and password are required.' });
        }

        const existingphone = await AdminModel.findOne({ phone });
        const existingemail = await AdminModel.findOne({ email });

        if (existingphone) {
            return res.status(404).json({ success: false, message: 'Phone number is already existing.' });
        }
        if (existingemail) {
            return res.status(404).json({ success: false, message: 'Email is already existing.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = new AdminModel({
            password: hashedPassword,
            email,
            phone,
        });

        const savedAdmin = await admin.save();

        const token = jwt.sign(
            {
                adminID: savedAdmin._id,
                email: savedAdmin.email,
                mobile: savedAdmin.phone,
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        savedAdmin.authToken = token;
        await savedAdmin.save();

        return res.status(201).send({
            msg: 'Admin Registered Successfully',
            token
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function loginWithEmailFirstStep(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(500).json({ success: false, message: 'email and password are required.' });
        }

        const admin = await AdminModel.findOne({email});
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found.' })
        }

        // Compare password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        //send OTP on phone
        const result = await sendOTP(admin.phone);

        if (!result.success) {
            throw new Error('Failed to send OTP.');
        }

        return res.status(201).json({
            success: true,
            message: 'First Step Authentication Completed. OTP sent on registered Phone number',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function verifyAdminOtp(req, res) {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
        }

        const otpuser = await OtpModel.findOne({ phone });

        if (!otpuser) {
            return res.status(400).json({ success: false, message: 'Request for otp first.' });
        }

        if (new Date(otpuser.otpExpires) < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired', expiredotp: true });
        }

        const isMatch = await bcrypt.compare(otp, otpuser.otp);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid OTP', validotp: false });
        }

        // Create new Admin
        let admin = await AdminModel.findOne({ phone });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Generate JWT token for new user
        const token = jwt.sign(
            {
                adminID: admin._id,
                email: admin.email,
                mobile: admin.phone,
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await UserModel.updateOne({ phone }, { authToken: token });

        // Clean up OTP record
        await OtpModel.deleteOne({ phone });

        return res.status(201).json({
            success: true,
            message: 'User verified and registered successfully',
            token,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}