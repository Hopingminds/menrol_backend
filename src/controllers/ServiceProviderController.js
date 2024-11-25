import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import OtpModel from "../models/Otp.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import { sendOTP } from "../services/otp.service.js";


export async function verifyForExistingUser(req, res) {
	try {
		const { email, phone } = req.body;

		if (!email && !phone) {
		return res.status(400).send({ success: false, error: "Email or phone must be provided" });
		}

		const errors = {};

		if (email) {
            const userWithEmail = await ServiceProviderModel.findOne({ email });
            if (userWithEmail) {
                errors.email = "Email already exists";
            }
		}

		if (phone) {
            const userWithPhone = await ServiceProviderModel.findOne({ phone });
            if (userWithPhone) {
                errors.phone = "Phone already exists";
            }
		}

		if (Object.keys(errors).length > 0) {
		    return res.status(409).send({ success: false, errors });
		}

		return res.status(200).send({ success: true, msg: "Email and phone are available" });
	} catch (error) {
		return res.status(500).send({ msg: "Internal Server Error!" });
	}
}

export async function sendOtpForRegister(req, res) {
    try {
        const { phone } = req.body;

        // Validate phone number format
        const isValidPhone = /^\d{10}$/.test(phone); // Adjust regex as needed
        if (!isValidPhone) {
            return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
        }

        // Check if service provider already exists
        const existingProvider = await ServiceProviderModel.findOne({ phone });
        if (existingProvider) {
            return res.status(409).json({
                success: false,
                message: 'Service provider already registered. Please log in instead.',
            });
        }

        const result = await sendOTP(phone);

        if (!result.success) {
            // console.log(result);
            
            throw new Error('Failed to send OTP.');
        }
        
        return res.status(201).json({ success: true, message: 'OTP sent successfully.' })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function verifyServiceProviderOtpAndRegister(req, res) {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
        }
        
        // Check if the service provider already exists
        const existingProvider = await ServiceProviderModel.findOne({ phone });
        if (existingProvider) {
            return res.status(409).json({ success: false, message: 'Service provider already registered' });
        }

        const otpuser = await OtpModel.findOne({ phone });

        if (!otpuser) {
            return res.status(400).json({ success: false, message: 'Service Provider not found' });
        }


        if (new Date(otpuser.otpExpires) < new Date()) {
            return res.status(400).json({ success: false, message: 'OTP has expired', expiredotp: true });
        }

        console.log(otpuser.otp);
        
        const isMatch = await bcrypt.compare(otp, otpuser.otp);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid OTP', validotp: false });
        }

        // Create new service provider
        const serviceProvider = await ServiceProviderModel.create({ phone });

        // Generate JWT token for new user
        const token = jwt.sign(
            { 
                userID: serviceProvider._id,
                phone: serviceProvider.phone
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        await ServiceProviderModel.updateOne({ phone }, { authToken: token });

        // Clean up OTP record
        await OtpModel.deleteOne({ phone });

        return res.status(201).json({
            success: true,
            message: 'Service provider verified and registered successfully',
            token,
        });
    } catch (error) {
        console.log(error);
        
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function completeServiceProviderDetails(req, res){
    try {
        const { userID } = req.sp; // Assuming the service provider ID is passed as a route parameter.
        const updateData = req.body; // Data to update is sent in the request body.

        // Fetch and update the service provider details
        const updatedServiceProvider = await ServiceProviderModel.findOneAndUpdate(
            { _id: userID },
            {
                ...updateData,
            },
            { new: true, runValidators: true } // Return the updated document and validate data.
        );

        if (!updatedServiceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Service provider details updated successfully.",
            data: updatedServiceProvider,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function uploadUserProfile(req, res) {
    try {
        const { userID } = req.sp;
        
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
        const user = await ServiceProviderModel.findById(userID);
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