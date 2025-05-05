# HTML Rendering Service Examples

This document provides examples of how to use the HTML Rendering Service with cURL commands.

## Basic Usage

### Render Simple HTML

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>"
  }'
```

### HTML with Separate CSS

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div class=\"card\">Styled Card</div>",
    "css": ".card { padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background-color: white; }"
  }'
```

### Custom Viewport Size

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"width: 100%; height: 100%; background: linear-gradient(to right, #ff9966, #ff5e62);\">Gradient Background</div>",
    "viewport": {
      "width": 1920,
      "height": 1080,
      "deviceScaleFactor": 2
    }
  }'
```

## Advanced Features

### Wait for Element

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div id=\"delayed-content\"></div><script>setTimeout(() => { document.getElementById(\"delayed-content\").innerHTML = \"<h1>Content Loaded!</h1>\"; }, 500);</script>",
    "waitForSelector": "#delayed-content h1"
  }'
```

### Clip to Element

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 50px; background-color: lightgray;\"><div id=\"target\" style=\"width: 300px; height: 200px; background-color: coral; padding: 20px;\">Only this element will be captured</div></div>",
    "clipSelector": "#target"
  }'
```

### With JavaScript Interaction

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<button id=\"colorButton\">Click Me</button><div id=\"box\" style=\"width: 200px; height: 200px; background-color: blue;\"></div>",
    "javascript": "document.getElementById(\"colorButton\").addEventListener(\"click\", function() { document.getElementById(\"box\").style.backgroundColor = \"red\"; }); document.getElementById(\"colorButton\").click();"
  }'
```

### With Custom Fonts

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1 style=\"font-family: CustomFont, sans-serif;\">Custom Font Heading</h1>",
    "fonts": [
      {
        "name": "CustomFont",
        "data": "BASE64_ENCODED_FONT_DATA_HERE",
        "weight": "400",
        "style": "normal"
      }
    ]
  }'
```

### With Image Assets

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div><img src=\"logo.png\" alt=\"Logo\" style=\"width: 200px;\"></div>",
    "assets": {
      "logo.png": "BASE64_ENCODED_IMAGE_DATA_HERE"
    }
  }'
```

## Retrieving Screenshots

### Direct Access to Generated Screenshot

After receiving a response like:

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

You can download the screenshot:

```bash
curl -O http://localhost:3000/screenshots/550e8400-e29b-41d4-a716-446655440000.png
```

Or use the screenshot ID:

```bash
curl -L http://localhost:3000/render/screenshot/550e8400-e29b-41d4-a716-446655440000 --output screenshot.png
```

## Using with Visual Regression Testing

### Example with Jest and jest-image-snapshot

```javascript
const axios = require('axios');
const { toMatchImageSnapshot } = require('jest-image-snapshot');
expect.extend({ toMatchImageSnapshot });

test('component renders correctly', async () => {
  // Call the render service
  const response = await axios.post('http://localhost:3000/render', {
    html: '<div class="card">Product Title</div>',
    css: '.card { border: 1px solid #ccc; padding: 16px; }',
    viewport: { width: 500, height: 300 }
  });
  
  const { screenshotUrl } = response.data;
  
  // Download the image
  const imageResponse = await axios.get(
    `http://localhost:3000${screenshotUrl}`,
    { responseType: 'arraybuffer' }
  );
  
  const buffer = Buffer.from(imageResponse.data);
  
  // Compare with baseline image
  expect(buffer).toMatchImageSnapshot();
});
```