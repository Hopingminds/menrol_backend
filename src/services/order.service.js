import ServiceOrderModel from "../models/ServiceOrder.model.js";
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
                const { selectedAmount, workersRequirment, requestType, scheduledTiming } = subcat;

                if (!scheduledTiming?.startTime || !scheduledTiming?.endTime) {
                    throw new Error('Start time or end time is missing in the subcategory');
                }

                const startTime = new Date(scheduledTiming.startTime);
                const endTime = new Date(scheduledTiming.endTime);

                let calculatedDuration = 0;

                // Calculate duration based on requestType
                if (requestType === "hourly") {
                    calculatedDuration = Math.abs((endTime - startTime) / (1000 * 60 * 60)); // duration in hours
                } else if (requestType === "daily") {
                    calculatedDuration = Math.abs((endTime - startTime) / (1000 * 60 * 60 * 24)); // duration in days
                }

                // Accumulate the total amount
                totalAmount += selectedAmount * workersRequirment * calculatedDuration;
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

export async function getUpdateOrderValue(userId, orderId) {
    try {
        const order = await ServiceOrderModel.findOne({ user: userId, _id: orderId });
        if (!order) {
            return { success: false, message: 'User Request Not Found' };
        }

        let totalAmount = 0;
        order.serviceRequest.forEach((service) => {
            service.subcategory.forEach((subcat) => {
                const { selectedAmount, workersRequirment, requestType, scheduledTiming } = subcat;
                console.log(selectedAmount, workersRequirment, requestType, scheduledTiming);
                
                if (!scheduledTiming?.startTime || !scheduledTiming?.endTime) {
                    throw new Error('Start time or end time is missing in the subcategory');
                }

                const startTime = new Date(scheduledTiming.startTime);
                const endTime = new Date(scheduledTiming.endTime);

                let calculatedDuration = 0;

                // Calculate duration based on requestType
                if (requestType === "hourly") {
                    calculatedDuration = Math.abs((endTime - startTime) / (1000 * 60 * 60)); // duration in hours
                } else if (requestType === "daily") {
                    calculatedDuration = Math.abs((endTime - startTime) / (1000 * 60 * 60 * 24)); // duration in days
                }
                console.log("calculatedDuration",calculatedDuration);
                
                // Accumulate the total amount
                totalAmount += selectedAmount * workersRequirment * calculatedDuration;
            });
        });

        return { success: true, totalAmount };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to get order value.' };
    }
}