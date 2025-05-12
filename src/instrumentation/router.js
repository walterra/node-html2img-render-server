/**
 * Instrumentation utilities for Express routers
 */

const { getTracer } = require('./telemetry');
const { withTracedMiddleware } = require('./wrappers');

/**
 * Creates an instrumented Express router
 * @param {string} moduleName - Name of the router module (e.g., 'render', 'auth')
 * @param {Object} options - Options for the router
 * @returns {Object} - Express router with instrumentation wrappers
 */
function createInstrumentedRouter(moduleName, { express = require('express') } = {}) {
  const router = express.Router();
  const tracer = getTracer('router');

  // Create wrapped versions of the router methods
  const wrappedMethods = ['get', 'post', 'put', 'delete', 'patch', 'all', 'use'];

  // Store original router methods
  const originalMethods = {};

  wrappedMethods.forEach(method => {
    // Save original method
    originalMethods[method] = router[method];

    // Replace with instrumented version
    router[method] = function (...args) {
      // Extract path and middlewares
      const path = typeof args[0] === 'string' ? args[0] : '*';
      const middlewares = typeof args[0] === 'string' ? args.slice(1) : args;

      // Wrap each middleware with instrumentation
      const wrappedMiddlewares = middlewares.map((middleware, index) => {
        // Skip if not a function (compatibility with raw routers)
        if (typeof middleware !== 'function') {
          return middleware;
        }

        // Generate a meaningful name for the span
        const handlerName = middleware.name || `anonymous-${index}`;
        const spanName = `${moduleName}.${method}.${handlerName}`;

        // Create instrumented middleware
        return withTracedMiddleware({
          name: spanName,
          component: 'router',
          attributesFn: req => ({
            'router.module': moduleName,
            'router.method': method,
            'router.path': path,
            'router.handler': handlerName
          })
        })(middleware);
      });

      // Call original method with wrapped middlewares
      if (typeof args[0] === 'string') {
        return originalMethods[method].call(router, path, ...wrappedMiddlewares);
      } else {
        return originalMethods[method].call(router, ...wrappedMiddlewares);
      }
    };
  });

  return router;
}

/**
 * Creates a middleware that wraps requests with consistent error handling
 * @returns {Function} Express middleware
 */
function wrapMiddlewareWithErrorFormat(middleware) {
  return (req, res, next) => {
    // Save the original next function
    const originalNext = next;

    // Replace next with a wrapper that formats errors consistently
    const wrappedNext = err => {
      if (err) {
        // Make sure error response has the expected format
        const statusCode = err.status || 500;

        // Only modify the response if it hasn't been sent yet
        if (!res.headersSent) {
          res.status(statusCode).json({
            error: {
              message: err.message,
              status: statusCode,
              ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {})
            }
          });
          return;
        }
      }
      // Call the original next function
      originalNext(err);
    };

    // Call the middleware with our wrapped next function
    middleware(req, res, wrappedNext);
  };
}

module.exports = {
  createInstrumentedRouter,
  wrapMiddlewareWithErrorFormat
};
