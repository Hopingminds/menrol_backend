import "dotenv/config";
import twilio from "twilio";


const client = new twilio.Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


export async function callProvider(req, res) {
    try {
        const { customerNumber, deliveryAgentNumber } = req.body;

        const call = await client.calls.create({
            url: `${process.env.APP_BASE_URL}/api/v1/voiceCallResponse?deliveryAgentNumber=` + encodeURIComponent(deliveryAgentNumber),
            to: customerNumber,  // Now calling the CUSTOMER first
            from: process.env.TWILIO_VIRTUAL_NUMBER
        });

        res.json({ success: true, callSid: call.sid });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}

export async function voiceCallResponse(req, res) {
    try {
        const deliveryAgentNumber = req.query.deliveryAgentNumber; // Get delivery agent's number from query params
        const twiml = new twilio.twiml.VoiceResponse();
        console.log(deliveryAgentNumber);
        
        if (deliveryAgentNumber) {
            const dial = twiml.dial();
            dial.number(deliveryAgentNumber);
            twiml.say("Connecting your call. Please hold...");
        } else {
            twiml.say("Invalid request, cannot connect the call.");
        }

        res.type("text/xml").send(twiml.toString());
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal Server Error: " + error.message });
    }
}