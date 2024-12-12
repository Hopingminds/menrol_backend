import mongoose from "mongoose";

const ServiceRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    requestType:{
        type: String,
        enum: ["hourly", "daily", "contract"],
        default: "daily",
    },
    scheduledTiming: {
        startTime: {
            type: Date, // DateTime for the start of the appointment
            required: true,
        },
        endTime: {
            type: Date, // DateTime for the start of the appointment
            default: null,
        },
    },
    workersRequirment: {
        type: Number,
        default: 1,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending',
    },
    payment: {
        amount: { type: Number, required: true }, // The total amount to be paid.
        paidAmount: { type: Number, default: 0 }, // Amount paid so far.
        dueAmount: { type: Number, default: 0 },  // Amount still to be paid.
        status: { 
            type: String, 
            enum: ['pending', 'partial', 'completed', 'failed'], 
            default: 'pending' 
        },
        method: { type: String, enum: ['app', 'cash'], default: 'app' },
        paymentType: { 
            type: String, 
            enum: ['upfront', 'post-service'], 
            default: 'upfront' 
        },
        paymentDate: { type: Date, default: null }, // The date when the payment was made.
    },
    instructions: {
        type: String,
        default: null,
    },
    images: [{
        type: String,
        default: null,
    }],
}, { timestamps: true });

ServiceRequestSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceRequest || mongoose.model('ServiceRequest', ServiceRequestSchema);