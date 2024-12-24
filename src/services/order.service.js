import ServiceRequestModel from "../models/ServiceRequest.model.js";

export async function getOrderValue(userId) {
    try {
        const request = await ServiceRequestModel.findOne({ user: userId });
        if (!request) {
            return { success: false, message: 'User Request Not Found' };
        }

        let totalAmount = 0;
        request.requestedServices.forEach((service) => {
            service.subcategory.forEach((subcat) => {
                totalAmount += subcat.selectedAmount * subcat.workersRequirment;
            });
        });

        return { success: true, totalAmount };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to get order value.' };
    }
}

export async function deleteRequestOnOrderCompletion(userId) {
    try {
        const result = await ServiceRequestModel.deleteOne({ user: userId });
        if (result.deletedCount === 0) {
            return { success: false, message: 'User Request Not Found' };
        }
        
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to get order value.' };
    }
}