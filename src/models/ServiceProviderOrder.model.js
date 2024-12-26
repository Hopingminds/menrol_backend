import mongoose from "mongoose";

const ServiceProviderOrderSchema = new mongoose.Schema({
    ServiceProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
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
                    requestType: { type: String, required: true },
                    instructions: { type: String },
                    instructionsImages: { type: [String], default: [] },
                    scheduledTiming: {
                        startTime: { type: Date, required: true },
                        endTime: { type: Date, required: true },
                    },
                    workersRequirment: { type: Number, required: true },
                    assignedWorkers: {
                        type: Number,
                        required: true,
                    },
                    serviceStatus: {
                        type: String,
                        enum: ['pending', 'confirmed', 'cancelled', 'inProgress', 'completed'],
                        default: 'pending',
                    },
                    otpDetails: {
                        startOtp: { type: Number, default: 0 },
                        endOtp: { type: Number, default: 0 },
                        startOtpConfirmed: { type: Boolean, default: false },
                        endOtpConfirmed: { type: Boolean, default: false },
                    },
                    workConfirmation: {
                        workStarted: { type: Boolean, default: false },
                        startTime: { type: Date, default: null },
                        workEnded: { type: Boolean, default: false },
                        endTime: { type: Date, default: null },
                    },
                },
            ],
        },
    ],
    paymentDetails: {
        totalAmount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        paymentStatus: {
            type: String,
            enum: ['pending', 'partial', 'completed', 'failed'],
            default: 'pending',
        },
        lastPaymentDate: { type: Date, default: null },
    },
}, { timestamps: true });

export default mongoose.models.ServiceProviderOrder || mongoose.model('ServiceProviderOrder', ServiceProviderOrderSchema);
