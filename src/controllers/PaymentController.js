import ICICI from "icici-dev";
import { CONSTANTS } from '../lib/constant.js';
import ProviderSubscriptionModel from "../models/ProviderSubscription.model.js";
import SubscriptionModel from "../models/Subscription.model.js";
import ServiceProviderModel from "../models/ServiceProvider.model.js";

const icici = new ICICI();

export async function initiatePayment(req, res) {
    try {
        const response = icici.initiate({
            encKey: CONSTANTS.ENC_KEY,
            saltKey: CONSTANTS.SECURE_SECRET,
            merchantId: CONSTANTS.MERCHANTID,
            terminalId: CONSTANTS.TERMINALID,
            amount: req.body.Amount,
            bankId: CONSTANTS.BANKID,
            passCode: CONSTANTS.PASSCODE,
            mcc: CONSTANTS.MCC,
            returnURL: CONSTANTS.RETURNURL,
            txnRefNo: req.body.TxnRefNo,
            currency: req.body.Currency,
            orderInfo: req.body.OrderInfo,
            email: req.body.Email,
            firstName: req.body.FirstName,
            lastName: req.body.LastName,
            street: req.body.Street,
            state: req.body.State,
            city: req.body.City,
            zip: req.body.ZIP,
            phone: req.body.Phone,
        });

        if (response.status == true) {
            const gatewayURL = response.data.gatewayURL; // Replace with your actual URL
            const EncData = response.data.EncData; // Replace with your data
            const data = response.data.data;

            res.render("sales/form_submitter", { gatewayURL, EncData, data });
        } else {
            res.send(response);
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function paymentCheckResponse(req, res) {
    try {
        const { paymentResponse } = req.query

        const encKey = CONSTANTS.ENC_KEY;
        const saltKey = CONSTANTS.SECURE_SECRET;

        const data = icici.checkResponse({ encKey, saltKey, paymentResponse })
        console.log(data);

        return res.status(200).json({
            success: true,
            message: 'Payment Check Response',
            data
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

function extractAddressDetails(address) {
    const addressParts = address.split(",").map(part => part.trim()); // Split by commas and trim spaces

    // Extract state and ZIP code
    const stateAndZip = addressParts[addressParts.length - 2]; // Second last part contains state and ZIP
    const [state, zipCode] = stateAndZip.match(/(.+)\s(\d{6})/)?.slice(1) || []; // Extract state and ZIP code

    // Remaining address parts (excluding state and ZIP code)
    const remainingParts = addressParts.slice(0, addressParts.length - 2);

    // Extract city (third last part)
    const city = `${addressParts[addressParts.length - 4] || ''}, ${addressParts[addressParts.length - 3] || ''}`.trim();

    // Combine remaining parts as the street
    const street = addressParts.slice(0, addressParts.length - 4).join(", ") || null;
    return {
        street: street || null,
        city: city || null,
        state: state ? state.trim() : null,
        zipCode: zipCode || null
    };

}

export async function initiatePurchaseSubcription(req, res) {
    try {
        const { userID } = req.sp;
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ success: false, message: "Subscription ID is required." });
        }

        const subscription = await SubscriptionModel.findById(subscriptionId);
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found." });
        }

        const provider = await ServiceProviderModel.findById(userID);
        if (!provider) {
            return res.status(404).json({ success: false, message: "Service provider not found." });
        }

        if (provider.activeSubscription) {
            const currentSubscription = await ProviderSubscriptionModel.findById(provider.activeSubscription);
            if (currentSubscription) {
                const currentDate = new Date();
                if (currentSubscription.endDate > currentDate) {
                    return res.status(400).json({ success: false, message: "Provider already has an active subscription that hasn't expired yet." });
                }
            }
        }

        const durationMapping = {
            monthly: 1,
            quarterly: 3,
            sixMonth: 6,
            annually: 12,
        };

        const durationMonths = durationMapping[subscription.duration];
        if (!durationMonths) {
            return res.status(400).json({ success: false, message: "Invalid subscription duration." });
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + durationMonths);

        const providerSubscription = new ProviderSubscriptionModel({
            provider: userID,
            subscription: subscriptionId,
            startDate,
            endDate,
            status: 'active',
            paymentStatus: 'pending',
        });

        await providerSubscription.save();

        // const providerDetailedAddress = extractAddressDetails(provider.address)
        const response = icici.initiate({
            encKey: CONSTANTS.ENC_KEY,
            saltKey: CONSTANTS.SECURE_SECRET,
            merchantId: CONSTANTS.MERCHANTID,
            terminalId: CONSTANTS.TERMINALID,
            amount: subscription.price.toString(),
            bankId: CONSTANTS.BANKID,
            passCode: CONSTANTS.PASSCODE,
            mcc: CONSTANTS.MCC,
            returnURL: `${CONSTANTS.RETURNURL}CheckSubcriptionPaymentResponse`,
            TxnType: "Pay",
            txnRefNo: `SUB-${subscription.planName.slice(0, 3).toUpperCase()}-${Date.now()}`,
            currency: 356,
            orderInfo: providerSubscription._id,
            phone: provider.phone.toString(),
            email: provider.email || 'noEmail@default.com',
            firstName: provider.name,
            lastName: "lastName",
            street: "street",
            state: "state",
            city: "city",
            zip: "765432",
        });
        
        if (response.status == true) {
            const gatewayURL = response.data.gatewayURL;
            const EncData = response.data.EncData;
            const data = response.data.data;
            
            res.render("sales/form_submitter", { gatewayURL, EncData, data });
        } else {
            return res.status(422).json({
                success: response.status,
                message: response.message
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function CheckSubcriptionPaymentResponse(req, res) {
    try {
        const { paymentResponse } = req.query

        const encKey = CONSTANTS.ENC_KEY;
        const saltKey = CONSTANTS.SECURE_SECRET;

        const data = icici.checkResponse({ encKey, saltKey, paymentResponse })
        console.log(data.data.OrderInfo);

        if(data.data.ResponseCode !== "00"){
            return res.status(402).json({ success: false, message: 'Payment failed' });
        }

        const providerSubscription = await ProviderSubscriptionModel.findById(data.data.OrderInfo);
        if (!providerSubscription) {
            return res.status(404).json({ success: false, message: 'Provider Subscription order not found' });
        }

        providerSubscription.respOrderInfo = data.data;
        providerSubscription.paymentStatus = 'paid';
        await providerSubscription.save();
        
        const provider = await ServiceProviderModel.findById(providerSubscription.provider);
        if (!provider) {
            return res.status(404).json({ success: false, message: 'Provider not found for the Subscription order' });
        }

        provider.activeSubscription = providerSubscription._id;
        provider.providerSubscription.push(providerSubscription._id);
        await provider.save();

        return res.status(200).json({
            success: true,
            message: 'Payment Check Response',
            data
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}