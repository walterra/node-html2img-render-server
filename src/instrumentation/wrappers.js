/**
 * Instrumentation wrappers for functions and methods
 * These wrappers provide automatic instrumentation without modifying business logic
 */

const { getTracer, SpanStatusCode } = require('./telemetry');

/**
 * Creates a traced version of a function
 * @param {Object} options - Options for the traced function
 * @param {string} options.name - Span name
 * @param {string} options.component - Component name
 * @param {Object|Function} options.attributes - Static attributes or function that returns attributes
 * @returns {Function} - Function that wraps the provided function with tracing
 */
function withTracing({ name, component = 'default', attributes = {} }) {
  const tracer = getTracer(component);
  
  return function(fn) {
    return async function tracedFn(...args) {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          // Add default attributes
          if (typeof attributes === 'function') {
            const dynamicAttrs = attributes(...args);
            if (dynamicAttrs && typeof dynamicAttrs === 'object') {
              Object.entries(dynamicAttrs).forEach(([key, value]) => {
                span.setAttribute(key, value);
              });
            }
          } else {
            Object.entries(attributes).forEach(([key, value]) => {
              if (typeof value === 'function') {
                span.setAttribute(key, value(...args));
              } else {
                span.setAttribute(key, value);
              }
            });
          }

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
  };
}

/**
 * Creates a traced version of a middleware function
 * @param {Object} options - Options for the traced middleware
 * @param {string} options.name - Middleware name
 * @param {string} options.component - Component name
 * @param {Function} options.attributesFn - Function to extract attributes from request
 * @returns {Function} - Function that wraps middleware with tracing
 */
function withTracedMiddleware({ name, component = 'middleware', attributesFn = null }) {
  const tracer = getTracer(component);
  
  return function(middleware) {
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
  };
}

/**
 * Creates a span manager for working with multiple spans in a function
 * @param {Object} options - Options for the span manager
 * @param {string} options.component - Component name
 * @param {object} options.parentSpan - Optional parent span for all created spans
 * @returns {Object} - Span manager object with methods for working with spans
 */
function createSpanManager({ component = 'default', parentSpan = null } = {}) {
  const tracer = getTracer(component);
  
  return {
    /**
     * Creates a new span as a child of the parent span
     * @param {string} name - Span name
     * @param {Object} attributes - Span attributes
     */
    async withSpan(name, attributes = {}, fn) {
      return tracer.startActiveSpan(name, 
        parentSpan ? { parent: parentSpan } : undefined, 
        async (span) => {
          // Set attributes
          Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
          });
          
          try {
            // Call function with span
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message
            });
            throw error;
          } finally {
            span.end();
          }
        }
      );
    },
    
    /**
     * Adds an event to the parent span if it exists
     * @param {string} name - Event name
     * @param {Object} attributes - Event attributes
     */
    addEvent(name, attributes = {}) {
      if (parentSpan) {
        parentSpan.addEvent(name, attributes);
      }
    },
    
    /**
     * Adds an attribute to the parent span if it exists
     * @param {string} key - Attribute key
     * @param {any} value - Attribute value
     */
    setAttribute(key, value) {
      if (parentSpan) {
        parentSpan.setAttribute(key, value);
      }
    }
  };
}

module.exports = {
  withTracing,
  withTracedMiddleware,
  createSpanManager
};