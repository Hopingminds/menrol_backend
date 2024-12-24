import mongoose from "mongoose";

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
                ref: 'Service',
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
                    serviceProvider: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: 'ServiceProvider',
                        default: null,
                    },
                }
            ]
        }
    ],
    orderDate: {
        type: Date,
        default: Date.now,
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
        totalamount: { type: Number, default: 0 }, // The total amount to be paid.
        paidAmount: { type: Number, default: 0 }, // Amount paid so far.
        dueAmount: { type: Number, default: 0 },  // Amount still to be paid.
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
        paymentDate: { type: Date, default: null }, // The date when the payment was made.
    },
}, { timestamps: true });

ServiceOrderSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceOrder || mongoose.model('ServiceOrder', ServiceOrderSchema);