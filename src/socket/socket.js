import { Server } from 'socket.io';
import notificationEmitter from '../events/notificationEmitter.js';
import ServiceOrderModel from '../models/ServiceOrder.model.js';
import ServiceProviderOrderModel from '../models/ServiceProviderOrder.model.js';
import ServicesModel from '../models/Services.model.js';
import { populateSubcategoryInServiceProviderOrder } from '../lib/populateSubcategory.js';

export const setupWebSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: '*', // Adjust this to your allowed origins
            credentials: true,
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Listen for user-specific subscriptions
        socket.on('subscribeToUserUpdates', (userID) => {
            console.log(`Subscribed to updates for user: ${userID}`);

            // Function to send updates for the specific user
            const sendUpdate = async (update) => {
                const order = await ServiceOrderModel.findOne({ user: userID, orderRaised: true })
                    .populate({ path: 'serviceRequest.service', model: 'Services', select: '-subcategory' })
                    .populate({ path: 'serviceRequest.subcategory.viewers.serviceProvider', select: 'name profileImage' })
                    .populate({ path: 'serviceRequest.subcategory.serviceProviders.serviceProviderId', select: 'name profileImage' });

                if (update.userID.toString() === userID && order) {
                    socket.emit('userRaisedOrderUpdate', {
                        success: true,
                        order
                    });
                } else if (update.userID.toString() === userID && !order) {
                    socket.emit('userRaisedOrderUpdate', {
                        success: false,
                        message: "No Raised order found"
                    });
                    console.log("No Raised order found");
                }
            };

            // Register event listener for user-specific updates
            notificationEmitter.on('userUpdatedForRaisedOrder', sendUpdate);

            // Clean up when the client disconnects
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                notificationEmitter.off('userUpdatedForRaisedOrder', sendUpdate);
            });
        });
        
        socket.on('subscribeToProviderUpdates', (userID) => {
            console.log(`Subscribed to updates for provider: ${userID}`);
            
            const sendUpdateForCancelledOrder = async (update) => {
                try {
                    const serviceProviderOrder = await ServiceProviderOrderModel.find({ ServiceProvider: userID }).populate({
                        path: 'servicesProvided.serviceId',
                        model: 'Services',
                        select: '-subcategory'
                    }).populate({
                        path: 'serviceOrderId',
                        select: 'user',
                        populate: {
                            path: 'user',
                            select: 'name phone email profileImage perferredLanguage'
                        },
                    });

                    if (!serviceProviderOrder) {
                        return res.status(404).json({ success: false, message: 'No Order Found.' })
                    }

                    const orders = await Promise.all(
                        serviceProviderOrder.map(async (order) => {
                            const updatedRequestedServices = await populateSubcategoryInServiceProviderOrder(order);

                            // Convert to plain object and replace servicesProvided with the updated one
                            const orderObject = order.toObject();
                            delete orderObject.servicesProvided;
                            orderObject.servicesProvided = updatedRequestedServices;

                            return orderObject;
                        })
                    );

                    // Categorize orders by status
                    const categorizedOrders = {
                        pending: [],
                        confirmed: [],
                        completed: [],
                        cancelled: []
                    };

                    const allCategoriesTitles = []; // Tracks categories across all orders

                    // Iterate over each service order
                    for (const order of orders) {
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
                        for (const request of order.servicesProvided) {
                            const service = await ServicesModel.findById(request.serviceId._id);

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
                                if (subcat.serviceStatus === "inProgress") {
                                    statusBuckets.confirmed.push(subcat);
                                } else if (statusBuckets[subcat.serviceStatus]) {
                                    statusBuckets[subcat.serviceStatus].push(subcat);
                                }
                            });
                        }

                        // Add the order to categorizedOrders only once per status
                        Object.keys(statusBuckets).forEach(status => {
                            if (statusBuckets[status].length > 0) {
                                const filteredOrder = {
                                    ...orderClone,
                                    servicesProvided: orderClone.servicesProvided.map(req => ({
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
                    
                    if (update.userID.toString() === userID && categorizedOrders) {
                        socket.emit('userRaisedOrderUpdate', {
                            success: true,
                            categorizedOrders
                        });
                    } else if (update.userID.toString() === userID && !categorizedOrders) {
                        socket.emit('userRaisedOrderUpdate', {
                            success: false,
                            message: "No Raised order found"
                        });
                        console.log("No Raised order found");
                    }
                } catch (error) {
                    
                }
            }
            
            // Register event listener for provider-specific updates
            notificationEmitter.on('providerUpdatedForCancelledOrder', sendUpdateForCancelledOrder);
            
            // Clean up when the client disconnects
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                notificationEmitter.off('userUpdatedForRaisedOrder', sendUpdate);
            });
        })
    });

    return io;
};