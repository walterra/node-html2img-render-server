const winston = require('winston');
const { withTracedMiddleware } = require('../instrumentation/wrappers');
const { wrapMiddlewareWithErrorFormat } = require('../instrumentation/router');

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    ip: req.ip,
    details: err.details || {}
  });

  // Send error response
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
    }
  });
}

/**
 * Not found middleware
 */
function notFound(req, res, next) {
  const err = new ApiError(`Not found: ${req.originalUrl}`, 404);
  next(err);
}

/**
 * Request timeout middleware
 */
function timeout(timeout = 30000) {
  return (req, res, next) => {
    const timeoutId = setTimeout(() => {
      const err = new ApiError('Request timeout', 408);
      next(err);
    }, timeout);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
}

// Create instrumented versions of all middlewares
const instrumentedErrorHandler = withTracedMiddleware({
  name: 'error_handler',
  attributesFn: req => ({
    'error.path': req.path,
    'error.method': req.method
  })
})(errorHandler);

const instrumentedNotFound = wrapMiddlewareWithErrorFormat(
  withTracedMiddleware({
    name: 'not_found',
    attributesFn: req => ({
      'not_found.url': req.originalUrl
    })
  })(notFound)
);

// Instrumented timeout middleware
function instrumentedTimeout(timeoutMs = 30000) {
  // Get the original middleware
  const timeoutMiddleware = timeout(timeoutMs);

  // Return instrumented version with error formatting
  return wrapMiddlewareWithErrorFormat(
    withTracedMiddleware({
      name: 'timeout',
      attributesFn: req => ({
        'timeout.duration_ms': timeoutMs
      })
    })(timeoutMiddleware)
  );
}

module.exports = {
  ApiError,
  errorHandler,
  notFound,
  timeout,
  logger,

  // By default export instrumented versions
  default: {
    errorHandler: instrumentedErrorHandler,
    notFound: instrumentedNotFound,
    timeout: instrumentedTimeout,
    ApiError,
    logger
  }
};
