import mongoose from "mongoose";

const ServiceProviderOrderSchema = new mongoose.Schema({
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
                    requestType: { type: String, required: true },
                    selectedAmount: { type: Number, required: true },
                    instructions: { type: String },
                    instructionsImages: { type: [String], default: [] },
                    instructionAudio: { type: String, default: null },
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
                    paymentReceived: {
                        type: Boolean,
                        default: false,
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
    isOrderRequested: {
        type: Boolean,
        default: true,
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

// Middleware to update `isOrderRequested`
ServiceProviderOrderSchema.pre("save", function (next) {
    const order = this;

    const allStatuses = order.servicesProvided.flatMap(sp =>
        sp.subcategory.map(sub => sub.serviceStatus)
    );

    // If all statuses are NOT 'pending', set isOrderRequested to false
    if (allStatuses.every(status => status !== "pending")) {
        order.isOrderRequested = false;
    } else {
        order.isOrderRequested = true;
    }

    next();
});

export default mongoose.models.ServiceProviderOrder || mongoose.model('ServiceProviderOrder', ServiceProviderOrderSchema);
