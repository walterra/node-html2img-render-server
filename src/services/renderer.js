const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { v4: uuidv4 } = require('uuid');
const { addAssetsToPage } = require('./assets');

// Cache for the browser instance to improve performance
let browserInstance = null;

/**
 * Gets a browser instance, creating one if it doesn't exist
 */
async function getBrowser() {
  if (!browserInstance) {
    try {
      // Try with environment variable for Docker environments
      process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/home/renderuser/.cache/ms-playwright';
      browserInstance = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    } catch (error) {
      console.error('Error launching browser:', error.message);
    }
  }
  return browserInstance;
}

/**
 * Creates an HTML file with the provided content
 * @param {object} params - HTML, CSS, and JavaScript content
 * @returns {string} - Full HTML content
 */
function createHTMLContent(params) {
  const { html, css, javascript } = params;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTML Render</title>
  <style>
    /* Reset CSS for consistent rendering */
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    /* User CSS */
    ${css || ''}
  </style>
</head>
<body>
  ${html || ''}
  <script>
    // User JavaScript
    ${javascript || ''}
  </script>
</body>
</html>`;
}

/**
 * Embeds metadata in a PNG image using tEXt chunks
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {Object} metadata - Metadata to embed
 * @returns {Buffer} - PNG with embedded metadata
 */
function embedMetadataInImage(imageBuffer, metadata) {
  try {
    // Parse the PNG file
    const png = PNG.sync.read(imageBuffer);
    
    // Convert metadata to string
    const metadataStr = JSON.stringify(metadata);
    
    // Add metadata as a custom text chunk
    png.text = { metadata: metadataStr };
    
    // Write the PNG with metadata back to a buffer
    const resultBuffer = PNG.sync.write(png);
    
    return resultBuffer;
  } catch (error) {
    console.error('Error embedding metadata in PNG:', error);
    return imageBuffer; // Return original if embedding fails
  }
}

/**
 * Renders HTML content and returns the screenshot
 * @param {object} params - Rendering parameters
 * @returns {object} - Screenshot buffer and metadata
 */
async function renderHTML(params) {
  const {
    html,
    css,
    javascript,
    viewport = { width: 1280, height: 720, deviceScaleFactor: 1 },
    waitForSelector,
    clipSelector,
    assets,
    fonts,
    embedMetadata = true,
    format = 'png', // 'png' or 'jpeg'
    quality = 90     // JPEG quality (1-100)
  } = params;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    userAgent: 'html2img-render-server/1.0.1'
  });
  
  let page = null;
  
  try {
    // Create new page
    page = await context.newPage();
    
    // Set content
    const htmlContent = createHTMLContent({ html, css, javascript });
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    // Add assets and fonts if provided
    if (assets || fonts) {
      await addAssetsToPage(page, { assets, fonts });
    }
    
    // Wait for selector if specified
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 5000 });
    }
    
    // Take screenshot
    const startTime = Date.now();
    
    const screenshotOptions = {
      type: format === 'jpeg' ? 'jpeg' : 'png',
      fullPage: !clipSelector,
      omitBackground: false
    };
    
    // Add quality option for JPEG format
    if (format === 'jpeg') {
      screenshotOptions.quality = quality; // Use provided quality or default (90)
    }
    
    // Clip to selector if specified
    if (clipSelector) {
      try {
        const element = await page.$(clipSelector);
        if (element) {
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            screenshotOptions.clip = boundingBox;
            delete screenshotOptions.fullPage;
          }
        }
      } catch (error) {
        console.error(`Error clipping to selector ${clipSelector}:`, error);
      }
    }
    
    // Take screenshot and get buffer directly
    const screenshotBuffer = await page.screenshot(screenshotOptions);
    
    const renderingTime = Date.now() - startTime;
    
    // Get browser version
    const browserVersion = await browser.version();
    
    // Generate a unique ID for reference
    const screenshotId = uuidv4();
    
    // Create metadata
    const metadata = {
      renderedAt: new Date().toISOString(),
      viewport,
      browserVersion,
      renderingTime,
      screenshotId
    };
    
    // Embed metadata in image if requested (only for PNG)
    let finalImageBuffer;
    if (embedMetadata && format === 'png') {
      finalImageBuffer = embedMetadataInImage(screenshotBuffer, metadata);
    } else {
      finalImageBuffer = screenshotBuffer;
    }
    
    // Determine content type based on format
    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    
    // We already handled conditional metadata embedding above
    // So just use the finalImageBuffer that contains the correct version
    const outputBuffer = finalImageBuffer;
      
    // Return both image and metadata
    return {
      imageBuffer: outputBuffer,
      metadata,
      contentType
    };
  } finally {
    if (page) {
      await page.close();
    }
    await context.close();
  }
}

/**
 * Cleanly closes the browser instance
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

module.exports = {
  renderHTML,
  closeBrowser
};