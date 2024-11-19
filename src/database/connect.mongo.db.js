import mongoose from "mongoose";
import logger from "../middleware/winston.logger.js";
import "dotenv/config";

const connectionString = process.env.MONGO_URI;
mongoose.set("strictQuery", false);

const connectDatabase = async () => {
    try {
        await mongoose.connect(connectionString);
        logger.info("Connection established to MongoDB database successfully!");
    } catch (error) {
        logger.error("Error connecting to MongoDB: ", error);
    }
};

export default connectDatabase;
