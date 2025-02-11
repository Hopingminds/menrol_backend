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

        if (phone !== '9898989898') {
            await OtpModel.deleteOne({ phone });
        }

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

        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

const validateEmail = (email) => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

export async function editUserProfile(req, res) {
    try {
        const { userID } = req.user;
        const { name, email, dob } = req.body;
        
        if(email && !validateEmail(email)){
            return res.status(404).json({ success: false, message: "Invalid Email." });
        }

        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }
        user.name = name || user.name;
        user.email = email || user.email;
        user.dob = dob || user.dob;

        await user.save();

        return res.status(201).json({ success: true, message: "User profile updated successfully.", data: user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function addUserAddress(req, res) {
    try {
        const { userID } = req.user;
        const { coordinates, address } = req.body;

        // Validate required fields
        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates. Please provide [longitude, latitude].' });
        }

        if (!address) {
            return res.status(400).json({ success: false, message: 'Address is required.' });
        }

        // Find user by ID
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Add the new address to the SavedAddresses array
        user.SavedAddresses.push({
            location: {
                type: 'Point',
                coordinates,
            },
            address,
        });

        // Save the updated user document
        await user.save();

        return res.status(200).json({ success: true, message: 'Address added successfully.', user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function updateUserAddress(req, res) {
    try {
        const { userID } = req.user; // Assuming req.user contains userID after authentication
        const { index, coordinates, address } = req.body;

        // Validate the index
        if (index === undefined || index < 0) {
            return res.status(400).json({ success: false, message: 'Invalid index. Please provide a valid index.' });
        }

        // Validate coordinates if provided
        if (coordinates && (!Array.isArray(coordinates) || coordinates.length !== 2)) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates. Please provide [longitude, latitude].' });
        }

        // Find user by ID
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if the index is within bounds
        if (index >= user.SavedAddresses.length) {
            return res.status(400).json({ success: false, message: 'Invalid index. Address not found.' });
        }

        // Update the address fields if provided
        if (coordinates) {
            user.SavedAddresses[index].location.coordinates = coordinates;
        }

        if (address) {
            user.SavedAddresses[index].address = address;
        }

        // Save the updated user document
        await user.save();

        return res.status(200).json({ success: true, message: 'Address updated successfully.', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function deleteUserAddress(req, res) {
    try {
        const { userID } = req.user; // Assuming req.user contains userID after authentication
        const { index } = req.body;

        // Validate the index
        if (index === undefined || index < 0) {
            return res.status(400).json({ success: false, message: 'Invalid index. Please provide a valid index.' });
        }

        // Find user by ID
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if the index is within bounds
        if (index >= user.SavedAddresses.length) {
            return res.status(400).json({ success: false, message: 'Invalid index. Address not found.' });
        }

        // Remove the address at the specified index
        user.SavedAddresses.splice(index, 1);

        // Save the updated user document
        await user.save();

        return res.status(200).json({ success: true, message: 'Address deleted successfully.', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}