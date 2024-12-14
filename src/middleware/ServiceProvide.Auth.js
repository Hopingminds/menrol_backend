import jwt from 'jsonwebtoken';
import 'dotenv/config'
import ServiceProviderModel from "../models/ServiceProvider.model.js";


export default async function SPAuth(req,res,next) {
    try {
        // access authorize header to validate request
        const token = req.headers.authorization.split(' ')[1];

        // retrive the user details fo the logged in user
        const decodedToken = await jwt.verify(token, process.env.JWT_SECRET);

        // res.json(decodedToken)
        let { userID } = decodedToken
        let user = await ServiceProviderModel.findById(userID).select('+authToken')
        if (user.authToken === token) {
            if(user.isAccountBlocked){
                return res.status(403).json({ success: false, message: 'ServiceProvider has been blocked' });
            }
            req.sp = decodedToken;
            next()
        } else{
            throw new Error("Invalid user or token");
        }
    } catch (error) {
        res.status(401).json({ error : "Authentication Failed!"})
    }
}
