import { sendOTP } from "../services/otp.service.js";

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