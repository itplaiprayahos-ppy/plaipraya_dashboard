const path = require('path');
const fs = require('fs');
const { createLogger, format, transports } = require('winston');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const { combine, timestamp, printf } = format;

const logFormat = printf(({ level, message, timestamp }) => `[${timestamp}] ${level.toUpperCase()} ${message}`);

const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const logTransports = [
    new transports.Console(),
    new transports.File({ filename: path.join(logDir, 'app.log'), maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
];

const logger = createLogger({
    level: 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: logTransports,
});

module.exports = logger;
