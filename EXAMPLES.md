# HTML Rendering Service Examples

This document provides examples of how to use the HTML Rendering Service with cURL commands.

All examples use the required API key authentication via the `apiKey` query parameter.

## Basic Usage

### Image Format Options

The service supports both PNG and JPEG output formats. PNG is the default format.

### Render Simple HTML (Direct Image Response)

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>"
  }' \
  --output hello.png
```

This returns the PNG image directly and saves it to hello.png. Metadata is embedded in the image's EXIF data.

### Get Image with JSON Response

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>",
    "responseFormat": "json"
  }' | jq
```

The response will include the base64-encoded image and metadata:

```json
{
  "image": "base64encodedimagedata...",
  "contentType": "image/png",
  "metadata": {
    "screenshotId": "550e8400-e29b-41d4-a716-446655440000",
    "renderedAt": "2025-05-02T12:34:56.789Z",
    "viewport": {
      "width": 1280,
      "height": 720,
      "deviceScaleFactor": 1
    },
    "browserVersion": "Chromium 120.0.6099.109",
    "renderingTime": 345
  }
}
```

### Extract and Save Image from JSON Response

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>",
    "responseFormat": "json"
  }' | jq -r '.image' | base64 -d > output.png
```

### HTML with Separate CSS

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div class=\"card\">Styled Card</div>",
    "css": ".card { padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background-color: white; }"
  }' \
  --output styled_card.png
```

### Custom Viewport Size

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"width: 100%; height: 100%; background: linear-gradient(to right, #ff9966, #ff5e62);\">Gradient Background</div>",
    "viewport": {
      "width": 1920,
      "height": 1080,
      "deviceScaleFactor": 2
    }
  }' \
  --output gradient_bg.png
```

### View Response Headers with Metadata

```bash
curl -i -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div>Simple Element</div>"
  }' \
  --output /dev/null
```

This will show the HTTP headers containing metadata without saving the image.

### Render with JPEG Format

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 20px; background-color: #f0f0f0;\">Hello World</div>",
    "format": "jpeg",
    "quality": 80
  }' \
  --output hello.jpg
```

This returns a JPEG image with 80% quality and saves it to hello.jpg.

## Advanced Features

### Wait for Element

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div id=\"delayed-content\"></div><script>setTimeout(() => { document.getElementById(\"delayed-content\").innerHTML = \"<h1>Content Loaded!</h1>\"; }, 500);</script>",
    "waitForSelector": "#delayed-content h1"
  }' \
  --output delayed_content.png
```

### Clip to Element

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div style=\"padding: 50px; background-color: lightgray;\"><div id=\"target\" style=\"width: 300px; height: 200px; background-color: coral; padding: 20px;\">Only this element will be captured</div></div>",
    "clipSelector": "#target"
  }' \
  --output clipped.png
```

### With JavaScript Interaction

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<button id=\"colorButton\">Click Me</button><div id=\"box\" style=\"width: 200px; height: 200px; background-color: blue;\"></div>",
    "javascript": "document.getElementById(\"colorButton\").addEventListener(\"click\", function() { document.getElementById(\"box\").style.backgroundColor = \"red\"; }); document.getElementById(\"colorButton\").click();"
  }' \
  --output interaction.png
```

### With Custom Fonts

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
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
  }' \
  --output custom_font.png
```

### With Image Assets

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<div><img src=\"logo.png\" alt=\"Logo\" style=\"width: 200px;\"></div>",
    "assets": {
      "logo.png": "BASE64_ENCODED_IMAGE_DATA_HERE"
    }
  }' \
  --output with_assets.png
```

## Using with JavaScript/Node.js

### Direct Image Response with Axios

```javascript
const axios = require('axios');
const fs = require('fs');

async function renderAndSaveImage() {
  try {
    // API key should be loaded from environment variables
    const apiKey = process.env.RENDER_SERVICE_API_KEY;
    
    // Request the image directly
    const response = await axios.post(`http://localhost:3000/render?apiKey=${apiKey}`, {
      html: '<div class="card">Product Title</div>',
      css: '.card { border: 1px solid #ccc; padding: 16px; }'
    }, {
      responseType: 'arraybuffer'
    });
    
    // Log metadata from headers
    console.log('Image generated in:', response.headers['x-rendering-time'], 'ms');
    console.log('Screenshot ID:', response.headers['x-screenshot-id']);
    
    // Save the image
    fs.writeFileSync('product.png', response.data);
    console.log('Image saved to product.png');
    
    return response.headers['x-screenshot-id'];
  } catch (error) {
    console.error('Error rendering image:', error.message);
  }
}

renderAndSaveImage();
```

### JSON Response with Axios

```javascript
const axios = require('axios');
const fs = require('fs');

async function renderAndExtractData() {
  try {
    // API key should be loaded from environment variables
    const apiKey = process.env.RENDER_SERVICE_API_KEY;
    
    // Request JSON response with image and metadata
    const response = await axios.post(`http://localhost:3000/render?apiKey=${apiKey}`, {
      html: '<div class="card">Product Title</div>',
      css: '.card { border: 1px solid #ccc; padding: 16px; }',
      responseFormat: 'json'
    });
    
    // Get image data and metadata
    const { image, metadata } = response.data;
    
    // Save the image
    const imageBuffer = Buffer.from(image, 'base64');
    fs.writeFileSync('product.png', imageBuffer);
    
    // Use metadata
    console.log('Image generated in:', metadata.renderingTime, 'ms');
    console.log('Screenshot ID:', metadata.screenshotId);
    
    return metadata;
  } catch (error) {
    console.error('Error rendering image:', error.message);
  }
}

renderAndExtractData();
```