import ICICI from "icici-dev";
import { CONSTANTS } from '../lib/constant.js';

const icici = new ICICI();
export async function initiatePayment(req, res) {
    try {
        console.log("made a hit", req.body);

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
            UDF01: req.body.UDF01,
            UDF02: req.body.UDF02,
            UDF03: req.body.UDF03,
            UDF04: req.body.UDF04,
            UDF05: req.body.UDF05,
            UDF06: req.body.UDF06,
            UDF07: req.body.UDF07,
            UDF08: req.body.UDF08,
            UDF09: req.body.UDF09,
            UDF10: req.body.UDF10,
        });

        if (response.status == true) {
            const gatewayURL = response.data.gatewayURL; // Replace with your actual URL
            const EncData = response.data.EncData; // Replace with your data
            const data = response.data.data;

            console.log(response.data);

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