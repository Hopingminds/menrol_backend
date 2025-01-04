import UserModel from "../models/User.model.js";
import ServicesModel from "../models/Services.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import { getOrderValue } from "../services/order.service.js";

export async function createServiceRequest(req, res) { //NOT IN USE UPDATE IT BEFORE USING
    try {
        const { userID } = req.user;
        let { requestedServices, location, address, scheduledTiming, instructions } = req.body;

        // Validate required fields
        if (!requestedServices || !location || !scheduledTiming || !address) {
            return res.status(400).json({ success: false, message: "All required fields must be provided." });
        }

        // Check if user, service, and service provider exist
        const userExists = await UserModel.findById(userID);

        if (!userExists) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const parsedrequestedServices = JSON.parse(requestedServices);
        // Validate and check each service in requestedServices
        for (const request of parsedrequestedServices) {
            const { service, subcategory } = request;
            
            if (!service || !subcategory) {
                return res.status(400).json({ success: false, message: "Each service and subcategory must be provided." });
            }

            const serviceExists = await ServicesModel.findById(service);
            if (!serviceExists) {
                return res.status(404).json({ success: false, message: `Service with ID ${service} not found.` });
            }
            
            for (const sub of subcategory) {
                if (!sub.title || !sub.requestType || !sub.workersRequirment) {
                    return res.status(400).json({ success: false, message: "Subcategory fields are missing or incomplete." });
                }

                // Verify the subcategory exists in the service's subcategories
                const subcategoryExists = serviceExists.subcategory.some(
                    (serviceSub) => serviceSub.title === sub.title
                );

                if (!subcategoryExists) {
                    return res.status(404).json({
                        success: false,
                        message: `Subcategory '${sub.title}' not found in service with ID ${service}.`,
                    });
                }
            }
        }

        // Handle images from middleware
        const instImages = req.files?.map(file => file.location) || [];
        const parsedLocation = JSON.parse(location);
        const parsedScheduledTiming = JSON.parse(scheduledTiming);
        requestedServices = parsedrequestedServices;
        
        // Create the service request
        const serviceRequest = new ServiceRequestModel({
            user: userID,
            requestedServices,
            location: parsedLocation,
            address,
            scheduledTiming: parsedScheduledTiming,
            instructions: instructions || null,
            images: instImages,
        });

        // Save the service request to the database
        const savedRequest = await serviceRequest.save();

        return res.status(201).json({
            success: false, 
            message: "Service request created successfully.",
            data: savedRequest
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

/** POST: http://localhost:3027/api/v1/addServiceRequest
 * @body {
 *  "instImages": "file image",
 *  "service": "675985fa18dd6b70bf89c756"
 *  "subcategory": {
        "subcategoryId": "675985fa18dd6b70bf89c758",
        "title": "Sanitary Plumber",
        "requestType": "daily",
        "workersRequirment": 2,
        "selectedAmount": 400,
        "instructions": "Please bring all necessary tools.",
        "scheduledTiming": {
            "startTime": "2024-12-15T10:00:00Z",
            "endTime": "2024-12-15T12:00:00Z"
        }
    }
}
 */
export async function addServiceRequest(req, res) {
    try {
        const { userID } = req.user;
        let { service, subcategory } = req.body;
        
        // Validate required fields
        if (!service || !subcategory) {
            return res.status(400).json({ success: false, message: "All required fields must be provided." });
        }
        
        
        // Check if a service request already exists for the user
        let existingRequest = await ServiceRequestModel.findOne({ user: userID });
        
        const instImages = req.files?.map(file => file.location) || [];
        
        const parsedsubcategory = JSON.parse(subcategory);
        subcategory = parsedsubcategory;
        
        
        const subcategoryEntry = {
            subcategoryId: subcategory.subcategoryId,
            title: subcategory.title,
            requestType: subcategory.requestType || "daily",
            selectedAmount: subcategory.selectedAmount,
            workersRequirment: subcategory.workersRequirment || 1,
            status: "pending",
            instructions: subcategory.instructions || null,
            instructionsImages: instImages || [],
            scheduledTiming: {
                startTime: new Date(subcategory.scheduledTiming.startTime),
                endTime: subcategory.scheduledTiming.endTime ? new Date(subcategory.scheduledTiming.endTime) : null,
            },
        };

        // If there is an existing request, check if the subcategoryId already exists
        if (existingRequest) {
            // Locate the existing service in requestedServices
            const serviceEntry = existingRequest.requestedServices.find(
                (reqService) => reqService.service.toString() === service.toString()
            );

            if (serviceEntry) {
                // Check if the subcategoryId already exists in the service's subcategories
                const subcategoryExists = serviceEntry.subcategory.some(
                    (subcat) => subcat.subcategoryId.toString() === subcategory.subcategoryId.toString()
                );

                if (subcategoryExists) {
                    return res.status(400).json({
                        success: false,
                        message: "This subcategory has already been requested.",
                    });
                }

                // Add the subcategory to the existing service
                serviceEntry.subcategory.push(subcategoryEntry);
            } else {
                // Add a new service entry with the subcategory
                existingRequest.requestedServices.push({
                    service: service,
                    subcategory: [subcategoryEntry],
                });
            }

            await existingRequest.save();
            return res.status(200).json({
                success: true,
                message: "Service request updated successfully.",
                data: existingRequest,
                cartExists: true,
            });
        }

        // If no existing request, create a new service request
        const newServiceRequest = new ServiceRequestModel({
            user: userID,
            requestedServices: [
                {
                    service: service,
                    subcategory: [subcategoryEntry],
                },
            ],
        });

        await newServiceRequest.save();

        return res.status(201).json({
            success: true,
            message: "Service request added successfully.",
            data: newServiceRequest,
            cartExists: false,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function acceptServiceRequest(req, res) {
    try {
        const { userID } = req.sp;
        const { requestId } = req.body;

        // Find the service request
        const serviceRequest = await ServiceRequestModel.findById(requestId);

        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service request not found." });
        }

        // Check if the request has already been accepted or completed
        if (serviceRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: "This service request has already been accepted or is no longer available." });
        }

        // Check if the service provider exists
        const serviceProvider = await ServiceProviderModel.findById(userID);

        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        // Update the service request with the service provider and change the status to 'confirmed'
        serviceRequest.serviceProvider = userID;
        serviceRequest.status = 'confirmed';

        // Save the updated service request
        const updatedRequest = await serviceRequest.save();

        return res.status(200).json({
            success: false,
            message: "Service request accepted successfully.",
            data: updatedRequest
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getUserServiceRequests(req, res) {
    try {
        // Assuming you have a ServiceRequest model to query from MongoDB
        const { userID } = req.user; // Or use req.user._id if you're authenticating via middleware

        // Fetch service requests for the user
        const serviceRequests = await ServiceRequestModel.findOne({ user: userID }).populate({
            path: 'requestedServices.service',
            select: '-subcategory',
        });

        if (!serviceRequests) {
            return res.status(404).json({ success: false, message: "No service requests found for this user" });
        }

        if(serviceRequests.requestedServices.length === 0){
            await serviceRequests.deleteOne();
            return res.status(404).json({ success: true, serviceRequests:[], message: "No service requests found for this user" });
        }

        const totalAmount = await getOrderValue(userID);
        const requestedServices = serviceRequests.requestedServices;

        const categoryIds = requestedServices
            .filter(skill => skill.service && skill.service._id)
            .map(skill => skill.service._id);
        
        const services = await ServicesModel.find({ '_id': { $in: categoryIds } }).select('subcategory _id');
        
        const subcategoryLookup = services.reduce((lookup, service) => {
            lookup[service._id.toString()] = service.subcategory;
            return lookup;
        }, {});

        const updatedRequests = requestedServices.map(request => {
            if (request.service && request.service._id) {
                const categorySubcategories = subcategoryLookup[request.service._id.toString()] || [];
        
                // Step 5: Replace subcategory with the matching ones from the lookup map
                const updatedSubcategories = request.subcategory.map(sub => {
                    const matchingSubcategory = categorySubcategories.find(
                        s => s._id.toString() === sub.subcategoryId.toString()
                    );
        
                    
                    // Use toObject() to convert Mongoose document to plain object
                    const updatedSub = {
                        ...sub.toObject(), // Convert to plain object
                        subcategoryId: matchingSubcategory || sub.subcategoryId, // Keep original if no match
                    };
                    
                    return updatedSub;
                });
                
                // console.log(updatedSubcategories);
                
                // Return the request with updated subcategory
                return {
                    ...request.toObject(), // Convert to plain object
                    subcategory: updatedSubcategories,
                };
            }
            
            return request.toObject(); // Return the request as is, converted to plain object
        });

        console.log(updatedRequests[0].subcategory);
        
        const responseObject = serviceRequests.toObject();
        delete responseObject.requestedServices;
        responseObject.requestedServices = updatedRequests;

        return res.status(200).json({ success: true, serviceRequests: responseObject, totalAmount });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function removeServiceRequest(req, res) {
    try {
        const { userID } = req.user;
        const { service, subcategoryId } = req.body;

        if (!service || !subcategoryId) {
            return res.status(400).json({ success: false, message: "service, subcategoryId are the required fields." });
        }

        const serviceRequest = await ServiceRequestModel.findOne({ user: userID });
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service request not found" });
        }

        const serviceIndex = serviceRequest.requestedServices.findIndex(reqService =>
            reqService.service.toString() === service
        );

        if (serviceIndex === -1) {
            return res.status(404).json({ success: false, message: "Service not found in the request" });
        }

        serviceRequest.requestedServices[serviceIndex].subcategory = serviceRequest.requestedServices[serviceIndex].subcategory.filter(
            sub => sub.subcategoryId.toString() !== subcategoryId
        );

        if (serviceRequest.requestedServices[serviceIndex].subcategory.length === 0) {
            serviceRequest.requestedServices.splice(serviceIndex, 1);
        }

        if(serviceRequest.requestedServices.length === 0){
            await serviceRequest.deleteOne();
            return res.status(200).json({ success: true, message: "Service request deleted successfully, no services left" });
        }

        await serviceRequest.save();

        return res.status(200).json({ success: true, message: "Service request updated successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function updateServiceRequest(req, res) {
    try {
        const { userID } = req.user;
        const { service, subcategoryId, updatedFields } = req.body;

        // Validate required fields
        if (!service || !subcategoryId || !updatedFields) {
            return res.status(400).json({ success: false, message: "All required fields must be provided." });
        }

        // Check if the service request exists for the user
        let existingRequest = await ServiceRequestModel.findOne({ user: userID });

        if (!existingRequest) {
            return res.status(404).json({
                success: false,
                message: "Service request not found.",
            });
        }

        // Locate the service in requestedServices
        const serviceEntry = existingRequest.requestedServices.find(
            (reqService) => reqService.service.toString() === service.toString()
        );

        if (!serviceEntry) {
            return res.status(404).json({
                success: false,
                message: "Service not found in the service request.",
            });
        }

        // Locate the subcategory in the service
        const subcategoryEntry = serviceEntry.subcategory.find(
            (subcat) => subcat.subcategoryId.toString() === subcategoryId.toString()
        );

        if (!subcategoryEntry) {
            return res.status(404).json({
                success: false,
                message: "Subcategory not found in the service request.",
            });
        }

        const instImages = req.files?.map(file => file.location) || [];
        // Allowed fields to update
        const allowedFields = [
            "requestType",
            "selectedAmount",
            "workersRequirment",
            "instructions",
            "instructionsImages",
            "scheduledTiming",
        ];

        // Update the fields in the subcategory
        for (const key in updatedFields) {
            if (allowedFields.includes(key)) {
                if (key === "scheduledTiming" && updatedFields[key]) {
                    subcategoryEntry[key].startTime = updatedFields[key].startTime
                        ? new Date(updatedFields[key].startTime)
                        : subcategoryEntry[key].startTime;
                    subcategoryEntry[key].endTime = updatedFields[key].endTime
                        ? new Date(updatedFields[key].endTime)
                        : subcategoryEntry[key].endTime;
                } else if (key === "instructionsImages") {
                    // Replace with updated images and append new ones
                    subcategoryEntry[key] = [
                        ...updatedFields[key],
                        ...instImages,
                    ];
                } else {
                    subcategoryEntry[key] = updatedFields[key];
                }
            }
        }

        // Save the updated service request
        await existingRequest.save();

        return res.status(200).json({
            success: true,
            message: "Service request updated successfully.",
            data: existingRequest,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}