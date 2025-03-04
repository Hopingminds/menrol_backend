import express from 'express';
import favicon from 'serve-favicon';
import crossOrigin from 'cors';
import cookieParser from 'cookie-parser';
import appRoot from 'app-root-path';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from "url";

// Import application middleware 
import corsOptions from '../configs/cors.config.js';
import * as ServerStatus from '../services/serverInfo.service.js'
import currentDateTime from '../lib/current.date.time.js';

// Import application routes
import morganLogger from '../middleware/morgan.logger.js';
import { limiter } from '../middleware/access.limiter.js';

// Routes
import ServicesRoutes from '../routes/Services.routes.js'
import ServiceProviderRoutes from '../routes/ServiceProvider.routes.js'
import CommonRoutes from '../routes/Common.routes.js'
import UserRoutes from '../routes/User.routes.js'
import AdminRoutes from '../routes/Admin.routes.js'
import OrderRoutes from '../routes/Order.routes.js'
import SubscriptionRoutes from '../routes/Subscription.routes.js'
import PaymentRoutes from '../routes/Payment.routes.js'
import PostsRoutes from '../routes/Posts.routes.js'
import CallsRoutes from '../routes/Calls.routes.js'

// Load environment variables from .env file
dotenv.config();

// Initialize express app
const app = express();

// Limiting middleware for all requests
app.use(limiter);

// HTTP request logger middleware
if (process.env.APP_NODE_ENV !== 'production') {
    app.use(morganLogger());
    app.use(morgan('tiny'));
}

// Secure HTTP headers setting middleware
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// Allow cross-origin resource sharing
app.use(crossOrigin(corsOptions));

// Parse cookies from requests
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set favicon in API routes
if (process.env.APP_NODE_ENV !== 'production') {
    app.use(favicon(`${appRoot}/public/favicon.ico`));
}

// Set static folder
app.use(express.static('public'));

// Parse requests of content-type ~ application/json
app.use(express.json());

// Parse requests of content-type ~ application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Response default (welcome) route
app.get("/", ServerStatus.getServerLoadInfo, (req, res) => {
    const uptime = ServerStatus.calculateUptime();
    const serverLoadInfo = req.serverLoadInfo;
    res.status(200).send({
        success: true,
        message: "Menrol Backend!",
        dateTime: new Date().toLocaleString(),
        connectedClient: process.env.CLIENT_BASE_URL,
        systemStatus: {
            uptime: `${uptime}s`,
            cpuLoad: serverLoadInfo.cpuLoad,
            memoryUsage: serverLoadInfo.memoryUsage,
        },
    });
});

// Set application API routes
app.use('/api/v1', UserRoutes);
app.use('/api/v1', OrderRoutes);
app.use('/api/v1', AdminRoutes);
app.use('/api/v1', CommonRoutes);
app.use('/api/v1', ServicesRoutes);
app.use('/api/v1', ServiceProviderRoutes);
app.use('/api/v1', SubscriptionRoutes);
app.use('/api/v1', PaymentRoutes);
app.use('/api/v1', PostsRoutes);
app.use('/api/v1', CallsRoutes);

// 404 ~ not found error handler
app.use((req, res, _next) => {
    res.status(404).json({
        time: currentDateTime(),
        result: {
            title: "UNKNOWN ACCESS",
            error: "Sorry! Your request url was not found."
        }
    });
});
  

// 500 ~ internal server error handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next('Something went wrong. App server error.');
    }
    if (err.message) {
        console.log(err);
        return res.status(500).json({
            time: currentDateTime(),
            result: {
                title: "SERVER SIDE ERROR",
                error: err.message
            }
        });
    } else {
        return res.status(500).json({
            time: currentDateTime(),
            result: {
                title: "SERVER SIDE ERROR",
                error: "Something went wrong. There was an error."
            }
        });
    }
});

// Default export ~ app
export default app;
