import path from 'path';
import fs from 'fs';
import appRoot from 'app-root-path';
import rateLimit from 'express-rate-limit';
import FileStreamRotator from 'file-stream-rotator';
import currentDateTime from '../lib/current.date.time.js';
import logger from './winston.logger.js';

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minutes
    max: 1000, // limit each IP to 1000 requests per window (here, 1 minutes)
    message: { message: 'Too many login attempts from this IP, please try again after a 60 second pause' },
    handler: async (req, res, _next, options) => {
        try {
            const LOGS_FOLDER = `${appRoot}/logs/limiter`;

            // Create logs folder if it doesn't exist
            if (!fs.existsSync(`${appRoot}/logs`)) {
                fs.mkdirSync(`${appRoot}/logs`);
            }

            // Create limiter folder if it doesn't exist
            if (!fs.existsSync(LOGS_FOLDER)) {
                fs.mkdirSync(LOGS_FOLDER);
            }

            // Create a rotating write stream
            const apiLimiterRotator = FileStreamRotator.getStream({
                date_format: 'YYYY-MM-DD',
                filename: path.join(LOGS_FOLDER, 'app-limiter-%DATE%.log'),
                frequency: 'daily',
                verbose: false
            });

            const logMessage = `[${currentDateTime()}]\tTITLE: TOO MANY REQUEST\tMETHOD: ${req.method}\tURL: ${req.url}\tCLIENT: ${req.headers['user-agent']}\n`;

            apiLimiterRotator.write(logMessage, 'utf8');
        } catch (err) {
            logger.error('API limiter error: ', err);
        }

        // Sending API error response
        res.status(options.statusCode).json({
            time: currentDateTime(),
            result: {
                title: "TOO MANY REQUEST",
                error: options.message.message
            }
        });
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

const apiLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 1, // limit each IP to 1 login request per window (here, 10 seconds)
    message: { message: 'Too many login attempts from this IP, please try again after a 60 second pause' },
    handler: async (req, res, _next, options) => {
        try {
            const LOGS_FOLDER = `${appRoot}/logs/limiter`;

            // Create logs folder if it doesn't exist
            if (!fs.existsSync(`${appRoot}/logs`)) {
                fs.mkdirSync(`${appRoot}/logs`);
            }

            // Create limiter folder if it doesn't exist
            if (!fs.existsSync(LOGS_FOLDER)) {
                fs.mkdirSync(LOGS_FOLDER);
            }

            // Create a rotating write stream
            const apiLimiterRotator = FileStreamRotator.getStream({
                date_format: 'YYYY-MM-DD',
                filename: path.join(LOGS_FOLDER, 'api-limiter-%DATE%.log'),
                frequency: 'daily',
                verbose: false
            });

            const logMessage = `[${currentDateTime()}]\tTITLE: TOO MANY REQUEST\tMETHOD: ${req.method}\tURL: ${req.url}\tCLIENT: ${req.headers['user-agent']}\n`;

            apiLimiterRotator.write(logMessage, 'utf8');
        } catch (err) {
            logger.error('API limiter error: ', err);
        }

        // Sending API error response
        res.status(options.statusCode).json({
            time: currentDateTime(),
            result: {
                title: "TOO MANY REQUEST",
                error: options.message.message
            }
        });
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

export { limiter, apiLimiter };
