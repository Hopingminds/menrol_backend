import corsOptions from "../configs/cors.config.js";
import notificationEmitter from "../events/notificationEmitter.js";
import { populateSubcategoryInServiceOrder } from "../lib/populateSubcategory.js";
import ServiceOrderModel from "../models/ServiceOrder.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import ServiceProviderInfoModel from "../models/ServiceProviderInfo.model.js";
import ServiceProviderOrderModel from "../models/ServiceProviderOrder.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import ServicesModel from "../models/Services.model.js";
import { deleteRequestOnOrderCompletion, getOrderValue, getUpdateOrderValue } from "../services/order.service.js";

export async function purchaseService(req, res) {
    try {
        const { userID } = req.user;
        const { location, address } = req.body;

        const serviceRequest = await ServiceRequestModel.findOne({ user: userID });
        if (!serviceRequest) {
            return res.status(404).json({ success: false, message: "Service request not found" });
        }

        // const orderValue = await getOrderValue(userID);
        // if (!orderValue.success) {
        //     throw new Error('Failed to get order value.');
        // }

        const newServiceOrder = new ServiceOrderModel({
            user: userID,
            serviceRequest: serviceRequest.requestedServices,
            location,
            address,
            payment: {
                totalamount: 0,
                paidAmount: 0,
                dueAmount: 0, // Since full payment is not made
                status: 'pending',
                paymentmethod: 'app',
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

        const populatedRequests = await populateSubcategoryInServiceOrder(order);

        const requestObject = order.toObject();
        delete requestObject.serviceRequest;
        requestObject.serviceRequest = populatedRequests;

        const results = await Promise.all(
            populatedRequests.map(async (request) => {
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
                        const eligibleProviders = await ServiceProviderInfoModel.find({
                            "skills.subcategories.subcategory": subcategoryId,
                        })
                            .select(
                                "user rating availability instantAvailability experience skills workHistory feedback"
                            ) // Selecting necessary fields
                            .populate({
                                path: "user",
                                select: "name profileImage isOnline",
                            })
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

        notificationEmitter.emit('providerUpdatedForCancelledOrder', { userID: order.user, message: 'message emitted for userUpdatedForRasiedOrder.' });

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

        const orderValue = await getUpdateOrderValue(userID, order._id);
        if (!orderValue.success) {
            throw new Error('Failed to get order value.');
        }

        order.payment.totalamount = orderValue.totalAmount;
        order.payment.dueAmount = orderValue.totalAmount;
        serviceProviderOrder.paymentDetails.totalAmount = orderValue.totalAmount;
        serviceProviderOrder.paymentDetails.dueAmount = orderValue.totalAmount;

        await order.save();
        await serviceProviderOrder.save();

        return res.status(200).json({ success: true, message: "Service timing updated successfully.", order });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function sendOrderRequestToProvider(req, res) {
    try {
        const { orderId, serviceId, subcategoryId, providerId } = req.body;

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

        const existingProviderIndex = subcategory.serviceProviders.findIndex(ServiceProvider => ServiceProvider.serviceProviderId.toString() === providerId);

        if (existingProviderIndex !== -1) {
            return res.json({
                success: false,
                message: "Service provider for this service already exists."
            })
        }

        const existingServiceProviderOrder = await ServiceProviderOrderModel.findOne({
            ServiceProvider: providerId,
            serviceOrderId: orderId,
        });

        if (!existingServiceProviderOrder) {
            // Create a new ServiceProviderOrder
            const newServiceProviderOrder = new ServiceProviderOrderModel({
                ServiceProvider: providerId,
                serviceOrderId: orderId,
                servicesProvided: [
                    {
                        serviceId,
                        subcategory: [
                            {
                                subcategoryId,
                                title: subcategory.title,
                                requestType: subcategory.requestType,
                                selectedAmount: subcategory.selectedAmount || 0,
                                instructions: subcategory.instructions || "",
                                instructionsImages: subcategory.instructionsImages || [],
                                instructionAudio: subcategory.instructionAudio,
                                scheduledTiming: subcategory.scheduledTiming,
                                workersRequirment: subcategory.workersRequirment,
                                assignedWorkers: 1, // Default to 0, can be updated later
                                serviceStatus: 'pending',
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
                            selectedAmount: subcategory.selectedAmount || 0,
                            instructions: subcategory.instructions || "",
                            instructionsImages: subcategory.instructionsImages || [],
                            instructionAudio: subcategory.instructionAudio,
                            scheduledTiming: subcategory.scheduledTiming,
                            workersRequirment: subcategory.workersRequirment,
                            assignedWorkers: 1, // Default to 0, can be updated later
                            serviceStatus: 'pending',
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
                    instructionAudio: subcategory.instructionAudio,
                    scheduledTiming: subcategory.scheduledTiming,
                    workersRequirment: subcategory.workersRequirment,
                    assignedWorkers: 1, // Default to 0, can be updated later
                    serviceStatus: 'pending',
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

        // Add provider to the order's subcategory serviceProviders array
        subcategory.serviceProviders.push({ serviceProviderId: providerId, status: 'pending' });
        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order request sent to service provider successfully.",
            // data: serviceProviderRequest
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function getAllOrderRequestForProvider(req, res) {
    try {
        const { userID } = req.sp;

        const orders = await ServiceProviderOrderModel.find({ ServiceProvider: userID, isOrderRequested: true });
        if(!orders || orders.length === 0){
            return res.status(404).json({ success: false, message: "No order requests found." });
        }

        return res.status(200).json({ success: true, message: "Order requests found.", data: orders }); 
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function acceptOrderRequest(req, res) {
    try {
        const { userID } = req.sp;
        const { orderId, serviceId, subcategoryId } = req.body;

        const serviceProviderRequest = await ServiceProviderOrderModel.findOne({ ServiceProvider: userID, serviceOrderId: orderId });
        if (!serviceProviderRequest) {
            return res.status(404).json({ success: false, message: "Order request not found." });
        }

        if (serviceProviderRequest.ServiceProvider.toString() !== userID) {
            return res.status(403).json({ success: false, message: "Unauthorized action." });
        }

        serviceProviderRequest.servicesProvided.forEach(service => {
            if (service.serviceId.toString() === serviceId) {
                service.subcategory.forEach(sub => {
                    if (sub.subcategoryId.toString() === subcategoryId) {
                        sub.serviceStatus = 'confirmed';
                    }
                });
            }
        });

        const order = await ServiceOrderModel.findById(orderId);
        if (order) {
            order.serviceRequest.forEach(service => {
                if (service.service.toString() === serviceId) {
                    service.subcategory.forEach(sub => {
                        if (sub.subcategoryId.toString() === subcategoryId) {
                            const providerIndex = sub.serviceProviders.findIndex(sp => sp.serviceProviderId.toString() === userID);
                            if (providerIndex !== -1) {
                                sub.serviceProviders[providerIndex].status = 'confirmed';
                            }
                        }
                    });
                }
            });
            await order.save();
            await serviceProviderRequest.save();
            return res.status(200).json({ success: true, message: "Order request accepted successfully." });
        } else {
            return res.status(404).json({ success: false, message: "Order request not found." });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}