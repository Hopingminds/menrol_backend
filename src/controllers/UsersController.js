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

        let user = await UserModel.findOne({ phone });
        if (!user) {
            user = await UserModel.create({ phone, userRole: 'user' });
        }
        else if(user.isAccountBlocked){
            return res.status(403).json({ success: false, message: 'ServiceProvider has been blocked' });
        }

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

        if (!req.file || !req.file.location) {
            return res.status(400).json({ 
                success: false, 
                message: "No file uploaded or file location missing." 
            });
        }

        const profileImageURL = req.file.location;

        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found." 
            });
        }

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
        const { userID, role } = req.user;
        
        let user = await UserModel.findById(userID);
        if(!user){
            return res.status(404).json({ success: false, message: "User not found."});
        }

        if (role === "serviceProvider") {
            user = await user.populate('serviceProviderInfo');
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
        const { name, email, dob, bio, perferredLanguage } = req.body;
        
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
        user.bio = bio || user.bio;
        user.bio = perferredLanguage || user.perferredLanguage;

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

        if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates. Please provide [longitude, latitude].' });
        }

        if (!address) {
            return res.status(400).json({ success: false, message: 'Address is required.' });
        }

        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        user.SavedAddresses.push({
            location: {
                type: 'Point',
                coordinates,
            },
            address,
        });

        await user.save();

        return res.status(200).json({ success: true, message: 'Address added successfully.', user });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function updateUserAddress(req, res) {
    try {
        const { userID } = req.user;
        const { index, coordinates, address } = req.body;

        if (index === undefined || index < 0) {
            return res.status(400).json({ success: false, message: 'Invalid index. Please provide a valid index.' });
        }

        if (coordinates && (!Array.isArray(coordinates) || coordinates.length !== 2)) {
            return res.status(400).json({ success: false, message: 'Invalid coordinates. Please provide [longitude, latitude].' });
        }

        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (index >= user.SavedAddresses.length) {
            return res.status(400).json({ success: false, message: 'Invalid index. Address not found.' });
        }

        if (coordinates) {
            user.SavedAddresses[index].location.coordinates = coordinates;
        }

        if (address) {
            user.SavedAddresses[index].address = address;
        }

        await user.save();

        return res.status(200).json({ success: true, message: 'Address updated successfully.', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function deleteUserAddress(req, res) {
    try {
        const { userID } = req.user;
        const { index } = req.body;

        if (index === undefined || index < 0) {
            return res.status(400).json({ success: false, message: 'Invalid index. Please provide a valid index.' });
        }

        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (index >= user.SavedAddresses.length) {
            return res.status(400).json({ success: false, message: 'Invalid index. Address not found.' });
        }

        user.SavedAddresses.splice(index, 1);

        await user.save();

        return res.status(200).json({ success: true, message: 'Address deleted successfully.', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function deleteUserAccount(req, res) {
    try {
        const { userID } = req.user;
        const user = await UserModel.findById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: "Service Provider not found" });
        }

        await UserModel.findByIdAndDelete(userID);

        return res.status(200).json({ success: true, message: "Service Provider account deleted successfully" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}