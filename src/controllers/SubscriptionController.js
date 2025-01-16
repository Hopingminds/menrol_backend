import ProviderSubscriptionModel from "../models/ProviderSubscription.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";
import SubscriptionModel from "../models/Subscription.model.js";

export async function createSubscription(req, res) {
    try {
        const { planName, description, features, price, duration, discount, promoCode, status } = req.body;

        // Validate input
        if (!planName || !description || !features || !price || !duration) {
            return res.status(400).json({ success: false, message: "Plan name, description, features, price, and duration are required." });
        }

        // Validate duration
        const validDurations = ['monthly', 'quarterly', 'sixMonth', 'annually'];
        if (!validDurations.includes(duration)) {
            return res.status(400).json({ success: false,  message: "Invalid duration value." });
        }

        // Validate status
        const validStatuses = ['active', 'inactive', 'archived'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value." });
        }

        // Create new subscription
        const newSubscription = new SubscriptionModel({
            planName,
            description,
            features,
            price,
            duration,
            discount: discount || 0,
            promoCode: promoCode || [],
            status: status || 'active',
        });

        await newSubscription.save();

        return res.status(201).json({
            success: true,
            message: "Subscription created successfully.",
            subscription: newSubscription,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function updateSubscription(req, res) {
    try {
        const { _id, ...updateData } = req.body; 

        // Check for valid duration if it exists in the update payload
        if (updateData.duration) {
            const validDurations = ['monthly', 'quarterly', 'sixMonth', 'annually'];
            if (!validDurations.includes(updateData.duration)) {
                return res.status(400).json({ success: false,  message: "Invalid duration value." });
            }
        }

        // Check for valid status if it exists in the update payload
        if (updateData.status) {
            const validStatuses = ['active', 'inactive', 'archived'];
            if (!validStatuses.includes(updateData.status)) {
                return res.status(400).json({ success: false, message: "Invalid status value." });
            }
        }

        // Perform the update
        const updatedSubscription = await SubscriptionModel.findByIdAndUpdate(
            _id,
            { $set: updateData },
            { new: true, runValidators: true } // Return the updated document and validate the data
        );

        if (!updatedSubscription) {
            return res.status(404).json({ success: false, message: "Subscription not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Subscription updated successfully.",
            subscription: updatedSubscription,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function deleteSubscription(req, res) {
    try {
        const { subscriptionId } = req.body;

        // Validate subscriptionId
        if (!subscriptionId) {
            return res.status(400).json({ success: false, message: "Missing subscription ID." });
        }

        // Attempt to delete the subscription
        const deletedSubscription = await SubscriptionModel.findByIdAndDelete(subscriptionId);

        if (!deletedSubscription) {
            return res.status(404).json({ success: false, message: "Subscription not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Subscription deleted successfully.",
            subscription: deletedSubscription,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getAllSubscriptions(req, res) {
    try {
        // Fetch all active subscriptions
        const activeSubscriptions = await SubscriptionModel.find();

        if (activeSubscriptions.length === 0) {
            return res.status(404).json({ success: false, message: "No active subscriptions found." });
        }

        return res.status(200).json({
            success: true,
            message: "All subscriptions fetched successfully.",
            subscriptions: activeSubscriptions,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getActiveSubscriptions(req, res) {
    try {
        // Fetch all active subscriptions
        const activeSubscriptions = await SubscriptionModel.find({ status: "active" });

        if (activeSubscriptions.length === 0) {
            return res.status(404).json({ success: false, message: "No active subscriptions found." });
        }

        return res.status(200).json({
            success: true,
            message: "Active subscriptions fetched successfully.",
            subscriptions: activeSubscriptions,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function getSubscription(req, res) {
    try {
        const { subscriptionId } = req.query;

        const subscription = await SubscriptionModel.findById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Subscription fetched successfully.",
            subscription: subscription
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function purchaseSubscription(req, res) {
    try {
        const { userID } = req.sp;
        const { subscriptionId } = req.body;

        // Validate input
        if (!subscriptionId) {
            return res.status(400).json({ success: false, message: "Subscription ID is required." });
        }

        // Fetch subscription
        const subscription = await SubscriptionModel.findById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found." });
        }

        // Fetch service provider
        const provider = await ServiceProviderModel.findById(userID);
        if (!provider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        // Check if the provider already has an active subscription
        if (provider.activeSubscription) {
            const currentSubscription = await ProviderSubscriptionModel.findById(provider.activeSubscription);
            if (currentSubscription) {
                // Check if the current subscription is still active based on the end date
                const currentDate = new Date();
                if (currentSubscription.endDate > currentDate) {
                    return res.status(400).json({ success: false, message: "Provider already has an active subscription that hasn't expired yet." });
                }
            }
        }

        // Calculate subscription end date based on duration
        const durationMapping = {
            monthly: 1,
            quarterly: 3,
            sixMonth: 6,
            annually: 12,
        };

        const durationMonths = durationMapping[subscription.duration];
        if (!durationMonths) {
            return res.status(400).json({ success: false, message: "Invalid subscription duration." });
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + durationMonths);

        // Create ProviderSubscription
        const providerSubscription = new ProviderSubscriptionModel({
            provider: userID,
            subscription: subscriptionId,
            startDate,
            endDate,
            status: 'active',
            paymentStatus: 'paid', // Assuming payment is handled elsewhere
        });

        await providerSubscription.save();

        // Update provider with active subscription
        provider.activeSubscription = providerSubscription._id;
        provider.providerSubscription.push(providerSubscription._id);
        await provider.save();

        return res.status(201).json({
            success: true,
            message: "Subscription purchased successfully.",
            providerSubscription,
        });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}