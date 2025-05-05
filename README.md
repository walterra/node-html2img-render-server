# HTML Rendering Service

A consistent environment service for visual regression testing that accepts HTML content directly and returns screenshots.

## Overview

This service solves the common challenge in visual regression testing where different environments produce slightly different renderings (due to anti-aliasing, font rendering differences, etc.). By offloading rendering to a dedicated service with a consistent environment, tests can produce reliable, reproducible results regardless of where the tests themselves run.

## Features

- **Direct HTML Rendering**: Submit raw HTML, CSS, and JavaScript for rendering instead of relying on URL access
- **Consistent Environment**: Ensures identical rendering across all test runs
- **Asset Injection**: Support for fonts, images, and other assets
- **Flexible Screenshot Options**: Configurable viewport, element selection, and waiting conditions
- **Containerized**: Runs in Docker for maximum consistency and portability

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
  ]
}
```

#### Response

```json
{
  "screenshotId": "550e8400-e29b-41d4-a716-446655440000",
  "screenshotUrl": "/screenshots/550e8400-e29b-41d4-a716-446655440000.png",
  "metadata": {
    "renderedAt": "2025-05-02T12:34:56.789Z",
    "viewport": { "width": 1280, "height": 720, "deviceScaleFactor": 1 },
    "browserVersion": "Chromium 120.0.6099.109",
    "renderingTime": 345
  }
}
```

## Setup Instructions

### Running with Docker

```bash
# Build the Docker image
docker build -t html-renderer .

# Run the service
docker run -p 3000:3000 html-renderer
```

### Running Locally

```bash
# Install dependencies
npm install

# Start the service
node server.js
```

## Usage in Tests

```javascript
const axios = require('axios');

it('component renders correctly', async () => {
  // Get component HTML
  const html = `<div class="card">Product Title</div>`;
  
  // Call the render service
  const response = await axios.post('http://render-service:3000/render', {
    html,
    css: `.card { border: 1px solid #ccc; }`,
    viewport: { width: 500, height: 300 }
  });
  
  const { screenshotUrl } = response.data;
  
  // Download the image
  const imageResponse = await axios.get(
    `http://render-service:3000${screenshotUrl}`,
    { responseType: 'arraybuffer' }
  );
  
  const buffer = Buffer.from(imageResponse.data);
  
  // Compare with baseline image
  expect(buffer).toMatchImageSnapshot();
});
```

## Implementation

The service uses Playwright to render HTML in a consistent Chromium environment. The architecture ensures:

1. **Sandboxed Execution**: JavaScript runs in an isolated environment
2. **Consistent Font Rendering**: Forces standardized text rendering
3. **Asset Management**: Handles fonts, images, and other resources
4. **Parallelization**: Capable of handling multiple rendering requests simultaneously

## Security Considerations

- Runs in a sandboxed environment with limited capabilities
- Implements timeouts to prevent resource exhaustion
- Validates input to prevent malicious HTML/JavaScript

## Benefits Over URL-based Approaches

- **No Public Endpoints Required**: Test components or pages not publicly accessible
- **Simplified Testing Setup**: No need to deploy test versions of your application
- **Component-Level Testing**: Test individual components without a full application
- **Consistent Styling**: Apply specific styles without affecting the entire application
- **Faster Test Execution**: Eliminates need to navigate to pages before taking screenshots

## Next Steps

- Implement baseline management within the service
- Add diff visualization tools
- Support for animations and transitions
- Automated baseline updates based on approved changes