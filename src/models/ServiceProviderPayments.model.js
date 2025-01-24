import mongoose from "mongoose";

export const ServiceProviderPaymentsSchema = new mongoose.Schema({
    serviceProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true,
    },
    serviceOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOrder',
        required: true,
    },
    orderServiceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    orderSubcategoryId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    totalEarned: {
        type: Number,
        required: true,
    },
    paymentCredited: {
        type: Boolean,
        default: false,
    },
    paymentDetails: {
        transactionId: {
            type: String,
            default: null
        },
        paymentMethod: {
            type: String,
            enum: ["bank_transfer", "upi", "cash"],
            default: "cash",
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "credited", "failed"],
            default: "pending",
        },
    },
    paymentCreditDate: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Middleware to validate referenced IDs
ServiceProviderPaymentsSchema.pre("save", async function (next) {
    const serviceOrderExists = await mongoose
        .model("ServiceOrder")
        .exists({ _id: this.serviceOrderId });
    const serviceProviderExists = await mongoose
        .model("ServiceProvider")
        .exists({ _id: this.serviceProviderId });

    if (!serviceOrderExists || !serviceProviderExists) {
        return next(new Error("Invalid serviceOrderId or serviceProviderId."));
    }
    next();
});

ServiceProviderPaymentsSchema.post("save", async function () {
    try {
        // if (this.paymentCredited) {
        //     await updateServiceProviderStats(this.serviceProviderId);
        // }
        await updateServiceProviderStats(this.serviceProviderId);
    } catch (err) {
        console.error("Error updating stats after save:", err);
    }
});

ServiceProviderPaymentsSchema.post("findOneAndUpdate", async function (doc) {
    try {
        if (doc && doc.paymentCredited) {
            await updateServiceProviderStats(doc.serviceProviderId);
        }
    } catch (err) {
        console.error("Error updating stats after findOneAndUpdate:", err);
    }
});

ServiceProviderPaymentsSchema.post("deleteOne", { document: true, query: false }, async function (doc) {
    try {
        if (doc) {
            await updateServiceProviderStats(doc.serviceProviderId);
        }
    } catch (err) {
        console.error("Error updating stats after delete:", err);
    }
});

async function updateServiceProviderStats(serviceProviderId) {
    try {
        const stats = await mongoose.model('ServiceProviderPayments').aggregate([
            { $match: { serviceProviderId } },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: "$totalEarned" },
                    totalOrders: { $sum: 1 },
                },
            },
        ]);

        const { totalEarnings = 0, totalOrders = 0 } = stats[0] || {};
        await mongoose.model('ServiceProvider').updateOne(
            { _id: serviceProviderId },
            { totalEarnings, totalOrders }
        );
    } catch (err) {
        console.error("Error in updateServiceProviderStats:", err);
    }
}

// Indexes for better performance
ServiceProviderPaymentsSchema.index({ serviceProviderId: 1 });
ServiceProviderPaymentsSchema.index({ serviceOrderId: 1 });

export default mongoose.model.ServiceProviderPayments || mongoose.model('ServiceProviderPayments', ServiceProviderPaymentsSchema);