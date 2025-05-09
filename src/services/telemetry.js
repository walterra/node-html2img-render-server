const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');

let sdk = null;

/**
 * Initialize OpenTelemetry with Elasticsearch exporter
 * @param {Object} options Configuration options for telemetry
 * @returns {NodeSDK} The OpenTelemetry SDK instance
 */
function initTelemetry(options = {}) {
  const {
    serviceName = 'html-render-service',
    serviceVersion = process.env.npm_package_version || '1.0.1',
    environment = process.env.NODE_ENV || 'development',
    // Elasticsearch OTLP endpoint configuration
    otlpEndpoint = process.env.OTLP_ENDPOINT || 'http://localhost:4318',
    // Sampling rate (1.0 = 100% of traces, 0.1 = 10% of traces)
    samplingRatio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0')
  } = options;

  // Create a resource that identifies your service
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment
  });

  // Configure exporters for Elasticsearch
  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`
  });

  const logExporter = new OTLPLogExporter({
    url: `${otlpEndpoint}/v1/logs`
  });

  // Auto-instrument common packages
  const instrumentations = getNodeAutoInstrumentations({
    // Customize instrumentations as needed
    '@opentelemetry/instrumentation-http': { enabled: true },
    '@opentelemetry/instrumentation-express': { enabled: true },
    '@opentelemetry/instrumentation-winston': { enabled: true }
  });

  // Create and configure SDK
  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricExporter,
    logExporter,
    instrumentations,
    // Additional sampling configuration can be added here
    spanLimits: {
      // Maximum number of attributes per span
      attributeCountLimit: 128,
      // Maximum number of events per span
      eventCountLimit: 128,
      // Maximum number of links per span
      linkCountLimit: 128,
      // Maximum number of attributes per event
      eventAttributeCountLimit: 128,
      // Maximum number of attributes per link
      linkAttributeCountLimit: 128,
    }
  });

  // Initialize the SDK
  sdk.start();

  // Handle graceful shutdown
  process.on('SIGTERM', () => shutdownTelemetry());
  process.on('SIGINT', () => shutdownTelemetry());

  return sdk;
}

/**
 * Shutdown telemetry gracefully
 * @returns {Promise<void>}
 */
async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('Telemetry SDK shut down successfully');
    } catch (error) {
      console.error('Error shutting down telemetry SDK:', error);
    } finally {
      sdk = null;
    }
  }
}

/**
 * Get the current active span or create a new one
 * This is useful for adding custom attributes to spans
 * @returns {object|null} The current active span or null
 */
function getCurrentSpan() {
  const { trace } = require('@opentelemetry/api');
  return trace.getSpan(trace.getActiveSpanContext());
}

/**
 * Create a new span
 * @param {string} name Name of the span
 * @param {Object} options Options for the span
 * @returns {object} The created span
 */
function createSpan(name, options = {}) {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('html-render-service');
  return tracer.startSpan(name, options);
}

/**
 * Run a function within a new span
 * @param {string} name Name of the span
 * @param {Function} fn Function to run within the span
 * @param {Object} options Options for the span
 * @returns {any} Result of the function
 */
async function withSpan(name, fn, options = {}) {
  const { trace, context } = require('@opentelemetry/api');
  const tracer = trace.getTracer('html-render-service');
  
  const span = tracer.startSpan(name, options);
  
  try {
    // Run the function within the context of the span
    return await context.with(trace.setSpan(context.active(), span), fn);
  } catch (error) {
    // Record the error on the span
    span.recordException(error);
    span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
    throw error;
  } finally {
    // End the span
    span.end();
  }
}

module.exports = {
  initTelemetry,
  shutdownTelemetry,
  getCurrentSpan,
  createSpan,
  withSpan
};