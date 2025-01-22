import corsOptions from "../configs/cors.config.js";
import notificationEmitter from "../events/notificationEmitter.js";
import ServiceOrderModel from "../models/ServiceOrder.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import ServiceProviderOrderModel from "../models/ServiceProviderOrder.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import ServicesModel from "../models/Services.model.js";
import { deleteRequestOnOrderCompletion, getOrderValue } from "../services/order.service.js";

export async function purchaseService(req, res) {
    try {
        const { userID } = req.user;
        const { totalPayedAmount, location, address } = req.body;

        const serviceRequest = await ServiceRequestModel.findOne({ user: userID });
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service request not found" });
        }

        const orderValue = await getOrderValue(userID);
        if (!orderValue.success) {
            throw new Error('Failed to get order value.');
        }
        console.log(orderValue.totalAmount);

        if (totalPayedAmount < orderValue.totalAmount) {
            return res.status(400).json({ success: false, message: "Complete the full payment", Amounttopaid: orderValue.totalAmount });
        }

        const newServiceOrder = new ServiceOrderModel({
            user: userID,
            serviceRequest: serviceRequest.requestedServices,
            location,
            address,
            payment: {
                totalamount: orderValue.totalAmount,
                paidAmount: totalPayedAmount,
                dueAmount: 0, // Since full payment is made
                status: 'completed',
                method: 'app',
                paymentDate: new Date(),
            },
            orderRaised: true
        });

        await newServiceOrder.save();
        //delete serviceRequest
        await deleteRequestOnOrderCompletion(userID);

        return res.status(201).json({ success: true, message: "Service order created successfully", data: newServiceOrder });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getUserAllOrders(req, res) {
    try {
        const { userID } = req.user;
        
        const serviceOrders = await ServiceOrderModel.find({ user: userID }).populate({
            path: 'serviceRequest.service',
            model: 'Services',
            select: '-subcategory'
        }).populate({
            path: 'serviceRequest.subcategory.viewers.serviceProvider',
            select: 'name profileImage'
        }).populate({
            path: 'serviceRequest.subcategory.serviceProviders.serviceProviderId',
            select: '-password -authToken -isAccountBlocked -aadharCard -activeSubscription -providerSubscription'
        });
        
        if (!serviceOrders) {
            return res.status(404).json({ success: false, message: "No service orders found" });
        }

        // Categorize orders by status
        const categorizedOrders = {
            pending: [],
            confirmed: [],
            completed: [],
            cancelled: []
        };

        const allCategoriesTitles = []; // Tracks categories across all orders

        // Iterate over each service order
        for (const order of serviceOrders) {
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
            for (const request of order.serviceRequest) {
                const service = await ServicesModel.findById(request.service._id);

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
                    if (subcat.status === "inProgress") {
                        statusBuckets.confirmed.push(subcat);
                    } else if (statusBuckets[subcat.status]) {
                        statusBuckets[subcat.status].push(subcat);
                    }
                });
            }

            // Add the order to categorizedOrders only once per status
            Object.keys(statusBuckets).forEach(status => {
                if (statusBuckets[status].length > 0) {
                    const filteredOrder = {
                        ...orderClone,
                        serviceRequest: orderClone.serviceRequest.map(req => ({
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


        return res.status(200).json({ success: true, data: categorizedOrders });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getUserRasiedOrders(req, res) {
    try {
        const { userID } = req.user;

        const order = await ServiceOrderModel.findOne({ user: userID, orderRaised: true }).populate({
            path: 'serviceRequest.service',
            model: 'Services',
            select: '-subcategory'
        }).populate({
            path: 'serviceRequest.subcategory.viewers.serviceProvider',
            select: 'name profileImage'
        }).populate({
            path: 'serviceRequest.subcategory.serviceProviders.serviceProviderId',
            select: 'name profileImage'
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.status(200).json({ success: true, order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}


export async function fetchEligibleServiceProviders(req, res) {
    try {
        const { userID } = req.user;

        const order = await ServiceOrderModel.findOne({ user: userID, orderRaised: true }).populate({
            path: 'serviceRequest.service',
            model: 'Services',
            select: '-subcategory'
        }).populate({
            path: 'serviceRequest.subcategory.viewers.serviceProvider',
            select: 'name profileImage'
        }).populate({
            path: 'serviceRequest.subcategory.serviceProviders.serviceProviderId',
            select: 'name profileImage'
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const results = await Promise.all(
            order.serviceRequest.map(async (request) => {
                const { subcategory } = request;
                if (!subcategory || !Array.isArray(subcategory)) {
                    throw new Error('Invalid subcategory data');
                }

                const subcategoryResults = await Promise.all(
                    subcategory.map(async (sub) => {
                        const { subcategoryId, workersRequirment } = sub;

                        if (!subcategoryId || !workersRequirment) {
                            throw new Error('Subcategory ID and worker requirement are required');
                        }

                        // Fetch eligible service providers
                        const eligibleProviders = await ServiceProviderModel.find({
                            skills: {
                                $elemMatch: {
                                    subcategories: {
                                        $elemMatch: { subcategory: subcategoryId },
                                    },
                                },
                            },
                            isAccountBlocked: false,
                        })
                            .select('-password -authToken -aadharCard -totalEarnings -activeSubscription -providerSubscription') // Exclude sensitive fields
                            .lean();

                        return {
                            subcategoryId,
                            workersRequirment,
                            eligibleProviders,
                        };
                    })
                );

                return {
                    service: request.service,
                    subcategories: subcategoryResults,
                };
            })
        );

        return res.status(200).json({ success: true, results });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getUserOrderDetails(req, res) {
    try {
        const { userID } = req.user;
        const { orderId } = req.query;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        const order = await ServiceOrderModel.findOne({ user: userID, _id: orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        return res.status(200).json({ success: true, order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function cancelOrderRequest(req, res) {
    try {
        const { userID } = req.user;
        const { orderId, serviceId, subcategoryId } = req.body;

        if (!orderId || !serviceId || !subcategoryId) {
            return res.status(404).json({ success: false, message: 'Missing Required fields.' });
        }

        const order = await ServiceOrderModel.findOne({ _id: orderId, user: userID });
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

        if (subcategory.status === 'cancelled' || subcategory.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: `Subcategory is already ${subcategory.status}.`,
            });
        }

        // Update the subcategory status in the order
        subcategory.status = 'cancelled';
        
        // Check if the serviceProviderOrder exists and update if it does
        const serviceProviderOrder = await ServiceProviderOrderModel.findOne({ serviceOrderId: orderId });
        if (serviceProviderOrder) {
            const serviceProviderOrderserviceRequest = serviceProviderOrder.servicesProvided.find(req => req.serviceId.toString() === serviceId);
            if (serviceProviderOrderserviceRequest) {
                const serviceProviderOrdersubcategory = serviceProviderOrderserviceRequest.subcategory.find(
                    sub => sub.subcategoryId.toString() === subcategoryId
                );
                
                if (serviceProviderOrdersubcategory) {
                    serviceProviderOrdersubcategory.serviceStatus = 'cancelled';
                    await serviceProviderOrder.save();
                }
            }
        }

        await order.save();

        return res.status(200).json({ success: true, message: "Order Request cancelled successfully", order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function updateOrderTiming(req, res) {
    try {
        const { userID } = req.user;
        const { orderId, serviceId, subcategoryId, scheduledTiming } = req.body;

        if (!orderId || !serviceId || !subcategoryId || !scheduledTiming) {
            return res.status(404).json({ success: false, message: 'Missing Required fields.' })
        }

        const order = await ServiceOrderModel.findOne({ _id: orderId, user: userID });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const serviceProviderOrder = await ServiceProviderOrderModel.findOne({ serviceOrderId: orderId });
        if (!serviceProviderOrder) {
            return res.status(404).json({ success: false, message: 'service Provider Order Not Found.' });
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

        subcategory.scheduledTiming.startTime = scheduledTiming.startTime || subcategory.scheduledTiming.startTime;
        subcategory.scheduledTiming.endTime = scheduledTiming.endTime || subcategory.scheduledTiming.endTime;

        serviceProviderOrdersubcategory.scheduledTiming.startTime = scheduledTiming.startTime || serviceProviderOrdersubcategory.scheduledTiming.startTime;
        serviceProviderOrdersubcategory.scheduledTiming.endTime = scheduledTiming.endTime || serviceProviderOrdersubcategory.scheduledTiming.endTime;

        await order.save();
        await serviceProviderOrder.save();

        return res.status(200).json({ success: true, message: "Service timing updated successfully." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}