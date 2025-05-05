const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import middleware
const { errorHandler, notFound, timeout, logger } = require('./src/middleware/error');
const { rateLimit } = require('./src/middleware/security');

// Initialize Express app
const app = express();

// Set up security middleware
app.use(helmet());
app.use(cors());
app.use(timeout(30000)); // 30 second timeout
app.use(rateLimit(60, 60 * 1000)); // 60 requests per minute
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Serve static files from public directory
app.use('/screenshots', express.static(path.join(__dirname, 'public/screenshots')));

// Import routes
const renderRoutes = require('./src/routes/render');

// Register routes
app.use('/render', renderRoutes);

// Handle 404 errors
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  // Close any resources here if needed
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  // Close any resources here if needed
  process.exit(0);
});

module.exports = app;