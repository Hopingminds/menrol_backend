import app from './src/app/index.js';
import logger from './src/middleware/winston.logger.js';


const port = process.env.APP_PORT || 3000; // Default fallback if APP_PORT is not defined
app.listen(port, () => {
  logger.info(`App server running on: ${process.env.APP_BASE_URL || `http://localhost:${port}`}`);
});
