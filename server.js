const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import middleware
const { errorHandler, notFound, timeout, logger } = require('./src/middleware/error');
const { rateLimit } = require('./src/middleware/security');

// Import telemetry service
const { initTelemetry } = require('./src/services/telemetry');

// Initialize telemetry with Elasticsearch support
// Determine if we should enable telemetry - disabled in tests and when ENABLE_TELEMETRY is 'false'
const telemetryEnabled = (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) &&
                         process.env.ENABLE_TELEMETRY !== 'false';

if (telemetryEnabled) {
  // Configure telemetry with environment variables
  initTelemetry({
    serviceName: process.env.OTEL_SERVICE_NAME || 'html-render-service',
    serviceVersion: process.env.npm_package_version || '1.0.1',
    environment: process.env.NODE_ENV || 'development',
    otlpEndpoint: process.env.OTLP_ENDPOINT || 'http://localhost:4318',
    samplingRatio: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0')
  });
  logger.info('Telemetry initialized with Elasticsearch support');
} else if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  // Test mode detected, keeping telemetry disabled
  if (process.env.NODE_ENV === 'development') {
    logger.info('Telemetry disabled in test environment');
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
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

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

  // Close any resources here if needed
  if (telemetryEnabled) {
    const { shutdownTelemetry } = require('./src/services/telemetry');
    try {
      await shutdownTelemetry();
      logger.info('Telemetry shutdown completed');
    } catch (error) {
      logger.error('Error shutting down telemetry:', error);
    }
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Close any resources here if needed
  if (telemetryEnabled) {
    const { shutdownTelemetry } = require('./src/services/telemetry');
    try {
      await shutdownTelemetry();
      logger.info('Telemetry shutdown completed');
    } catch (error) {
      logger.error('Error shutting down telemetry:', error);
    }
  }

  process.exit(0);
});

module.exports = app;