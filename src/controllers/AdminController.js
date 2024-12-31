import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import 'dotenv/config'
import { sendOTP } from '../services/otp.service.js';
import AdminModel from "../models/Admin.model.js";
import OtpModel from '../models/Otp.model.js';
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import UserModel from "../models/User.model.js";

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
                role: 'admin'
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

        const admin = await AdminModel.findOne({email}).select('+password');
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
                role: 'admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await AdminModel.updateOne({ phone }, { authToken: token });

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

export async function getAllServiceProviders(req, res) {
    try {
        // Get pagination parameters from the query
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 20; // Default to 10 users per page if not provided
        
        // Calculate the number of documents to skip based on page number
        const skip = (page - 1) * limit;

        const serviceproviders = await ServiceProviderModel.find().skip(skip).limit(limit);

        if(!serviceproviders  || serviceproviders.length === 0){
            return res.status(404).json({ success: false, message: 'No service providers found.' });
        }
        
        // Count the total number of users to calculate total pages
        const totalServiceProviders = await ServiceProviderModel.countDocuments();
        const totalPages = Math.ceil(totalServiceProviders / limit);

        return res.status(200).json({
            success: true,
            serviceproviders,
            pagination: {
                totalServiceProviders,
                totalPages,
                currentPage: page,
                perPage: limit
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getAllUsers(req, res) {
    try {
        // Get pagination parameters from the query
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 20; // Default to 10 users per page if not provided

        // Calculate the number of documents to skip based on page number
        const skip = (page - 1) * limit;

        // Fetch the users with pagination
        const users = await UserModel.find().skip(skip).limit(limit);

        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'No service providers found.' });
        }

        // Count the total number of users to calculate total pages
        const totalUsers = await UserModel.countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        return res.status(200).json({
            success: true,
            users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: page,
                perPage: limit
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getServiceProvidersDetails(req, res) {
    try {
        const { providerID } = req.query;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if(!serviceProvider){
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }
        return res.status(200).json({ success: true, serviceProvider, orders: "coming soon" });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getUserDetails(req, res) {
    try {
        const { UserID } = req.query;
        const user = await UserModel.findById(UserID);
        if(!user){
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, user, orders: "coming soon" });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function BlockServiceProviderAccount(req, res) {
    try {
        const { providerID } = req.body;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        serviceProvider.isAccountBlocked = true;
        await serviceProvider.save();
        return res.status(200).json({ success: true, message: 'Service provider account blocked' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function UnblockServiceProviderAccount(req, res) {
    try {
        const { providerID } = req.body;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        serviceProvider.isAccountBlocked = false;
        await serviceProvider.save();
        return res.status(200).json({ success: true, message: 'Service provider account UnBlocked' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function DeactivateServiceProviderAccount(req, res) {
    try {
        const { providerID } = req.body;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        await serviceProvider.deleteOne();
        return res.status(200).json({ success: true, message: 'Service provider Account Deleted.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function BlockUserAccount(req, res) {
    try {
        const { userID } = req.body;
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isAccountBlocked = true;
        await user.save();
        return res.status(200).json({ success: true, message: 'User Account Blocked' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function UnblockUserAccount(req, res) {
    try {
        const { userID } = req.body;
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isAccountBlocked = false;
        await user.save();
        return res.status(200).json({ success: true, message: 'User Account UnBlocked' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function DeactivateUserAccount(req, res) {
    try {
        const { userID } = req.body;
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.deleteOne();
        return res.status(200).json({ success: true, message: 'User Account Deleted.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function verifyServiceProviderAccount(req, res) {
    try {
        const { providerID } = req.body;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        serviceProvider.isVerified = true;
        await serviceProvider.save();
        return res.status(200).json({ success: true, message: 'Service provider account Verified' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function verifyServiceProviderAadharCard(req, res) {
    try {
        const { providerID } = req.body;
        const serviceProvider = await ServiceProviderModel.findById(providerID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        if (!serviceProvider.aadharCard.Image) {
            return res.status(400).json({ success: false, message: 'Aadhar Card is Not Uploaded' });
        }
        serviceProvider.aadharCard.aadharVerified = true;
        await serviceProvider.save();
        return res.status(200).json({ success: true, message: 'Service provider Aadhar Card Verified' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getAdminDetails(req, res) {
    try {
        const { adminID } = req.admin;
        const user = await AdminModel.findById(adminID);
        if(!user){
            return res.status(404).json({ success: false, message: "User not found."});
        }

        return res.status(200).json({ success: false, user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}