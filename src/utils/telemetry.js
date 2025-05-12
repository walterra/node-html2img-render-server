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

module.exports = {
  getTracer,
  getMeter,
  SpanStatusCode,
  createTracedFunction,
  recordRenderMetrics
};