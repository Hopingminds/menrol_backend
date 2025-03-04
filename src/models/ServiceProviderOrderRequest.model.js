import mongoose from "mongoose";

const ServiceProviderOrderRequestSchema = new mongoose.Schema({
    ServiceProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    serviceOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOrder',
        required: true,
    },
    servicesProvided: [
        {
            serviceId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Services',
                required: true,
            },
            subcategory: [
                {
                    subcategoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
                    title: { type: String, required: true },
                    requestType: { type: String,  },
                    selectedAmount: { type: Number,  },
                    instructions: { type: String },
                    instructionsImages: { type: [String], default: [] },
                    instructionAudio: { type: String, default: null },
                    scheduledTiming: {
                        startTime: { type: Date,  },
                        endTime: { type: Date,  },
                    },
                    workersRequirment: { type: Number, },
                    assignedWorkers: {
                        type: Number,
                    },
                    serviceStatus: {
                        type: String,
                        enum: ['pending', 'accepted', 'rejected'],
                        default: 'pending',
                    },
                },
            ],
        },
    ],
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true,
        }
    },
    address: {
        type: String,
        required: true,
    },
    paymentDetails: {
        totalAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        paymentType: {
            type: String,
            enum: ['upfront', 'post-service'],
            default: 'upfront'
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'partial', 'completed', 'failed'],
            default: 'pending',
        },
        lastPaymentDate: { type: Date, default: null },
    },
}, { timestamps: true });

export default mongoose.models.ServiceProviderOrderRequests || mongoose.model('ServiceProviderOrderRequest', ServiceProviderOrderRequestSchema);
