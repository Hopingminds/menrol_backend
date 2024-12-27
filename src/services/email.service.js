import nodemailer from 'nodemailer';
import 'dotenv/config';

// Configuration for G Suite Gmail
let nodeConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USERNAME,
        serviceClient: process.env.OAUTH_CLIENTID,
        privateKey: process.env.OAUTH_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
};

let transporter = nodemailer.createTransport(nodeConfig);

export async function sendEmail(name, email, subject, message) {
    try {
        if(!name || !email || !subject || !message){
            return { success: false, message: 'Missing fields to send email.' };
        }

        let emailMessage = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: subject,
            html: message,
        };

        await transporter.sendMail(emailMessage);
        console.log(name, email, subject);
        
        return { success: true, message: 'Email sent Successfully.' };
    } catch (error) {
        console.log(error.message);
        return { success: false, message: error.message };
    }
}