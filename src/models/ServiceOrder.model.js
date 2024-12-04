import mongoose from "mongoose";

const ServiceOrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    serviceProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true,
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Services',
        required: true,
    },
    subcategory: [{
        type: String,
        required: true,
    }],
    orderDate: {
        type: Date,
        default: Date.now,
    },
    scheduledDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
        default: 'pending',
    },
    totalCost: {
        type: Number,
        required: true,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending',
    },
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        comment: {
            type: String,
            default: null,
        }
    }
}, { timestamps: true });

export default mongoose.model.ServiceOrder || mongoose.model('ServiceOrder', ServiceOrderSchema);