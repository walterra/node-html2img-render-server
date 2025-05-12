// Load environment variables from .env file
require('dotenv').config();

// Now import other modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import middleware
const errorMiddleware = require('./src/middleware/error');
const securityMiddleware = require('./src/middleware/security');
const { validateOtelConfig } = require('./src/instrumentation'); // Updated import

// Get instrumented versions of middlewares
const { errorHandler, notFound, timeout, logger } = errorMiddleware.default;
const { rateLimit } = securityMiddleware.default;

// Validate OpenTelemetry configuration
const otelValidation = validateOtelConfig();

// Handle telemetry status
if (otelValidation.telemetryEnabled) {
  if (otelValidation.isValid) {
    logger.info('OpenTelemetry is enabled and properly configured');
    console.log('\x1b[32m%s\x1b[0m', 'OpenTelemetry is enabled and properly configured');

    if (otelValidation.hasWarnings) {
      logger.warn('OpenTelemetry configuration warnings:', {
        warnings: otelValidation.messages
      });
      console.warn('\x1b[33m%s\x1b[0m', 'OpenTelemetry Configuration Warnings:');
      otelValidation.messages.forEach(msg => console.warn('\x1b[33m- %s\x1b[0m', msg));
    }
  } else {
    // This case handles valid configuration with errors
    logger.error('OpenTelemetry configuration error:', {
      errors: otelValidation.messages
    });
    console.error('\x1b[31m%s\x1b[0m', 'OpenTelemetry Configuration Error:');
    otelValidation.messages.forEach(msg => console.error('\x1b[31m- %s\x1b[0m', msg));
    console.error(
      '\x1b[31m%s\x1b[0m',
      'Check your .env file or environment variables. Telemetry will be disabled.'
    );
  }
} else {
  // Telemetry is disabled - log as info, not error
  logger.info('OpenTelemetry is disabled:', {
    message:
      otelValidation.messages.length > 0 ? otelValidation.messages[0] : 'No configuration provided'
  });
  console.info('\x1b[36m%s\x1b[0m', 'OpenTelemetry is disabled:');
  if (otelValidation.messages.length > 0) {
    console.info('\x1b[36m- %s\x1b[0m', otelValidation.messages[0]);
  } else {
    console.info('\x1b[36m- %s\x1b[0m', 'No configuration provided');
  }
}

// Initialize Express app
const app = express();

// Set up security middleware
app.use(helmet());
app.use(cors());

// Use configurable timeout and rate limit from environment variables or defaults
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);

app.use(timeout(requestTimeout));
app.use(rateLimit(rateLimitMax, rateLimitWindowMs));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Add custom middleware to handle JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // JSON parsing error
    return res.status(400).json({
      error: {
        message: 'Invalid JSON: ' + err.message,
        status: 400
      }
    });
  }
  next(err); // Pass to other error handlers
});

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  })
);

// Import routes
const renderRoutes = require('./src/routes/render');

// Register routes
app.use('/render', renderRoutes);

// Handle 404 errors
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Don't start the server if this file is being required by another module (e.g., tests)
if (require.main === module) {
  // Start server only when this file is run directly
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`Server running on port ${PORT}`);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Graceful shutdown without explicit exit
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Graceful shutdown without explicit exit
});

module.exports = app;
