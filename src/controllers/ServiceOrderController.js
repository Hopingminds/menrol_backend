import ServiceOrderModel from "../models/ServiceOrder.model.js";
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
        
        const serviceOrders = await ServiceOrderModel.find({ user: userID });
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
                const service = await ServicesModel.findById(request.service);

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