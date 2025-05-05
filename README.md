# html2img-render-server

A server for converting HTML to images with Playwright - allows direct HTML input and returns screenshots for visual testing.

## Overview

This service solves the common challenge in visual regression testing where different environments produce slightly different renderings (due to anti-aliasing, font rendering differences, etc.). By offloading rendering to a dedicated service with a consistent environment, tests can produce reliable, reproducible results regardless of where the tests themselves run.

## Features

- **Direct HTML Rendering**: Submit raw HTML, CSS, and JavaScript for rendering instead of relying on URL access
- **Consistent Environment**: Ensures identical rendering across all test runs
- **Asset Injection**: Support for fonts, images, and other assets
- **Flexible Screenshot Options**: Configurable viewport, element selection, and waiting conditions
- **Containerized**: Runs in Docker for maximum consistency and portability

## Quick Start

### Running with Docker (Recommended)

```bash
# Pull the image
docker pull yourorg/html2img-render-server

# Run the service
docker run -p 3000:3000 yourorg/html2img-render-server
```

### Basic Usage

```bash
# Render HTML to an image
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>"
  }' \
  --output hello.png
```

See [EXAMPLES.md](EXAMPLES.md) for more detailed usage examples.

## API

### Render Endpoint

`POST /render`

#### Request Body

```json
{
  "html": "<div class='card'>Hello World</div>",
  "css": ".card { border: 1px solid #ccc; padding: 16px; }",
  "javascript": "document.querySelector('.card').addEventListener('click', () => console.log('clicked'));",
  "viewport": {
    "width": 1280,
    "height": 720,
    "deviceScaleFactor": 1
  },
  "waitForSelector": ".card",
  "clipSelector": ".card",
  "assets": {
    "font.woff2": "base64encodedcontent",
    "image.png": "base64encodedcontent"
  },
  "fonts": [
    {
      "name": "CustomFont",
      "data": "base64encodedfontwoff2data",
      "weight": "400",
      "style": "normal"
    }
  ],
  "responseFormat": "image"
}
```

#### Response Formats

##### Default: Direct Image Response (responseFormat = "image")

By default, the service returns the rendered image directly as binary data with Content-Type: `image/png`. Metadata is embedded in the image's EXIF data and also provided via HTTP headers:

- `X-Screenshot-ID`: Unique ID for the screenshot
- `X-Rendering-Time`: Time taken to render in milliseconds
- `X-Browser-Version`: Browser version used for rendering
- `X-Rendered-At`: ISO timestamp when the image was rendered
- `X-Viewport-Width`: Viewport width used
- `X-Viewport-Height`: Viewport height used
- `X-Viewport-DeviceScaleFactor`: Device scale factor used

##### JSON Response (responseFormat = "json")

When `responseFormat` is set to `"json"`, the response is:

```json
{
  "image": "base64encodedimagecontent",
  "contentType": "image/png",
  "metadata": {
    "screenshotId": "550e8400-e29b-41d4-a716-446655440000",
    "renderedAt": "2025-05-02T12:34:56.789Z",
    "viewport": { "width": 1280, "height": 720, "deviceScaleFactor": 1 },
    "browserVersion": "Chromium 120.0.6099.109",
    "renderingTime": 345
  }
}
```

## Integration with Testing Frameworks

### Jest with jest-image-snapshot

```javascript
const axios = require('axios');
const { toMatchImageSnapshot } = require('jest-image-snapshot');
expect.extend({ toMatchImageSnapshot });

test('component renders correctly', async () => {
  // Call the render service with default responseFormat (image)
  const response = await axios.post('http://localhost:3000/render', {
    html: '<div class="card">Product Title</div>',
    css: '.card { border: 1px solid #ccc; }',
    viewport: { width: 500, height: 300 }
  }, {
    responseType: 'arraybuffer' // Important: tell axios to expect binary data
  });
  
  // The response.data is already the image buffer
  const buffer = Buffer.from(response.data);
  
  // Compare with baseline image
  expect(buffer).toMatchImageSnapshot();
});
```

## Benefits Over URL-based Approaches

- **No Public Endpoints Required**: Test components or pages not publicly accessible
- **Simplified Testing Setup**: No need to deploy test versions of your application
- **Component-Level Testing**: Test individual components without a full application
- **Consistent Styling**: Apply specific styles without affecting the entire application
- **Faster Test Execution**: Eliminates need to navigate to pages before taking screenshots

## Security Considerations

- Runs in a sandboxed environment with limited capabilities
- Implements timeouts to prevent resource exhaustion
- Validates input to prevent malicious HTML/JavaScript

## Documentation

- [EXAMPLES.md](EXAMPLES.md) - Detailed usage examples with curl and JavaScript
- [DEVELOPMENT.md](DEVELOPMENT.md) - Information for developers who want to modify or contribute to this service