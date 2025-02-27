import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs'; // Use async functions safely
import appRoot from 'app-root-path';
import rateLimit from 'express-rate-limit';
import FileStreamRotator from 'file-stream-rotator';
import currentDateTime from '../lib/current.date.time.js';
import logger from './winston.logger.js';

const LOGS_DIR = path.join(appRoot.path, 'logs');
const LOGS_FOLDER_LIMITER = path.join(LOGS_DIR, 'limiter');
const LOGS_FOLDER_ACCESS = path.join(LOGS_DIR, 'access');

// ✅ Ensure log directories exist BEFORE initializing FileStreamRotator
const ensureLogDirs = async () => {
    try {
        await fsPromises.mkdir(LOGS_FOLDER_LIMITER, { recursive: true });
        await fsPromises.mkdir(LOGS_FOLDER_ACCESS, { recursive: true });
        console.log('[RATE LIMIT] Log directories initialized successfully.');
    } catch (err) {
        logger.error(`[RATE LIMIT] Failed to create log directories: ${err.message}`);
    }
};

// ✅ Ensure logs exist synchronously before proceeding
fs.existsSync(LOGS_FOLDER_LIMITER) || fs.mkdirSync(LOGS_FOLDER_LIMITER, { recursive: true });
fs.existsSync(LOGS_FOLDER_ACCESS) || fs.mkdirSync(LOGS_FOLDER_ACCESS, { recursive: true });

// ✅ Create log rotators AFTER directories exist
const createLogStream = (folder, filename) =>
    FileStreamRotator.getStream({
        date_format: 'YYYY-MM-DD',
        filename: path.join(folder, `${filename}-%DATE%.log`),
        frequency: 'daily',
        verbose: false
    });

const apiLimiterRotator = createLogStream(LOGS_FOLDER_LIMITER, 'api-limiter');
const accessLimiterRotator = createLogStream(LOGS_FOLDER_ACCESS, 'access');

// 🔹 Helper function to log rate limit violations
const logRateLimit = async (rotator, req, context) => {
    try {
        const logMessage = `[${currentDateTime()}] IP: ${req.ip} | ${context} | METHOD: ${req.method} | URL: ${req.url} | CLIENT: ${req.headers['user-agent']}\n`;
        rotator.write(logMessage, 'utf8');
    } catch (err) {
        logger.error(`[RATE LIMIT] Error writing to ${context} log:`, err);
    }
};

// 🔹 Generic rate limit handler
const rateLimitHandler = (rotator, message) => async (req, res, _next, options) => {
    await logRateLimit(rotator, req, 'TOO MANY REQUESTS');
    res.status(options.statusCode).json({
        success: false,
        message: 'TOO MANY REQUEST',
        time: currentDateTime(),
        result: {
            title: "TOO MANY REQUEST",
            error: message
        }
    });
};

// 🔹 Global API rate limiter
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: { message: 'Too many requests from this IP, please try again after 60 seconds' },
    handler: rateLimitHandler(apiLimiterRotator, 'Too many requests from this IP, please try again after 60 seconds'),
    standardHeaders: true,
    legacyHeaders: false
});

// 🔹 Login-specific rate limiter
const apiLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 seconds
    max: 3,
    message: { message: 'Too many login attempts from this IP, please try again after 30 seconds' },
    handler: rateLimitHandler(accessLimiterRotator, 'Too many login attempts from this IP, please try again after 30 seconds'),
    standardHeaders: true,
    legacyHeaders: false
});

export { limiter, apiLimiter };
