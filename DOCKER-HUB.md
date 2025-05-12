# node-html2img-render-server

HTML to image rendering service using Playwright's headless browser.

## Overview

A service for converting HTML to images with a REST API. It accepts direct HTML, CSS, and JavaScript input and returns screenshots for visual testing and image generation.

## Features

- Direct HTML/CSS/JS input without requiring public URLs
- Configurable viewport and wait conditions
- Element selection and clipping
- PNG/JPEG format support with quality settings
- Custom font and image injection
- API key authentication and rate limiting
- OpenTelemetry instrumentation
- JSON or binary image response formats

## Quick Start

```bash
# Run with default settings
docker run -p 3000:3000 -e API_KEY=your-api-key walterra/node-html2img-render-server:latest

# Run with OpenTelemetry for observability
docker run -p 3000:3000 \
  -e API_KEY=your-api-key \
  -e OTEL_SERVICE_NAME=html-renderer \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=https://your-apm-endpoint:443 \
  -e OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey your-api-key" \
  walterra/node-html2img-render-server:latest
```

## Usage Example

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "html": "<div style=\"width:100px;height:100px;background-color:blue;\"></div>",
    "viewport": {"width": 500, "height": 400},
    "format": "png"
  }' \
  http://localhost:3000/render > screenshot.png
```

## Environment Variables

### Required

- `API_KEY`: Authentication key for API access

### Optional

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: 60)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in ms (default: 60000)
- `REQUEST_TIMEOUT_MS`: Request timeout in ms (default: 30000)

### OpenTelemetry Settings

- `OTEL_SERVICE_NAME`: Service name for telemetry
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint
- `OTEL_EXPORTER_OTLP_HEADERS`: Headers for endpoint authentication
- `OTEL_SDK_DISABLED`: Set to `true` to disable telemetry

## API Parameters

```json
{
  "html": "<div>Content to render</div>",
  "css": "div { color: blue; }",
  "javascript": "document.querySelector('div').textContent = 'Dynamic content';",
  "viewport": {
    "width": 1280,
    "height": 720,
    "deviceScaleFactor": 1
  },
  "waitForSelector": "#ready-element",
  "clipSelector": "#capture-this",
  "format": "png",
  "quality": 90,
  "responseFormat": "image"
}
```

## Links

- [GitHub Repository](https://github.com/walterra/node-html2img-render-server)
- [Documentation](https://github.com/walterra/node-html2img-render-server#readme)
- [Examples](https://github.com/walterra/node-html2img-render-server/blob/main/EXAMPLES.md)
- [Release Notes](https://github.com/walterra/node-html2img-render-server/tree/main/docs/release-notes)

## Supported Tags

- `latest`: Latest stable release
- `1.1.0`: Version with OpenTelemetry support
- `1.0.1`: Initial stable release
- `1.0.0`: Initial version

## License

MIT
