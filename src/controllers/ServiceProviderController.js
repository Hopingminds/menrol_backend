import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import OtpModel from "../models/Otp.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import ServiceRequestModel from '../models/ServiceRequest.model.js';
import ServicesModel from '../models/Services.model.js';
import ServiceOrderModel from '../models/ServiceOrder.model.js';
import ServiceProviderOrderModel from '../models/ServiceProviderOrder.model.js';
import ServiceProviderPaymentsModel from '../models/ServiceProviderPayments.model.js';
import { populateSubcategoryInServiceOrder, populateSubcategoryInServiceProviderOrder } from '../lib/populateSubcategory.js';
import notificationEmitter from '../events/notificationEmitter.js';
import UserModel from '../models/User.model.js';
import ServiceProviderInfoModel from '../models/ServiceProviderInfo.model.js';
import { populate } from 'dotenv';


/** POST: http://localhost:3027/api/v1/verifyForExistingServiceProvide
 * @body {
 *  "phone": "8765445678",
 *  "email": "example@email.com"
 * }
 */
export async function verifyForExistingServiceProvide(req, res) {
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

        let serviceProvider = await UserModel.findOne({ phone });

        if (serviceProvider && serviceProvider.isAccountBlocked) {
            return res.status(403).json({ success: false, message: 'Service provider has been blocked' });
        }

        let serviceProviderInfo;

        if (!serviceProvider) {
            // Create new service provider
            serviceProvider = await UserModel.create({ 
                phone, 
                newUser: true, 
                userRole: 'serviceProvider' 
            });

            // Create corresponding ServiceProviderInfo entry
            serviceProviderInfo = await ServiceProviderInfoModel.create({
                user: serviceProvider._id,  // Link to the user
            });

            // Save ServiceProviderInfo _id in UserModel
            serviceProvider.serviceProviderInfo = serviceProviderInfo._id;
            await serviceProvider.save();
        } else {
            // Ensure there's a corresponding ServiceProviderInfo entry
            serviceProviderInfo = await ServiceProviderInfoModel.findOne({ user: serviceProvider._id });
            if (!serviceProviderInfo) {
                serviceProviderInfo = await ServiceProviderInfoModel.create({ user: serviceProvider._id });
                
                // Update UserModel with the newly created ServiceProviderInfo ID
                serviceProvider.serviceProviderInfo = serviceProviderInfo._id;
                await serviceProvider.save();
            }
        }

        // Generate JWT token for new user
        const token = jwt.sign(
            { 
                userID: serviceProvider._id,
                phone: serviceProvider.phone,
                role: "serviceProvider",
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        await UserModel.updateOne({ phone }, { authToken: token });

        // Clean up OTP record
        if (phone !== '9898989898') {
            await OtpModel.deleteOne({ phone });
        }

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
        const { userID } = req.sp;
        const { serviceProviderInfo, ...userUpdateData } = req.body;

        // Run both updates concurrently
        const [updatedUser, updatedServiceProviderInfo] = await Promise.all([
            UserModel.findByIdAndUpdate(userID, { $set: userUpdateData }, { new: true, runValidators: true }),
            serviceProviderInfo ? 
                ServiceProviderInfoModel.findOneAndUpdate(
                    { user: userID },
                    { $set: serviceProviderInfo },
                    { new: true, runValidators: true, upsert: true }
                ) 
                : null
        ]);

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        // Populate serviceProviderInfo in the updated user document
        await updatedUser.populate('serviceProviderInfo');
        return res.status(200).json({
            success: true,
            message: "Service provider details updated successfully.",
            data: updatedUser,
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
export async function uploadUserProfile(req, res) {  //Removed
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

        const serviceProviderInfo = await ServiceProviderInfoModel.findOne({ user: userID });
        if (!serviceProviderInfo) {
            return res.status(404).json({
                success: false,
                message: "Service provider information not found."
            });
        }

        // Add the file locations to the gallery
        serviceProviderInfo.gallery = serviceProviderInfo.gallery.concat(fileLocations);
        await serviceProviderInfo.save();

        return res.status(200).json({
            success: true,
            message: "Files uploaded and gallery updated successfully.",
            data: { gallery: serviceProviderInfo.gallery }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
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
            return res.status(400).json({ success: false, message: "Longitude and latitude are required." });
        }

        // Find and update the user's location
        const updatedProvider = await ServiceProviderInfoModel.findOneAndUpdate(
            {user: userID}  ,
            { location: { type: "Point", coordinates: [longitude, latitude] } },
            { new: true, runValidators: true } // Return the updated document and run schema validators
        );

        if (!updatedProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        res.status(200).json({ success: true, message: "Location updated successfully.", provider: updatedProvider });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function changeWorkStatus(req, res) {
    try {
        const { userID } = req.sp;

        const provider = await UserModel.findById(userID);
        if (!provider) {
            return res.status(404).json({ success: false, message: "No Service Provider found." })
        }

        provider.isOnline = !provider.isOnline;
        await provider.save();

        res.status(200).json({ success: true, message: "Work status changed successfully." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

/** GET: http://localhost:3027/api/v1/getServicesRequestNearSPLocation?radius=10 */
export async function getServicesRequestNearSPLocation(req, res) {
    try {
        // Extract the service provider's ID and optional radius (in kilometers) from the request
        const { userID } = req.sp;
        const { radius = 5 } = req.query; // Default radius: 5 km

        // Find the service provider by ID and get their location
        const serviceProvider = await UserModel.findById(userID).populate('serviceProviderInfo');

        if (!serviceProvider) {
            return res.status(404).json({ message: "Service provider not found." });
        }

        const { coordinates } = serviceProvider.serviceProviderInfo.location;
        
        if (!coordinates || coordinates.length !== 2) {
            return res.status(400).json({ message: "Invalid or missing location for the service provider." });
        }

        // Convert radius from kilometers to meters (MongoDB uses meters for geospatial queries)
        const radiusInMeters = radius * 1000;

        // Find service requests within the specified radius
        const nearbyRequests = await ServiceOrderModel.find({
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: coordinates,
                    },
                    $maxDistance: radiusInMeters,
                },
            },
            "serviceRequest.subcategory": {
                $elemMatch: {
                    status: { $in: ["pending"] }, // Status inside subcategory
                },
            }, // Filter for relevant statuses
        }).populate({path:'user' , select:'-SavedAddresses -dob -isAccountBlocked -serviceProviderInfo -newUser'})
        .populate({ path: 'serviceRequest.service', select: '-subcategory' })

        const requests = await Promise.all(
            nearbyRequests.map(async (request) => {
                const updatedRequest = await populateSubcategoryInServiceOrder(request);

                const requestObject = request.toObject();
                delete requestObject.serviceRequest;
                requestObject.serviceRequest = updatedRequest;

                return requestObject;
            })
        )
        res.status(200).json({ message: "Nearby service requests retrieved successfully.", requests: requests });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function getServiceProvider(req, res) {
    try {
        const { userID } = req.sp;

        const serviceProvider = await UserModel.findById(userID).populate([
            {
                path: 'serviceProviderInfo',
                populate: [
                    {
                        path: 'skills.category',
                        select: '-subcategory',
                    },
                    {
                        path: 'activeSubscription',
                        select: 'subscription trxnId startDate endDate paymentStatus status',
                        populate: { path: 'subscription' }
                    },
                    {
                        path: 'providerSubscription'
                    }
                ]
            }
        ]);        

        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        // Step 1: Fetch all unique category IDs from the service provider's skills
        const categoryIds = serviceProvider.serviceProviderInfo.skills
            .filter(skill => skill.category && skill.category._id)
            .map(skill => skill.category._id);

        // Step 2: Fetch all subcategories for the categories in one go
        const services = await ServicesModel.find({ '_id': { $in: categoryIds } }).select('subcategory _id');

        // Step 3: Build a lookup map for subcategories
        const subcategoryLookup = services.reduce((lookup, service) => {
            lookup[service._id.toString()] = service.subcategory;
            return lookup;
        }, {});

        // Step 4: Transform skills to replace subcategories using the lookup map
        const updatedSkills = serviceProvider.serviceProviderInfo.skills.map(skill => {
            if (skill.category && skill.category._id) {
                const categorySubcategories = subcategoryLookup[skill.category._id.toString()] || [];
        
                // Step 5: Replace subcategories with the matching ones from the lookup map
                const updatedSubcategories = skill.subcategories.map(sub => {
                    const matchingSubcategory = categorySubcategories.find(
                        s => s._id.toString() === sub.subcategory.toString()
                    );
        
                    // Use toObject() to convert Mongoose document to plain object
                    const updatedSub = {
                        ...sub.toObject(), // Convert to plain object
                        subcategory: matchingSubcategory || sub.subcategory, // Keep original if no match
                    };
        
                    return updatedSub;
                });
        
                
                // Return the skill with updated subcategories
                return {
                    ...skill.toObject(), // Convert to plain object
                    subcategories: updatedSubcategories,
                };
            }
            
            return skill.toObject(); // Return the skill as is, converted to plain object
        });
        
        const responseObject = serviceProvider.toObject();
        // Remove the `skills` field
        delete responseObject.serviceProviderInfo.skills;
        responseObject.serviceProviderInfo.skills = updatedSkills;

        res.status(200).json({ success: true, message: "Service provider retrieved successfully.", data: responseObject });
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

        const serviceProvider = await ServiceProviderInfoModel.findOne({ user: userID });
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found" });
        }

        serviceProvider.aadharCard.image = req.file.location;
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

        const serviceProvider = await UserModel.findById(userID);
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

export async function addServiceProviderSkills(req, res) {
    try {
        const { userID } = req.sp;
        const { skills } = req.body;

        if (!skills || !Array.isArray(skills)) {
            return res.status(400).json({
                success: false,
                message: "Invalid input. Please provide skills array.",
            });
        }

        const provider = await UserModel.findById(userID).populate('serviceProviderInfo');
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        // Ensure serviceProviderInfo exists
        if (!provider.serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider information not found.",
            });
        }

        const serviceProviderInfo = await ServiceProviderInfoModel.findById(provider.serviceProviderInfo);
        if (!serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider details missing.",
            });
        }
        // Merge new skills with existing ones
        for (const skill of skills) {
            const categoryIndex = serviceProviderInfo.skills.findIndex(
                (existingSkill) =>
                    existingSkill.category.toString() === skill.category
            );
            const service = await ServicesModel.findOne({ _id: skill.category });
        
            if (categoryIndex !== -1) {
                // If the category exists, merge subcategories
                for (const subcategory of skill.subcategories) {
                    const subcategoryIndex = serviceProviderInfo.skills[categoryIndex].subcategories.findIndex(
                        (existingSub) =>
                            existingSub.subcategory.toString() === subcategory.subcategory
                    );
        
                    if (subcategoryIndex !== -1) {
                        // Update pricing if subcategory exists
                        serviceProviderInfo.skills[categoryIndex].subcategories[
                            subcategoryIndex
                        ].pricing = subcategory.pricing;
                    } else {
                        // Add new subcategory
                        const matchingSub = service.subcategory.find(
                            (sub) => sub._id.toString() === subcategory.subcategory
                        );
        
                        if (matchingSub) {
                            for (const pricingDetail of subcategory.pricing) {
                                if (pricingDetail.pricingtype === 'hourly') {
                                    matchingSub.hourlyWorker = (matchingSub.hourlyWorker || 0) + 1;
                                } else if (pricingDetail.pricingtype === 'daily') {
                                    matchingSub.dailyWageWorker = (matchingSub.dailyWageWorker || 0) + 1;
                                } else if (pricingDetail.pricingtype === 'contract') {
                                    matchingSub.contractWorker = (matchingSub.contractWorker || 0) + 1;
                                }
                            }
                            serviceProviderInfo.skills[categoryIndex].subcategories.push(subcategory);
                            await service.save();
                        }        
                    }
                }
            } else {
                // Add new category and process subcategories
                for (const subcategory of skill.subcategories) {
                    const matchingSub = service.subcategory.find(
                        (sub) => sub._id.toString() === subcategory.subcategory
                    );

                    if (matchingSub) {
                        for (const pricingDetail of subcategory.pricing) {
                            if (pricingDetail.pricingtype === 'hourly') {
                                matchingSub.hourlyWorker = (matchingSub.hourlyWorker || 0) + 1;
                            } else if (pricingDetail.pricingtype === 'daily') {
                                matchingSub.dailyWageWorker = (matchingSub.dailyWageWorker || 0) + 1;
                            } else if (pricingDetail.pricingtype === 'contract') {
                                matchingSub.contractWorker = (matchingSub.contractWorker || 0) + 1;
                            }
                        }
                    }
                }
                serviceProviderInfo.skills.push(skill);
                await service.save();
            }
        }            

        // Save the updated provider
        await serviceProviderInfo.save();

        res.status(200).json({
            success: true,
            message: "Skills added successfully.",
            data: serviceProviderInfo.skills,
        });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function updateServiceProviderSkills(req, res) {
    try {
        const { userID } = req.sp; // ID of the logged-in service provider
        const { skills } = req.body;

        if (!skills || !Array.isArray(skills)) {
            return res.status(400).json({
                success: false,
                message: "Invalid input. Please provide a valid skills array.",
            });
        }

        const provider = await UserModel.findById(userID).populate('serviceProviderInfo');
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        // Ensure serviceProviderInfo exists
        if (!provider.serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider information not found.",
            });
        }

        const serviceProviderInfo = await ServiceProviderInfoModel.findById(provider.serviceProviderInfo);
        if (!serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider details missing.",
            });
        }

        for (const skill of skills) {
            const categoryIndex = serviceProviderInfo.skills.findIndex(
                (existingSkill) =>
                    existingSkill.category.toString() === skill.category
            );
            const service = await ServicesModel.findOne({ _id: skill.category });
            if (categoryIndex !== -1) {
                // If the category exists, update subcategories
                for (const subcategory of skill.subcategories) {
                    const subcategoryIndex = serviceProviderInfo.skills[categoryIndex].subcategories.findIndex(
                        (existingSub) =>
                            existingSub.subcategory.toString() === subcategory.subcategory
                    );

                    if (subcategoryIndex !== -1) {
                        // Update pricing for existing subcategory
                        serviceProviderInfo.skills[categoryIndex].subcategories[subcategoryIndex].pricing =
                            subcategory.pricing ||
                            serviceProviderInfo.skills[categoryIndex].subcategories[subcategoryIndex].pricing;
                    } else {
                        // Add new subcategory if not present
                        const matchingSub = service.subcategory.find(
                            (sub) => sub._id.toString() === subcategory.subcategory
                        );
        
                        if (matchingSub) {
                            for (const pricingDetail of subcategory.pricing) {
                                if (pricingDetail.pricingtype === 'hourly') {
                                    matchingSub.hourlyWorker = (matchingSub.hourlyWorker || 0) + 1;
                                } else if (pricingDetail.pricingtype === 'daily') {
                                    matchingSub.dailyWageWorker = (matchingSub.dailyWageWorker || 0) + 1;
                                } else if (pricingDetail.pricingtype === 'contract') {
                                    matchingSub.contractWorker = (matchingSub.contractWorker || 0) + 1;
                                }
                            }
                            serviceProviderInfo.skills[categoryIndex].subcategories.push(subcategory);
                            await service.save();
                        }
                    }
                }

                // Remove subcategories not present in the new skills array
                serviceProviderInfo.skills[categoryIndex].subcategories = serviceProviderInfo.skills[categoryIndex].subcategories.filter(
                    (existingSub) =>
                        skill.subcategories.some(
                            (subcategory) =>
                                subcategory.subcategory === existingSub.subcategory.toString()
                        )
                );

                // If no subcategories remain, remove the skill
                if (serviceProviderInfo.skills[categoryIndex].subcategories.length === 0) {
                    serviceProviderInfo.skills.splice(categoryIndex, 1);
                }
            } else {
                // If the category doesn't exist, add the new skill
                for (const subcategory of skill.subcategories) {
                    const matchingSub = service.subcategory.find(
                        (sub) => sub._id.toString() === subcategory.subcategory
                    );

                    if (matchingSub) {
                        for (const pricingDetail of subcategory.pricing) {
                            if (pricingDetail.pricingtype === 'hourly') {
                                matchingSub.hourlyWorker = (matchingSub.hourlyWorker || 0) + 1;
                            } else if (pricingDetail.pricingtype === 'daily') {
                                matchingSub.dailyWageWorker = (matchingSub.dailyWageWorker || 0) + 1;
                            } else if (pricingDetail.pricingtype === 'contract') {
                                matchingSub.contractWorker = (matchingSub.contractWorker || 0) + 1;
                            }
                        }
                    }
                }
                serviceProviderInfo.skills.push(skill);
                await service.save();
            }
        }
        // Remove categories not present in the updated skills array
        serviceProviderInfo.skills = serviceProviderInfo.skills.filter((existingSkill) =>
            skills.some((updatedSkill) => updatedSkill.category === existingSkill.category.toString())
        );

        // Save the updated provider
        await serviceProviderInfo.save();

        res.status(200).json({
            success: true,
            message: "Skills updated successfully.",
            data: serviceProviderInfo.skills,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function removeServiceProviderSubcategory(req, res) {
    try {
        const { userID } = req.sp; // ID of the logged-in service provider
        const { category, subcategory } = req.body;

        if (!category || !subcategory) {
            return res.status(400).json({
                success: false,
                message: "Invalid input. Please provide both category and subcategory IDs.",
            });
        }

        const provider = await UserModel.findById(userID).populate('serviceProviderInfo');
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        // Ensure serviceProviderInfo exists
        if (!provider.serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider information not found.",
            });
        }

        const serviceProviderInfo = await ServiceProviderInfoModel.findById(provider.serviceProviderInfo);
        if (!serviceProviderInfo) {
            return res.status(400).json({
                success: false,
                message: "Service provider details missing.",
            });
        }

        // Find the category index
        const categoryIndex = serviceProviderInfo.skills.findIndex(
            (skill) => skill.category.toString() === category
        );

        if (categoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }

        // Find the subcategory index
        const subcategoryIndex = serviceProviderInfo.skills[categoryIndex].subcategories.findIndex(
            (sub) => sub.subcategory.toString() === subcategory
        );

        if (subcategoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found.",
            });
        }

        // Remove the subcategory
        serviceProviderInfo.skills[categoryIndex].subcategories.splice(subcategoryIndex, 1);

        // If no subcategories are left, remove the category
        if (serviceProviderInfo.skills[categoryIndex].subcategories.length === 0) {
            serviceProviderInfo.skills.splice(categoryIndex, 1);
        }

        // Save the updated provider
        await serviceProviderInfo.save();

        res.status(200).json({
            success: true,
            message: "Subcategory removed successfully.",
            data: serviceProviderInfo.skills,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function updateOrderSubcategoryViewer(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId } = req.body;

        const order = await ServiceOrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const serviceRequest = order.serviceRequest.find(req => req.service.toString() === serviceId);
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found in the order." });
        }

        const subcategory = serviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found in the service request." });
        }

        if (subcategory.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Subcategory is already ${subcategory.status}.`,
            });
        }

        if (!subcategory.viewers.some(viewer => viewer.serviceProvider.toString() === userID)) {
            subcategory.viewers.push({ serviceProvider: userID });
        }        
        
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Subcategory viewer updated successfully."
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function acceptServiceOrder(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId } = req.body;

        const order = await ServiceOrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const serviceRequest = order.serviceRequest.find(req => req.service.toString() === serviceId);
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found in the order." });
        }

        const subcategory = serviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found in the service request." });
        }

        if (subcategory.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Subcategory is already ${subcategory.status}.`,
            });
        }

        const existingProviderIndex = subcategory.serviceProviders.findIndex( ServiceProvider => ServiceProvider.serviceProviderId.toString() === userID);
        
        if(existingProviderIndex !== -1) {
            return res.json({
                success: false,
                message: "You are already a service provider for this service."
            })
        }
        else{
            subcategory.serviceProviders.push({
                serviceProviderId: userID,
                status: 'confirmed',
            });
        }

        const acceptedServiceProvider = subcategory.serviceProviders.filter(s => s.status === 'confirmed');
        if(subcategory.workersRequirment === acceptedServiceProvider.length){
            subcategory.status = 'confirmed';
        }

        // Save or update the ServiceProviderOrder details
        const existingServiceProviderOrder = await ServiceProviderOrderModel.findOne({
            ServiceProvider: userID,
            serviceOrderId: orderId,
        });

        if (!existingServiceProviderOrder) {
            // Create a new ServiceProviderOrder
            const newServiceProviderOrder = new ServiceProviderOrderModel({
                ServiceProvider: userID,
                serviceOrderId: orderId,
                servicesProvided: [
                    {
                        serviceId,
                        subcategory: [
                            {
                                subcategoryId,
                                title: subcategory.title,
                                requestType: subcategory.requestType,
                                selectedAmount: subcategory.selectedAmount,
                                instructions: subcategory.instructions || "",
                                instructionsImages: subcategory.instructionsImages || [],
                                scheduledTiming: subcategory.scheduledTiming,
                                workersRequirment: subcategory.workersRequirment,
                                assignedWorkers: 1, // Default to 0, can be updated later
                                serviceStatus: 'confirmed',
                                otpDetails: {
                                    startOtp: 0,
                                    endOtp: 0,
                                    startOtpConfirmed: false,
                                    endOtpConfirmed: false,
                                },
                                workConfirmation: {
                                    workStarted: false,
                                    startTime: null,
                                    workEnded: false,
                                    endTime: null,
                                },
                            },
                        ],
                    },
                ],
                location: order.location,
                address: order.address,
                paymentDetails: {
                    totalAmount: order.payment.totalamount,
                    paidAmount: order.payment.paidAmount,
                    dueAmount: order.payment.dueAmount,
                    paymentType: order.payment.paymentType,
                    paymentStatus: order.payment.paymentstatus,
                    lastPaymentDate: order.payment.paymentDate,
                },
            });
            await newServiceProviderOrder.save();
        } else {
            // Update the existing ServiceProviderOrder
            const service = existingServiceProviderOrder.servicesProvided.find(s => s.serviceId.toString() === serviceId);
            if (!service) {
                // Add a new service
                existingServiceProviderOrder.servicesProvided.push({
                    serviceId,
                    subcategory: [
                        {
                            subcategoryId,
                            title: subcategory.title,
                            requestType: subcategory.requestType,
                            selectedAmount: subcategory.selectedAmount,
                            instructions: subcategory.instructions || "",
                            instructionsImages: subcategory.instructionsImages || [],
                            scheduledTiming: subcategory.scheduledTiming,
                            workersRequirment: subcategory.workersRequirment,
                            assignedWorkers: 1, // Default to 0, can be updated later
                            serviceStatus: 'confirmed',
                            otpDetails: {
                                startOtp: 0,
                                endOtp: 0,
                                startOtpConfirmed: false,
                                endOtpConfirmed: false,
                            },
                            workConfirmation: {
                                workStarted: false,
                                startTime: null,
                                workEnded: false,
                                endTime: null,
                            },
                        },
                    ],
                });
            } else {
                // Add a new subcategory to the existing service
                service.subcategory.push({
                    subcategoryId,
                    title: subcategory.title,
                    requestType: subcategory.requestType,
                    selectedAmount: subcategory.selectedAmount,
                    instructions: subcategory.instructions || "",
                    instructionsImages: subcategory.instructionsImages || [],
                    scheduledTiming: subcategory.scheduledTiming,
                    workersRequirment: subcategory.workersRequirment,
                    assignedWorkers: 1, // Default to 0, can be updated later
                    serviceStatus: 'confirmed',
                    otpDetails: {
                        startOtp: 0,
                        endOtp: 0,
                        startOtpConfirmed: false,
                        endOtpConfirmed: false,
                    },
                    workConfirmation: {
                        workStarted: false,
                        startTime: null,
                        workEnded: false,
                        endTime: null,
                    },
                });
            }
            await existingServiceProviderOrder.save();
        }

        await order.save();

        // Notify clients about the update
        notificationEmitter.emit('userUpdatedForRaisedOrder', { userID: order.user, message: 'message emitted for userUpdatedForRasiedOrder.' });

        return res.status(200).json({
            success: true,
            message: "Subcategory accepted successfully.",
            order,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getServiceProviderAllOrders(req, res) {
    try {
        const { userID } = req.sp;
        const serviceProviderOrder = await ServiceProviderOrderModel.find({ ServiceProvider: userID }).populate({
            path: 'servicesProvided.serviceId',
            model: 'Services',
            select: '-subcategory'
        }).populate({
            path: 'serviceOrderId',
            select: 'user',
            populate: {
                path: 'user',
                select: 'name phone email profileImage perferredLanguage'
            },        
        });

        if(!serviceProviderOrder){
            return res.status(404).json({ success: false, message: 'No Order Found.'})
        }

        const orders = await Promise.all(
            serviceProviderOrder.map(async (order) => {
                const updatedRequestedServices = await populateSubcategoryInServiceProviderOrder(order);
                
                // Convert to plain object and replace servicesProvided with the updated one
                const orderObject = order.toObject();
                delete orderObject.servicesProvided;
                orderObject.servicesProvided = updatedRequestedServices;
        
                return orderObject;
            })
        );

        // Categorize orders by status
        const categorizedOrders = {
            pending: [],
            confirmed: [],
            completed: [],
            cancelled: []
        };

        const allCategoriesTitles = []; // Tracks categories across all orders

        // Iterate over each service order
        for (const order of orders) {
            const orderClone = JSON.parse(JSON.stringify(order)); // Deep copy to avoid mutating original data

            // Categories specific to this order
            const orderCategoriesTitles = [];

            // Prepare subcategories for each status
            const statusBuckets = {
                pending: [],
                confirmed: [],
                completed: [],
                cancelled: []
            };

            // Iterate over each service request in the order
            for (const request of order.servicesProvided) {
                const service = await ServicesModel.findById(request.serviceId._id);

                if (service) {
                    // Add the category to the order's categoriesTitles if not already added
                    if (!orderCategoriesTitles.includes(service.category)) {
                        orderCategoriesTitles.push(service.category);
                    }

                    // Add the category to the global categoriesTitles if not already added
                    if (!allCategoriesTitles.includes(service.category)) {
                        allCategoriesTitles.push(service.category);
                    }
                }

                // Iterate over subcategories and categorize by status
                request.subcategory.forEach(subcat => {
                    if (subcat.serviceStatus === "inProgress") {
                        statusBuckets.confirmed.push(subcat);
                    } else if (statusBuckets[subcat.serviceStatus]) {
                        statusBuckets[subcat.serviceStatus].push(subcat);
                    }
                });
            }

            // Add the order to categorizedOrders only once per status
            Object.keys(statusBuckets).forEach(status => {
                if (statusBuckets[status].length > 0) {
                    const filteredOrder = {
                        ...orderClone,
                        servicesProvided: orderClone.servicesProvided.map(req => ({
                            ...req,
                            subcategory: statusBuckets[status].filter(
                                subcat => req.subcategory.find(sc => sc._id.toString() === subcat._id.toString())
                            )
                        })).filter(req => req.subcategory.length > 0), // Remove requests with no subcategories for this status
                        categoriesTitles: orderCategoriesTitles // Include categories specific to this order
                    };
                    categorizedOrders[status].push(filteredOrder);
                }
            });
        }

        return res.status(200).json({ success: true, message: 'Orders found.', data: categorizedOrders });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function confirmStartWorkingOtp(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId, startOtp } = req.body;

        if(!orderId || !serviceId || !subcategoryId || !startOtp){
            return res.status(404).json({ success: false, message: 'Missing Required fields.'})
        }
        const serviceProviderOrder = await ServiceProviderOrderModel.findOne({ ServiceProvider: userID, serviceOrderId: orderId });
        if (!serviceProviderOrder) {
            return res.status(404).json({ success: false, message: 'service Provider Order Not Found.' });
        }

        const order = await ServiceOrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order Not Found.' });
        }

        const serviceRequest = order.serviceRequest.find(req => req.service.toString() === serviceId);
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found in the order." });
        }

        const subcategory = serviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found in the service request." });
        }

        if (subcategory.status === 'completed' || subcategory.status === 'inProgress' || subcategory.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: `Subcategory is ${subcategory.status}.`,
            });
        }

        //check service provider is in the subcategory
        const serviceProviderSubcategory = subcategory.serviceProviders.find(s => s.serviceProviderId.toString() === userID);
        if (!serviceProviderSubcategory) {
            return res.status(404).json({ success: false, message: 'Service Provider Not Found for the order request' });
        }

        subcategory.status = 'inProgress';
        serviceProviderSubcategory.status = 'inProgress';

        if (startOtp !== subcategory.requestOperation.startOtp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }

        const serviceProviderOrderserviceRequest = serviceProviderOrder.servicesProvided.find(req => req.serviceId.toString() === serviceId);
        if (!serviceProviderOrderserviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found for service Provider order." });
        }

        const serviceProviderOrdersubcategory = serviceProviderOrderserviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!serviceProviderOrdersubcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found for service Provider order." });
        }

        serviceProviderOrdersubcategory.serviceStatus = 'inProgress';
        serviceProviderOrdersubcategory.otpDetails.startOtp = startOtp;
        serviceProviderOrdersubcategory.otpDetails.startOtpConfirmed = true;
        serviceProviderOrdersubcategory.workConfirmation.workStarted = true;
        serviceProviderOrdersubcategory.workConfirmation.startTime = Date.now();

        await order.save();
        await serviceProviderOrder.save();
        return res.status(200).json({ success: true, message: "Service started successfully.", serviceProviderOrder });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function confirmEndWorkingOtp(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId, endOtp } = req.body;

        if (!orderId || !serviceId || !subcategoryId || !endOtp) {
            return res.status(404).json({ success: false, message: 'Missing Required fields.' })
        }
        const serviceProviderOrder = await ServiceProviderOrderModel.findOne({ ServiceProvider: userID, serviceOrderId: orderId });
        if (!serviceProviderOrder) {
            return res.status(404).json({ success: false, message: 'service Provider Order Not Found.' });
        }

        const order = await ServiceOrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order Not Found.' });
        }

        const serviceRequest = order.serviceRequest.find(req => req.service.toString() === serviceId);
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found in the order." });
        }

        const subcategory = serviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found in the service request." });
        }

        if (subcategory.status !== 'inProgress' || subcategory.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: `Subcategory is ${subcategory.status}.`,
            });
        }

        //check service provider is in the subcategory
        const serviceProviderSubcategory = subcategory.serviceProviders.find(s => s.serviceProviderId.toString() === userID);
        if (!serviceProviderSubcategory) {
            return res.status(404).json({ success: false, message: 'Service Provider Not Found for the order request' });
        }

        serviceProviderSubcategory.status = 'completed';

        if (endOtp !== subcategory.requestOperation.endOtp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP.' });
        }

        const serviceProviderOrderserviceRequest = serviceProviderOrder.servicesProvided.find(req => req.serviceId.toString() === serviceId);
        if (!serviceProviderOrderserviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found for service Provider order." });
        }

        const serviceProviderOrdersubcategory = serviceProviderOrderserviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!serviceProviderOrdersubcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found for service Provider order." });
        }

        if(!serviceProviderOrdersubcategory.paymentReceived){
            return res.status(400).json({ success: false, message: 'Collect Payment First.' });
        }

        serviceProviderOrdersubcategory.serviceStatus = 'completed';
        serviceProviderOrdersubcategory.otpDetails.endOtp = endOtp;
        serviceProviderOrdersubcategory.otpDetails.endOtpConfirmed = true;
        serviceProviderOrdersubcategory.workConfirmation.workEnded = true;
        serviceProviderOrdersubcategory.workConfirmation.endTime = Date.now();

        await order.save();
        await serviceProviderOrder.save();

        return res.status(200).json({ success: true, message: "Service ended successfully.", serviceProviderOrder });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function paymentCollectForOrder(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId, paymentReceived } = req.body;

        if (!orderId || !serviceId || !subcategoryId || !paymentReceived) {
            return res.status(404).json({ success: false, message: 'Missing Required fields.' })
        }
        const serviceProviderOrder = await ServiceProviderOrderModel.findOne({ ServiceProvider: userID, serviceOrderId: orderId });
        if (!serviceProviderOrder) {
            return res.status(404).json({ success: false, message: 'service Provider Order Not Found.' });
        }
        
        const order = await ServiceOrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order Not Found.' });
        }
        
        const serviceRequest = order.serviceRequest.find(req => req.service.toString() === serviceId);
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found in the order." });
        }
        
        const subcategory = serviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found in the service request." });
        }

        //check service provider is in the subcategory
        const serviceProviderSubcategory = subcategory.serviceProviders.find(s => s.serviceProviderId.toString() === userID);
        if (!serviceProviderSubcategory) {
            return res.status(404).json({ success: false, message: 'Service Provider Not Found for the order request' });
        }

        if(serviceProviderSubcategory.paymentReceived){
            return res.status(400).json({ success: false, message: 'Payment already received.' });
        }

        const serviceProvidersCompletedOrder = subcategory.serviceProviders.filter(s => s.status === 'completed')
        if(serviceProvidersCompletedOrder.length === subcategory.workersRequirment){
            subcategory.status = 'completed';
        }

        const serviceProviderOrderserviceRequest = serviceProviderOrder.servicesProvided.find(req => req.serviceId.toString() === serviceId);
        if (!serviceProviderOrderserviceRequest) {
            return res.status(404).json({ success: false, message: "Service not found for service Provider order." });
        }

        const serviceProviderOrdersubcategory = serviceProviderOrderserviceRequest.subcategory.find(
            sub => sub.subcategoryId.toString() === subcategoryId
        );
        if (!serviceProviderOrdersubcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found for service Provider order." });
        }

        serviceProviderSubcategory.paymentReceived = paymentReceived;
        serviceProviderOrdersubcategory.paymentReceived = paymentReceived;
        serviceProviderOrdersubcategory.serviceStatus = 'completed';

        const serviceProviderPayment = new ServiceProviderPaymentsModel({
            serviceProviderId: userID,
            serviceOrderId: orderId,
            orderServiceId: serviceId,
            orderSubcategoryId: subcategoryId,
            totalEarned: subcategory.selectedAmount,
            paymentCredited: paymentReceived,
            paymentDetails:{
                paymentStatus: paymentReceived?"credited":"pending"
            },
            paymentCreditDate: new Date(new Date().getTime() + (5 * 60 + 30) * 60 * 1000)
        });

        await serviceProviderPayment.save();
        await order.save();
        await serviceProviderOrder.save();

        return res.status(200).json({ success: true, message: "Service Payment Collected.", order, serviceProviderOrder });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function deleteServiceProviderAccount(req, res) {
    try {
        const { userID } = req.sp;
        const serviceProvider = await UserModel.findById(userID);
        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service Provider not found" });
        }

        await ServiceProviderModel.findByIdAndDelete(userID);

        return res.status(200).json({ success: true, message: "Service Provider account deleted successfully" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}