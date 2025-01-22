import { Server } from 'socket.io';
import notificationEmitter from '../events/notificationEmitter.js';
import ServiceOrderModel from '../models/ServiceOrder.model.js';

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
    });

    return io;
};