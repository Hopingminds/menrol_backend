import mongoose from "mongoose";

const ServiceRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    serviceProvider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        default: null,
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
    address:{
        type: String,
        required: true,
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
    },
    payment: {
        amount: { type: Number },
        status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
        method: { type: String, enum: ['app', 'cash'], default: 'app' },
    },
    otp: {
        start: { type: String, default: null },
        end: { type: String, default: null },
    },
    instructions: {
        type: String,
        default: null,
    },
    images: [{
        type: String,
        default: null,
    }],
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

ServiceRequestSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceRequest || mongoose.model('ServiceRequest', ServiceRequestSchema);