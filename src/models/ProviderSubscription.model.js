import mongoose from "mongoose";

export const ProviderSubscriptionSchema = new mongoose.Schema({
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription',
        required: true,
    },
    trxnId: {
        type: String,
        required: true
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
        required: true,
    },
    respOrderInfo:{
        type: Object,
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'cancelled'],
        default: 'active',
    },
    paymentStatus: {
        type: String,
        enum: ['paid', 'pending', 'failed'],
        default: 'pending',
    },
}, { timestamps: true });

// Middleware to update the status if the subscription has expired
ProviderSubscriptionSchema.pre("save", function (next) {
    if (this.endDate < new Date()) {
        this.status = "expired";
    }
    next();
});

// Middleware to update the status when querying documents
ProviderSubscriptionSchema.pre("find", async function (next) {
    await this.model.updateMany(
        { endDate: { $lt: new Date() }, status: { $ne: "expired" } },
        { status: "expired" }
    );
    next();
});

// Middleware for findOne queries
ProviderSubscriptionSchema.pre("findOne", async function (next) {
    if (this.endDate < new Date()) {
        this.status = "expired";
    }
    next();
});

export default mongoose.model.ProviderSubscriptions || mongoose.model('ProviderSubscription', ProviderSubscriptionSchema);