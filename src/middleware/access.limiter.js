import rateLimit from 'express-rate-limit';
import currentDateTime from '../lib/current.date.time.js';

// Improved IP extraction function
const getClientIP = (req) => {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // Get the first IP if there are multiple
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        return ips[0];
    }
    return req.ip || req.socket.remoteAddress;
};

// Generic rate limit handler with robust IP detection
const rateLimitHandler = (message) => (req, res, _next, options) => {
    console.log(`[RATE LIMIT HIT] IP: ${req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress} | Hits: ${req.rateLimit.current}/${req.rateLimit.limit}`);

    res.status(options.statusCode).json({
        success: false,
        message: 'TOO MANY REQUEST',
        time: currentDateTime(),
        result: {
            title: "TOO MANY REQUEST",
            error: message,
            currentCount: req.rateLimit.current,
            limit: req.rateLimit.limit,
            remainingTime: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000) + ' seconds'
        }
    });
};

// Global API rate limiter
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Setting to 10 as per your request
    standardHeaders: 'draft-7', // Use the latest RFC standard
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again after 60 seconds' },
    handler: rateLimitHandler('Too many requests from this IP, please try again after 60 seconds'),
    keyGenerator: getClientIP, 
    skip: (req, res) => false, 
    requestWasSuccessful: (req, res) => res.statusCode < 400,
    headers: true,
    enableDraftSpec: true,
    trustProxy: true,
});

// Login-specific rate limiter
const apiLimiter = rateLimit({
    windowMs: 30 * 1000, // 30 seconds
    max: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many login attempts from this IP, please try again after 30 seconds' },
    handler: rateLimitHandler('Too many login attempts from this IP, please try again after 30 seconds'),
    keyGenerator: getClientIP,
    skip: (req, res) => false,
    headers: true,
    enableDraftSpec: true,
    trustProxy: true,
});

export { limiter, apiLimiter };