import { createServer } from 'http';
import { setupWebSocket } from './src/socket/socket.js';
import app from './src/app/index.js';
import logger from './src/middleware/winston.logger.js';
import connectDatabase from './src/database/connect.mongo.db.js';

const port = process.env.APP_PORT || 3027; // Default fallback if APP_PORT is not defined

const httpServer = createServer(app);

// Set up WebSocket
setupWebSocket(httpServer);

// Application database connection establishment
connectDatabase().then(() => {
    httpServer.listen(port, () => {
      	logger.info(`App server running on: ${process.env.APP_BASE_URL || `http://localhost:${port}`}`);
    });
}).catch(error => {
  	console.log('Invalid databse connection...!');
})
