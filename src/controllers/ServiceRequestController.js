import UserModel from "../models/User.model.js";
import ServicesModel from "../models/Services.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";

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

export async function addServiceRequest(req, res) {
    try {
        const { userID } = req.user;
        let { service, subcategory, location, address } = req.body;

        console.log("Body => ",req.body);
        console.log("File => ",req.files);
        
        // Validate required fields
        if (!service || !subcategory || !location || !address) {
            return res.status(400).json({ success: false, message: "All required fields must be provided." });
        }
        
        
        // Check if a service request already exists for the user
        let existingRequest = await ServiceRequestModel.findOne({ user: userID });
        
        const instImages = req.files?.map(file => file.location) || [];
        
        const parsedsubcategory = JSON.parse(subcategory);
        subcategory = parsedsubcategory;
        const parsedlocation = JSON.parse(location);
        location = parsedlocation;
        
        
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
            // Check if the subcategoryId is already in the requestedServices
            const subcategoryExists = existingRequest.requestedServices.some(
                (serviceRequest) =>
                    serviceRequest.subcategory.some(
                        (subcat) => subcat.subcategoryId.toString() === subcategory.subcategoryId.toString()
                    )
            );

            if (subcategoryExists) {
                return res.status(400).json({
                    success: false,
                    message: "This subcategory has already been requested.",
                });
            }

            // If not, push the new subcategory to the requestedServices
            existingRequest.requestedServices.push({
                service: service,
                subcategory: [subcategoryEntry],
            });

            await existingRequest.save();
            return res.status(200).json({
                success: true,
                message: "Service request updated successfully.",
                data: existingRequest,
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
            location: {
                type: location.type,
                coordinates: location.coordinates,
            },
            address,
        });

        await newServiceRequest.save();

        return res.status(201).json({
            success: true,
            message: "Service request added successfully.",
            data: newServiceRequest,
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
        const serviceRequests = await ServiceRequestModel.findOne({ user: userID });

        if (!serviceRequests) {
            return res.status(404).json({ success: false, message: "No service requests found for this user" });
        }

        if(serviceRequests.requestedServices.length === 0){
            await serviceRequests.deleteOne();
            return res.status(404).json({ success: false, message: "No service requests found for this user" });
        }

        return res.status(200).json({ success: true, serviceRequests });
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
        let { service, subcategory, location, address } = req.body;
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}