import fs from 'fs';
import path from 'path';
import appRoot from 'app-root-path';
import FileStreamRotator from 'file-stream-rotator';
import morgan from 'morgan';

function morganLogger() {
    const LOGS_FOLDER = `${appRoot}/logs/access`;

    // If the logs folder doesn't exist, create it
    if (!fs.existsSync(`${appRoot}/logs`)) {
        fs.mkdirSync(`${appRoot}/logs`);
    }

    // If the access folder doesn't exist, create it
    if (!fs.existsSync(LOGS_FOLDER)) {
        fs.mkdirSync(LOGS_FOLDER);
    }

    // Create a rotating write stream
    const accessLogStream = FileStreamRotator.getStream({
        date_format: 'YYYY-MM-DD',
        filename: path.join(LOGS_FOLDER, 'access-%DATE%.log'),
        frequency: 'daily',
        verbose: false
    });

    return morgan('combined', { stream: accessLogStream });
}

export default morganLogger;
