import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logger = winston.createLogger({
    level: process.env.APP_LOG_LEVEL || 'info',
    format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
        printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
    transports: [new winston.transports.Console()]
});

export default logger;