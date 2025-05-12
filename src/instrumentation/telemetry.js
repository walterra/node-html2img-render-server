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
    const fullName =
      component === 'default'
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
    const fullName =
      component === 'default'
        ? 'node-html2img-render-server'
        : `node-html2img-render-server.${component}`;

    meters[component] = metrics.getMeter(fullName);
  }
  return meters[component];
}

module.exports = {
  getTracer,
  getMeter,
  SpanStatusCode
};
