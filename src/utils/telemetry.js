/**
 * OpenTelemetry instrumentation utilities
 * This module provides access to OpenTelemetry tracers, meters, and utilities
 * for custom instrumentation throughout the application.
 */

const { trace, metrics, SpanStatusCode } = require('@opentelemetry/api');

// Cached tracer instances
const tracers = {};

/**
 * Get a tracer instance for the specified component
 * @param {string} component - Component name (e.g., 'renderer', 'server', 'assets')
 * @returns {Tracer} OpenTelemetry tracer instance
 */
function getTracer(component = 'default') {
  if (!tracers[component]) {
    const fullName = component === 'default' 
      ? 'node-html2img-render-server' 
      : `node-html2img-render-server.${component}`;
    
    tracers[component] = trace.getTracer(fullName);
  }
  return tracers[component];
}

// Cached meter instances
const meters = {};

/**
 * Get a meter instance for the specified component
 * @param {string} component - Component name (e.g., 'renderer', 'server', 'assets')
 * @returns {Meter} OpenTelemetry meter instance
 */
function getMeter(component = 'default') {
  if (!meters[component]) {
    const fullName = component === 'default' 
      ? 'node-html2img-render-server' 
      : `node-html2img-render-server.${component}`;
    
    meters[component] = metrics.getMeter(fullName);
  }
  return meters[component];
}

/**
 * Create and initialize counters for the renderer component
 */
function createRendererMetrics() {
  const meter = getMeter('renderer');
  
  // Initialize counters
  const renderCounter = meter.createCounter('html_render_count', {
    description: 'Count of HTML rendering operations'
  });
  
  // Initialize histograms
  const renderDurationHistogram = meter.createHistogram('html_render_duration_ms', {
    description: 'Duration of HTML rendering operations in milliseconds',
    unit: 'ms'
  });
  
  const screenshotSizeHistogram = meter.createHistogram('screenshot_size_bytes', {
    description: 'Size of generated screenshots in bytes',
    unit: 'By'
  });
  
  return {
    renderCounter,
    renderDurationHistogram,
    screenshotSizeHistogram
  };
}

// Export metrics objects
const rendererMetrics = createRendererMetrics();

/**
 * Record rendering metrics
 * @param {Object} data - Metrics data
 * @param {string} data.format - Image format (png, jpeg)
 * @param {number} data.durationMs - Rendering duration in milliseconds
 * @param {number} data.sizeBytes - Size of the screenshot in bytes
 */
function recordRenderMetrics(data) {
  const { format, durationMs, sizeBytes, error = false } = data;
  
  // Record render count by format and status
  rendererMetrics.renderCounter.add(1, { 
    format, 
    status: error ? 'error' : 'success' 
  });
  
  // Only record duration and size for successful renders
  if (!error) {
    // Record render duration
    rendererMetrics.renderDurationHistogram.record(durationMs, { format });
    
    // Record screenshot size
    rendererMetrics.screenshotSizeHistogram.record(sizeBytes, { format });
  }
}

/**
 * Wrapper for creating traced functions
 * @param {string} name - Span name
 * @param {Function} fn - Function to trace
 * @param {Object} options - Options including component and attributes
 * @returns {Function} Traced function wrapper
 */
function createTracedFunction(name, fn, { component = 'default', attributes = {} } = {}) {
  const tracer = getTracer(component);
  
  return async function tracedFn(...args) {
    return tracer.startActiveSpan(name, async (span) => {
      try {
        // Add default attributes
        Object.entries(attributes).forEach(([key, value]) => {
          if (typeof value === 'function') {
            span.setAttribute(key, value(...args));
          } else {
            span.setAttribute(key, value);
          }
        });

        // Execute the function
        const result = await fn.apply(this, args);
        
        // Mark span as successful
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // Record error details in the span
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        // Always end the span
        span.end();
      }
    });
  };
}

/**
 * Creates an instrumented Express middleware
 * @param {string} name - Name for the middleware span
 * @param {Function} middleware - Express middleware function (req, res, next)
 * @param {Object} options - Options including component and attributes
 * @returns {Function} - Instrumented middleware function
 */
function createTracedMiddleware(name, middleware, { component = 'middleware', attributesFn = null } = {}) {
  const tracer = getTracer(component);

  return function tracedMiddleware(req, res, next) {
    return tracer.startActiveSpan(`middleware.${name}`, async (span) => {
      // Add request attributes - safely handle possibly undefined properties for testing
      span.setAttribute('http.method', req.method || 'UNKNOWN');
      span.setAttribute('http.url', (req.originalUrl || req.url || ''));
      span.setAttribute('http.path', req.path || '');
      span.setAttribute('http.client_ip', req.ip || '');
      span.setAttribute('request.id', (req.headers && req.headers['x-request-id']) || '');

      // Add custom attributes if provided
      if (attributesFn && typeof attributesFn === 'function') {
        try {
          const customAttrs = attributesFn(req);
          if (customAttrs && typeof customAttrs === 'object') {
            Object.entries(customAttrs).forEach(([key, value]) => {
              span.setAttribute(key, value);
            });
          }
        } catch (error) {
          // Safely handle any errors in custom attribute functions
          span.setAttribute('attribute_error', error.message);
        }
      }

      // Create a function to capture response details
      const originalEnd = res.end;
      let responseEnded = false;

      // Patch res.end to capture response data
      res.end = function(...args) {
        if (!responseEnded) {
          responseEnded = true;
          span.setAttribute('http.status_code', res.statusCode);
          span.setStatus({
            code: res.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK
          });
          span.end();
        }
        return originalEnd.apply(this, args);
      };

      // Set up next function to handle errors
      const nextWithTracing = (err) => {
        if (err) {
          span.recordException(err);
          span.setAttribute('error.message', err.message);
          span.setAttribute('error.type', err.name || 'Error');
          span.setAttribute('error.stack', err.stack || '');
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message
          });

          // Only end the span for errors, as success is captured in res.end
          span.end();
        }
        next(err);
      };

      try {
        // Call the original middleware
        const result = middleware(req, res, nextWithTracing);

        // Handle promise returns from middleware
        if (result && typeof result.catch === 'function') {
          return result.catch(err => {
            if (!responseEnded) {
              span.recordException(err);
              span.setAttribute('error.message', err.message);
              span.setAttribute('error.type', err.name || 'Error');
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message
              });
              span.end();
              responseEnded = true;
            }
            throw err;
          });
        }

        return result;
      } catch (err) {
        if (!responseEnded) {
          span.recordException(err);
          span.setAttribute('error.message', err.message);
          span.setAttribute('error.type', err.name || 'Error');
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message
          });
          span.end();
          responseEnded = true;
        }
        throw err;
      }
    });
  };
}

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
    router[method] = function(...args) {
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
        return createTracedMiddleware(spanName, middleware, {
          component: 'router',
          attributesFn: (req) => ({
            'router.module': moduleName,
            'router.method': method,
            'router.path': path,
            'router.handler': handlerName
          })
        });
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

module.exports = {
  getTracer,
  getMeter,
  SpanStatusCode,
  createTracedFunction,
  createTracedMiddleware,
  createInstrumentedRouter,
  recordRenderMetrics
};