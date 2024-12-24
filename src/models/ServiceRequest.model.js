import mongoose from "mongoose";

const ServiceRequestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    requestedServices: [{
        service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Services',
            required: true,
        },
        subcategory: [{
            subcategoryId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true
            },
            title: {
                type: String,
                required: true,
            },
            requestType: {
                type: String,
                enum: ["hourly", "daily", "contract"],
                default: "daily",
            },
            selectedAmount:{
                type: Number,
                required: true,
            },
            workersRequirment: {
                type: Number,
                default: 1,
            },
            status: {
                type: String,
                enum: ['pending', 'confirmed', 'cancelled', 'inProgress', 'completed'],
                default: 'pending',
            },
            instructions: {
                type: String,
                default: null,
            },
            instructionsImages: [{
                type: String,
                default: null,
            }],
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
        }],
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
}, { timestamps: true });

ServiceRequestSchema.index({ location: '2dsphere' });

export default mongoose.model.ServiceRequest || mongoose.model('ServiceRequest', ServiceRequestSchema);