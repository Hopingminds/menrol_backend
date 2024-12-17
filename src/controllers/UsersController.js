import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import OtpModel from "../models/Otp.model.js";
import UserModel from "../models/User.model.js";

export async function verifyUserOtp(req, res) {
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

        // Create new service provider
        let user = await UserModel.findOne({ phone });
        if (!user) {
            user = await UserModel.create({ phone });
        }
        else if(user.isAccountBlocked){
            return res.status(403).json({ success: false, message: 'ServiceProvider has been blocked' });
        }

        // Generate JWT token for new user
        const token = jwt.sign(
            { 
                userID: user._id,
                phone: user.phone,
                role: 'user'
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
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function uploadUserProfile(req, res) {
    try {
        const { userID } = req.user
        
        // Check if the file exists in the request
        if (!req.file || !req.file.location) {
            return res.status(400).json({ 
                success: false, 
                message: "No file uploaded or file location missing." 
            });
        }

        // Get the file location from the request
        const profileImageURL = req.file.location;

        // Find the user and update their profile image URL
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found." 
            });
        }

        // Update the profile image URL in the database
        user.profileImage = profileImageURL;
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Profile image uploaded successfully.", 
            data: user 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function getUser(req, res) {
    try {
        const { userID } = req.user;
        const user = await UserModel.findById(userID);
        if(!user){
            return res.status(404).json({ success: false, message: "User not found."});
        }

        return res.status(200).json({ success: false, user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function editUserProfile(req, res) {
    try {
        const { userID } = req.user;
        const { name, email, dob } = req.body;
        
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        user.name = user.name || name;
        user.email = user.email || email;
        user.dob = user.dob || dob;

        await user.save();

        return res.status(201).json({ success: true, message: "User profile updated successfully.", data: user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}