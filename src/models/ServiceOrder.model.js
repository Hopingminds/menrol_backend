import mongoose from "mongoose";
import ServicesModel from "./Services.model.js";

// Function to generate a random 6-digit OTP
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const ServiceOrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    serviceRequest: [
        {
            service: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Services',
                required: true,
            },
            subcategory: [
                {
                    subcategoryId: {
                        type: mongoose.Schema.Types.ObjectId,
                        required: true,
                    },
                    scheduledTiming: {
                        startTime: { type: Date, required: true },
                        endTime: { type: Date, required: true },
                    },
                    title: { type: String, required: true },
                    requestType: { type: String, required: true },
                    selectedAmount: { type: Number, required: true },
                    workersRequirment: { type: Number, required: true },
                    status: {
                        type: String,
                        enum: ['pending', 'confirmed', 'cancelled', 'inProgress', 'completed'],
                        required: true
                    },
                    instructions: { type: String },
                    instructionsImages: { type: [String], default: [] },
                    instructionAudio: { type: String, default: null },
                    requestOperation: {
                        startOtp: {
                            type: Number,
                            default: generateOtp,
                        },
                        endOtp: {
                            type: Number,
                            default: generateOtp,
                        },
                    },
                    viewers:[
                        {
                            serviceProvider: {
                                type: mongoose.Schema.Types.ObjectId,
                                ref: 'User'
                            },  
                        }
                    ],
                    serviceProviders: [
                        {
                            serviceProviderId: {
                                type: mongoose.Schema.Types.ObjectId,
                                ref: 'User',
                                required: true,
                            },
                            status: {
                                type: String,
                                enum: ['pending', 'confirmed', 'cancelled', 'inProgress', 'completed'],
                                default: 'pending',
                            },
                            paymentReceived:{
                                type: Boolean,
                                default: false,
                            }
                        }
                    ],
                }
            ]
        }
    ],
    orderDate: {
        type: Date,
        default: Date.now,
    },
    orderStatus: {
        type: String,
        enum: ['notStarted', 'active', 'finalized', 'underProgress', 'fullyCancelled', 'completed'],
        default: 'notStarted',
    },
    orderRaised:{
        type: Boolean,
        default: false
    },
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
    payment: {
        totalamount: { type: Number, default: 0 },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        paymentType: {
            type: String,
            enum: ['upfront', 'post-service'],
            default: 'upfront'
        },
        paymentstatus: {
            type: String,
            enum: ['pending', 'partial', 'completed', 'failed'],
            default: 'pending'
        },
        paymentmethod: { type: String, enum: ['app', 'cash'], default: 'app' },
        paymentDate: { type: Date, default: null },
    },
}, { timestamps: true });

ServiceOrderSchema.index({ location: '2dsphere' });

ServiceOrderSchema.pre('save', async function (next) {
    if (!this.isModified('serviceRequest')) return next();

    const statuses = this.serviceRequest.flatMap((request) =>
        request.subcategory.map((sub) => sub.status)
    );

    this.orderRaised = statuses.some((status) => status === 'pending');

    if (statuses.every((status) => status === 'pending')) {
        this.orderStatus = 'notStarted';
    } else if (statuses.every((status) => status === 'confirmed')) {
        this.orderStatus = 'finalized';
    } else if (statuses.every((status) => status === 'cancelled')) {
        this.orderStatus = 'fullyCancelled';
    } else if (statuses.every((status) => ['completed', 'cancelled'].includes(status))) {
        this.orderStatus = 'completed';
    } else if (statuses.some((status) => status === 'inProgress') && statuses.every((status) => ['confirmed', 'inProgress', 'completed', 'cancelled'].includes(status))) {
        this.orderStatus = 'underProgress';
    } else {
        this.orderStatus = 'active';
    }

    next();
});

ServiceOrderSchema.post('save', async function (doc, next) {
    try {
        const subcategoryIds = new Set();
        doc.serviceRequest.forEach(request => {
            request.subcategory.forEach(sub => {
                subcategoryIds.add(sub.subcategoryId.toString());
            });
        });

        await ServicesModel.updateMany(
            { "subcategory._id": { $in: Array.from(subcategoryIds) } },
            { $inc: { "subcategory.$.noOfBookings": 1 } }
        );

        next();
    } catch (error) {
        next(error);
    }
});

export default mongoose.model.ServiceOrder || mongoose.model('ServiceOrder', ServiceOrderSchema);