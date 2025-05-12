# HTML Render Service Observability

This document describes how to use the observability features in the HTML Render Service, including logging, metrics, and tracing with OpenTelemetry and Elastic APM.

## Overview

The HTML Render Service includes comprehensive instrumentation using Elastic's OpenTelemetry SDK, providing:

- **Distributed Tracing**: Track requests through the system
- **Metrics**: Measure performance and system health
- **Logging**: Enhanced structured logging for debugging

This implementation uses the official `@elastic/opentelemetry-node` package for seamless integration with Elastic Cloud APM.

## Configuration

Telemetry can be configured using environment variables in a `.env` file at the project root:

```bash
# OpenTelemetry using @elastic/opentelemetry-node
OTEL_EXPORTER_OTLP_ENDPOINT="...your-OTLP/collector-endpoint..."
OTEL_EXPORTER_OTLP_HEADERS="Authorization=..."
OTEL_SERVICE_NAME="node-html2img-render-server"
```

To set up your environment variables:

1. Copy the `.env.example` file to `.env`
2. Edit the `.env` file with your specific configuration

Available configuration variables:

| Variable                      | Description                                | Default                       |
| ----------------------------- | ------------------------------------------ | ----------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint           | (requires configuration)      |
| `OTEL_EXPORTER_OTLP_HEADERS`  | Headers for authentication (e.g., API key) | (requires configuration)      |
| `OTEL_SERVICE_NAME`           | Service name for telemetry reporting       | `node-html2img-render-server` |
| `NODE_ENV`                    | Environment (production, dev)              | `development`                 |

## Setting Up with Elastic Cloud

### Using Elastic Cloud APM

Setting up with Elastic Cloud is now simplified:

1. **Obtain your APM server details from Elastic Cloud console**:

   - OTLP endpoint URL
   - API key for authorization

2. **Configure the HTML Render Service**:

   ```bash
   # Add to your .env file
   OTEL_SERVICE_NAME=node-html2img-render-server
   OTEL_EXPORTER_OTLP_ENDPOINT=https://your-deployment-id.apm.region.aws.elastic.cloud:443
   OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey your_api_key_here"

   # Start the server (automatically loads OpenTelemetry via -r @elastic/opentelemetry-node)
   yarn start
   ```

### Finding Your Elastic Cloud APM Details

1. **Find your OTLP Endpoint URL**:

   - Log in to your Elastic Cloud console
   - Navigate to your deployment
   - Click on "APM & Fleet" in the sidebar
   - Find the "OTLP Endpoint" in the APM Agents tab
   - Example: `https://your-deployment-id.apm.region.aws.elastic.cloud:443`

