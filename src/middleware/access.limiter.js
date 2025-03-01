import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
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

// ✅ Create log rotators with higher highWaterMark for buffering
const createLogStream = (folder, filename) =>
    FileStreamRotator.getStream({
        date_format: 'YYYY-MM-DD',
        filename: path.join(folder, `${filename}-%DATE%.log`),
        frequency: 'daily',
        verbose: false,
        size: '10M', // Add size-based rotation
        max_logs: '30d', // Keep logs for 30 days
        audit_file: path.join(folder, `${filename}-audit.json`), // Track rotations
        options: { 
            flags: 'a', 
            highWaterMark: 64 * 1024 // Increase buffer size to 64KB
        }
    });

// Create a buffered logging system to batch writes
class BufferedLogger {
    constructor(rotator, flushInterval = 5000, maxBuffer = 1000) {
        this.rotator = rotator;
        this.buffer = [];
        this.flushInterval = flushInterval;
        this.maxBuffer = maxBuffer;
        this.flushTimer = setInterval(() => this.flush(), flushInterval);
    }

    log(message) {
        this.buffer.push(message);
        
        // Flush immediately if buffer is getting too large
        if (this.buffer.length >= this.maxBuffer) {
            this.flush();
        }
    }

    flush() {
        if (this.buffer.length === 0) return;
        
        const logString = this.buffer.join('');
        this.buffer = [];
        
        try {
            this.rotator.write(logString, 'utf8');
        } catch (err) {
            logger.error(`[RATE LIMIT] Error writing to log during flush:`, err);
        }
    }

    destroy() {
        clearInterval(this.flushTimer);
        this.flush(); // Final flush
    }
}

// Initialize buffered loggers
const apiLimiterRotator = createLogStream(LOGS_FOLDER_LIMITER, 'api-limiter');
const accessLimiterRotator = createLogStream(LOGS_FOLDER_ACCESS, 'access');

const apiLimiterLogger = new BufferedLogger(apiLimiterRotator);
const accessLimiterLogger = new BufferedLogger(accessLimiterRotator);

// Graceful shutdown handler
process.on('SIGINT', () => {
    apiLimiterLogger.destroy();
    accessLimiterLogger.destroy();
    process.exit(0);
});

// 🔹 Helper function to log rate limit violations (now buffered)
const logRateLimit = (bufferedLogger, req, context) => {
    try {
        const logMessage = `[${currentDateTime()}] IP: ${req.ip} | ${context} | METHOD: ${req.method} | URL: ${req.url} | CLIENT: ${req.headers['user-agent']}\n`;
        bufferedLogger.log(logMessage);
    } catch (err) {
        logger.error(`[RATE LIMIT] Error queuing to ${context} log:`, err);
    }
};

// 🔹 Generic rate limit handler
const rateLimitHandler = (bufferedLogger, message) => (req, res, _next, options) => {
    logRateLimit(bufferedLogger, req, 'TOO MANY REQUESTS');
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

// 🔹 Global API rate limiter with sampling for high-traffic scenarios
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000,
    message: { message: 'Too many requests from this IP, please try again after 60 seconds' },
    handler: rateLimitHandler(apiLimiterLogger, 'Too many requests from this IP, please try again after 60 seconds'),
    standardHeaders: true,
    legacyHeaders: false,
    // Optional: Sample logging (log only a percentage of rate limit hits)
    skipSuccessfulRequests: true, // Don't log successful requests
    keyGenerator: (req) => {
        return req.ip; // Use IP as the limiter key
    }
});

// 🔹 Login-specific rate limiter
const apiLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 seconds
    max: 3,
    message: { message: 'Too many login attempts from this IP, please try again after 30 seconds' },
    handler: rateLimitHandler(accessLimiterLogger, 'Too many login attempts from this IP, please try again after 30 seconds'),
    standardHeaders: true,
    legacyHeaders: false
});

export { limiter, apiLimiter, ensureLogDirs }; // Export ensureLogDirs for potential preloading