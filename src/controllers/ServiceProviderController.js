import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import OtpModel from "../models/Otp.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import ServiceRequestModel from '../models/ServiceRequest.model.js';
import ServicesModel from '../models/Services.model.js';


/** POST: http://localhost:3027/api/v1/verifyForExistingUser
 * @body {
 *  "phone": "8765445678",
 *  "email": "example@email.com"
 * }
 */
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

/** POST: http://localhost:3027/api/v1/verifyServiceProviderOtp
 * @body {
 *  "phone": "8765445678",
 *  "otp": "238295"
 * }
 */
export async function verifyServiceProviderOtp(req, res) {
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
        let serviceProvider = await ServiceProviderModel.findOne({ phone });
        if (!serviceProvider) {
            serviceProvider = await ServiceProviderModel.create({ phone, newUser: true });
        }
        else if(serviceProvider.isAccountBlocked){
            return res.status(403).json({ success: false, message: 'ServiceProvider has been blocked' });
        }

        // Generate JWT token for new user
        const token = jwt.sign(
            { 
                userID: serviceProvider._id,
                phone: serviceProvider.phone,
                role: 'serviceProvider'
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
            newUser: serviceProvider.newUser,
        });
    } catch (error) {
        console.log(error);
        
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

/** PUT: http://localhost:3027/api/v1/completeServiceProviderDetails
 * @body {
 *  "phone": "8765445678",
 *  "email": "example@email.com"
 * }
 */
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

        // Save the updated subcategories to the Services collection
        if (updateData.category && updateData.subcategory) {
            const service = await ServicesModel.findOne({ category: updateData.category });

            if (service) {
                // Update only the counts for new subcategories added by the user
                updateData.subcategory.forEach((newSub) => {
                    const existingSub = service.subcategory.find(sub => sub.title === newSub.title);
                    if (existingSub) {
                        if (newSub.pricing && newSub.pricing.pricingtype) {
                            switch (newSub.pricing.pricingtype) {
                                case 'daily':
                                    existingSub.dailyWageWorker = (existingSub.dailyWageWorker || 0) + 1;
                                    break;
                                case 'hourly':
                                    existingSub.hourlyWorker = (existingSub.hourlyWorker || 0) + 1;
                                    break;
                                case 'contract':
                                    existingSub.contractWorker = (existingSub.contractWorker || 0) + 1;
                                    break;
                            }
                        }
                    } else {
                        // Add new subcategory with initial counts
                        service.subcategory.push({
                            ...newSub,
                            dailyWageWorker: newSub.pricing.pricingtype === 'daily' ? 1 : 0,
                            hourlyWorker: newSub.pricing.pricingtype === 'hourly' ? 1 : 0,
                            contractWorker: newSub.pricing.pricingtype === 'contract' ? 1 : 0,
                        });
                    }
                });

                await service.save();
            } else {
                return res.status(404).json({ success: false, message: "Service category not found." });
            }
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

/** PUT: http://localhost:3027/api/v1/uploadUserProfile
 * @body {
 *  "profile": "file"
 * }
 */
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

/** PUT: http://localhost:3027/api/v1/uploadUserProfile
 * @body {
 *  "gallery": ["file1","file2"]
 * }
 */
export async function uploadWork(req, res) {
    try {
        const { userID } = req.sp;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "No files uploaded." 
            });
        }

        // Extract the locations (URLs) of the uploaded files
        const fileLocations = req.files.map(file => file.location);

        // Find the user and update their profile image URL
        const user = await ServiceProviderModel.findById(userID);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found." 
            });
        }

        // Add the file locations to the gallery
        user.gallery = user.gallery.concat(fileLocations);
        await user.save();

        return res.status(200).json({ 
            success: true, 
            message: "Files uploaded and gallery updated successfully.", 
            data: { gallery: user.gallery } 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

/** PUT: http://localhost:3027/api/v1/updateSPLocation
 * @body {
    "longitude": 30.698279,
    "latitude": 76.690802
}
 */
export async function updateSPLocation(req, res) {
    try {
        // Extract the user ID and new location coordinates from the request
        const { userID } = req.sp;
        const { longitude, latitude } = req.body;

        // Validate input
        if (longitude == null || latitude == null) {
            return res.status(400).json({ message: "Longitude and latitude are required." });
        }

        // Find and update the user's location
        const updatedProvider = await ServiceProviderModel.findByIdAndUpdate(
            userID  ,
            { location: { type: "Point", coordinates: [longitude, latitude] } },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );

        if (!updatedProvider) {
            return res.status(404).json({ message: "Service provider not found." });
        }

        res.status(200).json({ message: "Location updated successfully.", provider: updatedProvider });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

/** GET: http://localhost:3027/api/v1/getServicesRequestNearSPLocation?radius=10 */
export async function getServicesRequestNearSPLocation(req, res) {
    try {
        // Extract the service provider's ID and optional radius (in kilometers) from the request
        const { userID } = req.sp;
        const { radius = 5 } = req.query; // Default radius: 5 km

        // Find the service provider by ID and get their location
        const serviceProvider = await ServiceProviderModel.findById(userID);

        if (!serviceProvider) {
            return res.status(404).json({ message: "Service provider not found." });
        }

        const { coordinates } = serviceProvider.location;
        
        if (!coordinates || coordinates.length !== 2) {
            return res.status(400).json({ message: "Invalid or missing location for the service provider." });
        }

        // Convert radius from kilometers to meters (MongoDB uses meters for geospatial queries)
        const radiusInMeters = radius * 1000;

        // Find service requests within the specified radius
        const nearbyRequests = await ServiceRequestModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: coordinates,
                    },
                    $maxDistance: radiusInMeters,
                },
            },
            status: { $in: ["pending", "confirmed"] }, // Filter for relevant statuses
        });

        res.status(200).json({ message: "Nearby service requests retrieved successfully.", requests: nearbyRequests });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function getServiceProvider(req, res) {
    try {
        const { userID } = req.sp;

        const serviceProvider = await ServiceProviderModel.findById(userID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        res.status(200).json({ success: true, message: "Service provider retrieved successfully.", serviceProvider });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function uploadServiceProviderDocuments(req, res) {
    try {
        const { userID } = req.sp;

        if(!req.file){
            return res.status(400).json({ success: false, message: "No file uploaded." });
        }

        const serviceProvider = await ServiceProviderModel.findById(userID);
        if(!serviceProvider){
            return res.status(404).json({ success: false, message: "Service provider not found" });
        }

        serviceProvider.aadharCard.Image = req.file.location;
        await serviceProvider.save();

        res.status(200).json({ success: true, message: "Service provider documents uploaded successfully" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function completeServiceProviderRegistrationDetails(req, res) {
    try {
        const { userID } = req.sp;
        const { name, email } = req.body;
        if(!req.file || !name){
            return res.status(404).json({ success: false, message: "Please fill name, profile Image the fields." });
        }

        const serviceProvider = await ServiceProviderModel.findById(userID);
        if(!serviceProvider){
            return res.status(404).json({ success: false, message: "Service provider not found" });
        }

        serviceProvider.name = name;
        serviceProvider.profileImage = req.file.location;
        serviceProvider.email = email;
        serviceProvider.newUser = false;

        await serviceProvider.save();
        return res.status(201).json({ success: true, message: "Registration Completed." })
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}