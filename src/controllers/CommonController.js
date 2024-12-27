import ContactModel from "../models/Contact.model.js";
import { sendEmail } from "../services/email.service.js";
import { sendOTP } from "../services/otp.service.js";
import 'dotenv/config';

/** POST: http://localhost:3027/api/v1/sendOtp
 * @body {
 *  "phone": "8765445678"
 * }
 */
export async function sendOtp(req, res) {
    try {
        const { phone } = req.body;

        // Validate phone number format
        const isValidPhone = /^\d{10}$/.test(phone); // Adjust regex as needed
        if (!isValidPhone) {
            return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
        }

        const result = await sendOTP(phone);

        if (!result.success) {
            throw new Error('Failed to send OTP.');
        }
        
        return res.status(201).json({ success: true, message: 'OTP sent successfully.' })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function sendEmailQuery(req, res) {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(404).json({ success: false, message: 'Missing Required fields.' });
        }
        const subject = `Menrol Email Query from ${name}`;

        const result = await sendEmail(name, process.env.EMAIL_USERNAME, subject, message);
        if (!result.success) {
            throw new Error('Failed to send email.');
        }

        const mailData = new ContactModel({
            name,
            email,
            message,
        });

        await mailData.save();

        return res.status(200).json({ success: true, message: 'Email sent successfully.' })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}