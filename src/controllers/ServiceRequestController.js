import UserModel from "../models/User.model.js";
import ServicesModel from "../models/Services.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";

export async function createServiceRequest(req, res) {
    try {
        const { userID } = req.user;
        const {
            service,
            subcategory,
            location,
            address,
            requestType,
            scheduledTiming,
            instructions,
            workersRequirment,
            payment,
        } = req.body;

        // Validate required fields
        if (!service ||
            !subcategory ||
            !location ||
            !scheduledTiming ||
            !address ||
            !workersRequirment ||
            !payment ||
            !requestType) {
            return res.status(400).json({ success: false, message: "All required fields must be provided." });
        }

        // Check if user, service, and service provider exist
        const userExists = await UserModel.findById(userID);
        const serviceExists = await ServicesModel.findById(service);

        if (!userExists) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        if (!serviceExists) {
            return res.status(404).json({ success: false, message: "Service not found." });
        }

        // Handle images from middleware
        const instImages = req.files.map(file => file.location);
        const parsedsubcategory = JSON.parse(subcategory);
        const parsedlocation = JSON.parse(location);
        const parsedpayment = JSON.parse(payment);
        const parsedscheduledTiming = JSON.parse(scheduledTiming);
        
        // Create the service request
        const serviceRequest = new ServiceRequestModel({
            user: userID,
            service,
            subcategory: parsedsubcategory,
            requestType,
            workersRequirment,
            payment: parsedpayment,
            location: parsedlocation,
            address,
            scheduledTiming: parsedscheduledTiming,
            instructions: instructions || null,
            images: instImages || [],
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