import mongoose from "mongoose";

export const SubscriptionSchema = new mongoose.Schema({
    planName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    features: {
        type: [String],
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    duration: {
        type: String,
        enum: ['monthly', 'quarterly', 'sixMonth', 'annually'],
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'archived'],
        default: 'active',
    },
    discount: {
        type: Number,
        default: 0,
    },
    promoCode: {
        type: [String],
        default: null,
        select: false,
    },
}, { timestamps: true });

export default mongoose.model.Subscriptions || mongoose.model('Subscription', SubscriptionSchema);