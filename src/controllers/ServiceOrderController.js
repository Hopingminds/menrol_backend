import ServiceOrderModel from "../models/ServiceOrder.model.js";
import ServiceRequestModel from "../models/ServiceRequest.model.js";
import { getOrderValue } from "../services/order.service.js";

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
        return res.status(200).json({ success: true, serviceOrders });
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