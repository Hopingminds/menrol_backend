import express from 'express';
import favicon from 'serve-favicon';
import crossOrigin from 'cors';
import cookieParser from 'cookie-parser';
import appRoot from 'app-root-path';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';

// Import application middleware 
import corsOptions from '../configs/cors.config.js';
import * as ServerStatus from '../services/serverInfo.service.js'
import currentDateTime from '../lib/current.date.time.js';

// Import application routes
import morganLogger from '../middleware/morgan.logger.js';
import { limiter } from '../middleware/access.limiter.js';

// Routes
// import paymentRoutes from '../routes/payment.routes.js';

// Load environment variables from .env file
dotenv.config();

// Initialize express app
const app = express();

// Limiting middleware for all requests
app.use(limiter);

// Application database connection establishment
import connectDatabase from '../database/connect.mongo.db.js';
connectDatabase();

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
    res.status(201).send({
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
// app.use('/api/v1', paymentRoutes);

// 404 ~ not found error handler
app.use((_req, res, _next) => {
    res.status(404).json({
        time: currentDateTime(),
        result: {
            title: "UNKNOWN ACCESS",
            error: "Sorry! Your request url was not found."
        }
    });
});
  

// 500 ~ internal server error handler
app.use((err, _req, res, _next) => {
    if (res.headersSent) {
        return _next('Something went wrong. App server error.');
    }
    if (err.message) {
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

// Example route that might throw an error
app.get('/test', (req, res) => {
    throw new Error('This is a test error');
});


// Default export ~ app
export default app;
