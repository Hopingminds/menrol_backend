import jwt from 'jsonwebtoken';
import 'dotenv/config'
import AdminModel from "../models/Admin.model.js";

export default async function AdminAuth(req,res,next) {
    try {
        // access authorize header to validate request
        const token = req.headers.authorization.split(' ')[1];

        // retrive the user details fo the logged in user
        const decodedToken = await jwt.verify(token, process.env.JWT_SECRET);

        // res.json(decodedToken)
        let { adminID } = decodedToken
        let user = await AdminModel.findById(adminID).select('+authToken')
        if (user.authToken === token) {
            req.admin = decodedToken;
            next()
        } else{
            throw new Error("Invalid user or token");
        }
    } catch (error) {
        res.status(401).json({ error : "Authentication Failed!"})
    }
}