2. **Create an API Key**:
   - In the Elastic Cloud console, go to Management → API Keys
   - Create a new API key with "apm_write" role
   - Copy the API key (it's only shown once)
   - Format for the headers: `"Authorization=ApiKey your_api_key_here"`

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

## Visualizing Data in Kibana

1. Open Kibana and navigate to the APM section
2. Select the `node-html2img-render-server` service in the services list
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

1. Verify the OTEL_EXPORTER_OTLP_ENDPOINT is accessible
2. Check that your endpoint and API key in OTEL_EXPORTER_OTLP_HEADERS are correct
3. Examine server logs for telemetry initialization messages
4. Verify APM server is correctly receiving data

### Common Issues

#### Authentication Errors (401 Unauthorized)

If you see authentication errors:

1. **Verify API Key Format**: Ensure the format is `"Authorization=ApiKey your_api_key_here"` in OTEL_EXPORTER_OTLP_HEADERS
2. **Check API Key Validity**: Double-check your API key from the Elastic Cloud console
3. **Ensure Proper Permissions**: Make sure the API key has the right APM permissions
4. **Create New Key**: Try generating a new API key if problems persist

#### Connection Errors

If you see connection errors:

1. **Check URL Format**: Ensure you're using the correct OTLP endpoint URL with port number
2. **Firewall Issues**: Verify that port 443 is open for HTTPS traffic
3. **Network Access**: Ensure your server has internet access to Elastic Cloud

## Implementation Details

This service uses the `@elastic/opentelemetry-node` package which provides automatic instrumentation for:

- HTTP requests and responses
- Express middleware and routes
- Playwright browser interactions
- Async operations and timers
- Error tracking and exceptions

The OpenTelemetry is loaded at startup through the `-r @elastic/opentelemetry-node` flag in the `yarn start` command, which automatically instruments the application without requiring manual code changes.

The configuration is based on standard OpenTelemetry environment variables:

- `OTEL_SERVICE_NAME`: Identifies your service in Elastic APM
- `OTEL_EXPORTER_OTLP_ENDPOINT`: The endpoint where telemetry data is sent
- `OTEL_EXPORTER_OTLP_HEADERS`: Contains authentication information for the endpoint
- `OTEL_SDK_DISABLED`: Set to 'true' to explicitly disable OpenTelemetry

### Error Handling

The service includes robust error handling for telemetry issues:

1. **Startup Validation**

   - Required environment variables are checked at server startup
   - Invalid configuration is detected and clearly reported
   - The service logs detailed error messages about any configuration issues

2. **Runtime Fallback**

   - If telemetry encounters errors during rendering, the service will retry without telemetry
   - Rendering operations continue to work even if telemetry fails
   - Headers indicate telemetry status with `X-Telemetry-Status: failed` when fallback occurs

3. **Troubleshooting**
   - Detailed error messages for telemetry configuration issues are logged to the console
   - The file `src/utils/telemetry-validator.js` contains validation logic that's run at startup
   - Test coverage ensures validation works properly

## Custom Instrumentation

The service now includes a comprehensive custom instrumentation framework that enhances the automatic instrumentation provided by `@elastic/opentelemetry-node`. This framework provides consistent tracing across all service components with minimal code changes.

### Instrumentation Utilities

The custom instrumentation framework is implemented in `src/utils/telemetry.js` and provides several useful utilities:

#### 1. Traced Functions

```javascript
const { createTracedFunction } = require('../utils/telemetry');

// Original function
async function processData(data) {
  // Implementation
}

// Traced version
const tracedProcessData = createTracedFunction('data.process', processData, {
  component: 'processor',
  attributes: {
    'data.type': data => data.type,
    'data.size': data => data.size
  }
});

// Usage: same as original function
await tracedProcessData(someData);
```

#### 2. Express Middleware Instrumentation

```javascript
const { createTracedMiddleware } = require('../utils/telemetry');

// Original middleware
function validatePayload(req, res, next) {
  // Implementation
}

// Traced version
const tracedMiddleware = createTracedMiddleware('validate_payload', validatePayload, {
  attributesFn: req => ({
    'validation.content_length': parseInt(req.headers['content-length'] || '0', 10)
  })
});

// Usage: same as original middleware
app.use(tracedMiddleware);
```

#### 3. Instrumented Express Routers

```javascript
const { createInstrumentedRouter } = require('../utils/telemetry');

// Create an instrumented router
const router = createInstrumentedRouter('render');

// Use it like a normal Express router
router.post('/', authenticateApiKey, async (req, res) => {
  // All middleware and route handlers are automatically instrumented
});
```

#### 4. Custom Metrics

```javascript
const { recordRenderMetrics } = require('../utils/telemetry');

// Record metrics about a rendering operation
recordRenderMetrics({
  format: 'png',
  durationMs: 150,
  sizeBytes: 65536
});
```

### Key Instrumented Components

The service uses these utilities to provide detailed tracing for:

1. **Express Middleware**:

   - Authentication
   - Validation
   - Rate limiting
   - Error handling

2. **API Routes**:

   - Render endpoint
   - Metadata extraction

3. **Core Services**:
   - HTML rendering
   - Screenshot capture
   - Asset management
   - Font handling

### Span Hierarchy

The instrumentation creates a detailed span hierarchy:

- `api.render` (API request)
  - `middleware.authenticate_api_key`
  - `middleware.validate_payload`
  - `renderer.render_html`
    - `renderer.get_browser`
    - `renderer.create_context`
    - `renderer.create_page`
    - `renderer.set_content`
    - `assets.add_to_page`
      - `assets.setup_interceptor`
      - `assets.add_fonts`
    - `renderer.wait_for_selector`
    - `renderer.take_screenshot`
    - `renderer.create_metadata`
    - `renderer.embed_metadata`

### Span Attributes

Each span includes detailed attributes relevant to its operation:

- HTTP context: `http.method`, `http.url`, `http.status_code`
- Request details: `request.ip`, `request.user_agent`, `request.response_format`
- Content info: `html.size_bytes`, `css.size_bytes`, `js.size_bytes`
- Rendering details: `viewport.width`, `viewport.height`, `format`
- Performance: `render.duration_ms`, `render.size_bytes`
- Errors: `error.message`, `error.type`, `error.category`

### Custom Metrics

The service tracks several custom metrics:

1. **Counters**:

   - `html_render_count`: Number of rendering operations by format and status

2. **Histograms**:
   - `html_render_duration_ms`: Distribution of rendering times
   - `screenshot_size_bytes`: Distribution of screenshot sizes

## Extending Telemetry

You can access the OpenTelemetry API directly for more advanced use cases:

```javascript
const { trace } = require('@opentelemetry/api');
const { getTracer } = require('../utils/telemetry');

// Get a tracer for your component
const tracer = getTracer('my-component');

// Create a custom span for a specific operation
await tracer.startActiveSpan('custom.operation', async span => {
  try {
    // Add attributes
    span.setAttribute('custom.attribute', 'value');

    // Record events
    span.addEvent('operation.started', { timestamp: Date.now() });

    // Your operation code here

    // Set success status
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    // Record errors
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
```

### Best Practices

When adding custom instrumentation:

1. **Use existing utilities** when possible instead of direct API access
2. **Follow naming conventions**:
   - Use `component.operation` format for span names
   - Use dot notation for attribute names
3. **Always end spans** in finally blocks
4. **Record all errors** with `recordException`
5. **Set appropriate status** for all spans
6. **Add meaningful attributes** that provide context
