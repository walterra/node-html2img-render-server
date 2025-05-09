# HTML Render Service Observability

This document describes how to use the observability features in the HTML Render Service, including logging, metrics, and tracing with OpenTelemetry and Elasticsearch.

## Overview

The HTML Render Service includes comprehensive instrumentation using OpenTelemetry, providing:

- **Distributed Tracing**: Track requests through the system
- **Metrics**: Measure performance and system health
- **Logging**: Enhanced structured logging for debugging

The implementation is platform-agnostic but includes specific support for Elasticsearch observability.

## Configuration

Telemetry can be configured using environment variables:

| Variable                  | Description                           | Default                       |
| ------------------------- | ------------------------------------- | ----------------------------- |
| `ENABLE_TELEMETRY`        | Enable/disable telemetry              | `true`                        |
| `OTEL_SERVICE_NAME`       | Service name                          | `node-html2img-render-server` |
| `NODE_ENV`                | Environment (production, development) | `development`                 |
| `OTLP_ENDPOINT`           | OTLP endpoint URL                     | `http://localhost:4318`       |
| `OTEL_TRACES_SAMPLER_ARG` | Sampling ratio (0.0-1.0)              | `1.0`                         |

## Setting Up with Elasticsearch

### Using Elasticsearch APM Server

1. **Install Elasticsearch and APM Server**:

   - Follow the [official Elastic documentation](https://www.elastic.co/guide/en/apm/guide/current/apm-quick-start.html)
   - Configure APM server to accept OTLP data

2. **Configure the HTML Render Service**:

   ```bash
   # Set environment variables
   export OTLP_ENDPOINT=http://your-apm-server:8200
   export OTEL_SERVICE_NAME=html-render-service
   export NODE_ENV=production

   # Start the server
   npm start
   ```

### Using Elastic Cloud

If you're using Elastic Cloud:

1. Obtain your APM server endpoint and API key
2. Configure environment variables:
   ```bash
   export OTLP_ENDPOINT=https://your-apm-server-url
   export OTEL_API_KEY=your-api-key
   ```

## What's Being Tracked

The telemetry implementation captures:

### Render Process Metrics

- Request duration
- Rendering time
- Image size
- Viewport dimensions
- HTML/CSS/JS size
- Browser interactions

### API Routes

- Request path
- Client information
- Request parameters
- Response size
- Error rates

### Error Tracking

- Detailed error information with stack traces
- Error classification
- Exception context

## Visualizing Data

In Elasticsearch/Kibana:

1. Open Kibana and navigate to APM
2. Select the `html-render-service` in the services list
3. Explore:
   - Service map
   - Transactions
   - Errors
   - Metrics

## Custom Dashboards

Create custom dashboards to monitor:

- Rendering performance by viewport size
- Error rates by request type
- Resource usage patterns
- Client usage patterns

## Troubleshooting

If telemetry data isn't appearing:

1. Verify the OTLP endpoint is accessible
2. Check that `ENABLE_TELEMETRY` is not set to `false`
3. Examine server logs for telemetry initialization messages
4. Verify APM server is correctly receiving data

## Extending Telemetry

The telemetry implementation can be extended:

```javascript
const {
  getCurrentSpan,
  createSpan,
  withSpan,
} = require("./src/services/telemetry");

// Add custom attributes to current span
const span = getCurrentSpan();
if (span) {
  span.setAttribute("custom.attribute", "value");
}

// Create a custom span for a specific operation
await withSpan("custom.operation", async () => {
  // Operation code here
});
```
