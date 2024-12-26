import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'
import OtpModel from "../models/Otp.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import ServiceRequestModel from '../models/ServiceRequest.model.js';
import ServicesModel from '../models/Services.model.js';
import ServiceOrderModel from '../models/ServiceOrder.model.js';
import ServiceProviderOrderModel from '../models/ServiceProviderOrder.model.js';


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

        const serviceProvider = await ServiceProviderModel.findById(userID).populate({
            path: 'skills.category',
            select: '-subcategory',
        });

        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        // Step 1: Fetch all unique category IDs from the service provider's skills
        const categoryIds = serviceProvider.skills
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
        const updatedSkills = serviceProvider.skills.map(skill => {
            if (skill.category && skill.category._id) {
                const categorySubcategories = subcategoryLookup[skill.category._id.toString()] || [];

                // Step 5: Replace subcategories with the matching ones from the lookup map
                const updatedSubcategories = skill.subcategories.map(sub => {
                    // Match the subcategory using its _id
                    const matchingSubcategory = categorySubcategories.find(s => s._id.toString() === sub.subcategory.toString());

                    // Replace subcategory if a match is found, else return original subcategory
                    return matchingSubcategory ? { ...sub, subcategory: matchingSubcategory } : sub;
                });

                // Return the skill with updated subcategories
                return { ...skill, subcategories: updatedSubcategories };
            }

            return skill; // Return the skill as is if no category
        });

        // Update the service provider's skills with the transformed data
        serviceProvider.skills = updatedSkills;
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

        const provider = await ServiceProviderModel.findById(userID);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        // Merge new skills with existing ones
        skills.forEach((skill) => {
            const categoryIndex = provider.skills.findIndex(
                (existingSkill) =>
                    existingSkill.category.toString() === skill.category
            );

            if (categoryIndex !== -1) {
                // If the category exists, merge subcategories
                skill.subcategories.forEach((subcategory) => {
                    const subcategoryIndex = provider.skills[categoryIndex].subcategories.findIndex(
                        (existingSub) =>
                            existingSub.subcategory.toString() === subcategory.subcategory
                    );

                    if (subcategoryIndex !== -1) {
                        // Update pricing if subcategory exists
                        provider.skills[categoryIndex].subcategories[
                            subcategoryIndex
                        ].pricing = subcategory.pricing;
                    } else {
                        // Add new subcategory
                        provider.skills[categoryIndex].subcategories.push(subcategory);
                    }
                });
            } else {
                // Add new category
                provider.skills.push(skill);
            }
        });

        // Save the updated provider
        await provider.save();

        res.status(200).json({
            success: true,
            message: "Skills added successfully.",
            data: provider.skills,
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

        const provider = await ServiceProviderModel.findById(userID);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        skills.forEach((skill) => {
            const categoryIndex = provider.skills.findIndex(
                (existingSkill) =>
                    existingSkill.category.toString() === skill.category
            );

            if (categoryIndex !== -1) {
                // If the category exists, update subcategories
                skill.subcategories.forEach((subcategory) => {
                    const subcategoryIndex = provider.skills[categoryIndex].subcategories.findIndex(
                        (existingSub) =>
                            existingSub.subcategory.toString() === subcategory.subcategory
                    );

                    if (subcategoryIndex !== -1) {
                        // Update pricing for existing subcategory
                        provider.skills[categoryIndex].subcategories[subcategoryIndex].pricing = subcategory.pricing || provider.skills[categoryIndex].subcategories[subcategoryIndex].pricing;
                    } else {
                        // Add new subcategory if not present
                        provider.skills[categoryIndex].subcategories.push(subcategory);
                    }
                });
            } else {
                // If the category doesn't exist
                provider.skills.push(skill);
            }
        });

        // Save the updated provider
        await provider.save();

        res.status(200).json({
            success: true,
            message: "Skills updated successfully.",
            data: provider.skills,
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

        const provider = await ServiceProviderModel.findById(userID);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: "Service provider not found.",
            });
        }

        // Find the category index
        const categoryIndex = provider.skills.findIndex(
            (skill) => skill.category.toString() === category
        );

        if (categoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }

        // Find the subcategory index
        const subcategoryIndex = provider.skills[categoryIndex].subcategories.findIndex(
            (sub) => sub.subcategory.toString() === subcategory
        );

        if (subcategoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found.",
            });
        }

        // Remove the subcategory
        provider.skills[categoryIndex].subcategories.splice(subcategoryIndex, 1);

        // If no subcategories are left, remove the category
        if (provider.skills[categoryIndex].subcategories.length === 0) {
            provider.skills.splice(categoryIndex, 1);
        }

        // Save the updated provider
        await provider.save();

        res.status(200).json({
            success: true,
            message: "Subcategory removed successfully.",
            data: provider.skills,
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

        subcategory.status = 'confirmed';
        subcategory.serviceProviders.push({
            serviceProviderId: userID,
            assignedWorkers: 1, // Assign all required workers by default
            status: 'confirmed',
        });

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
                paymentDetails: {
                    totalAmount: order.payment.totalamount,
                    paidAmount: order.payment.paidAmount,
                    dueAmount: order.payment.dueAmount,
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
        const orders = await ServiceProviderOrderModel.find({ ServiceProvider: userID });
        if(!orders){
            return res.status(404).json({ success: false, message: 'No Order Found.'})
        }
        return res.status(200).json({ success: true, message: 'Orders found.', orders });
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

        if (subcategory.status !== 'confirmed') {
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

        serviceProviderSubcategory.status = 'inProgress';


        let otpVerified = false;
        console.log(subcategory.requestOperation.startOtp);
        
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