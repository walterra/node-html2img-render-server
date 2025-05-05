const { chromium } = require('playwright');
const piexif = require('piexifjs');
const { v4: uuidv4 } = require('uuid');
const { addAssetsToPage } = require('./assets');

// Cache for the browser instance to improve performance
let browserInstance = null;

/**
 * Gets a browser instance, creating one if it doesn't exist
 */
async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
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
 * Embeds metadata as EXIF in a PNG image
 * @param {Buffer} imageBuffer - PNG image buffer
 * @param {Object} metadata - Metadata to embed
 * @returns {Buffer} - PNG with embedded metadata
 */
function embedMetadataInImage(imageBuffer, metadata) {
  try {
    // Convert metadata to string and add it to the EXIF UserComment field
    const metadataStr = JSON.stringify(metadata);
    
    // Create basic EXIF data structure with only UserComment
    const exifObj = {
      "0th": {},
      "Exif": {
        [piexif.ExifIFD.UserComment]: metadataStr
      },
      "GPS": {},
      "Interop": {},
      "1st": {},
      "thumbnail": null
    };
    
    // Convert EXIF to binary and insert into image
    const exifBytes = piexif.dump(exifObj);
    const dataUri = "data:image/png;base64," + imageBuffer.toString('base64');
    const newDataUri = piexif.insert(exifBytes, dataUri);
    
    // Extract base64 data and convert back to buffer
    const base64Data = newDataUri.replace(/^data:image\/png;base64,/, "");
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    console.error('Error embedding metadata:', error);
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
    embedMetadata = true
  } = params;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    userAgent: 'HTML-Render-Service/1.0'
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
      type: 'png',
      fullPage: !clipSelector,
      omitBackground: false
    };
    
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
    
    // Embed metadata in image if requested
    const finalImageBuffer = embedMetadata ? 
      embedMetadataInImage(screenshotBuffer, metadata) : 
      screenshotBuffer;
    
    // Return both image and metadata
    return {
      imageBuffer: finalImageBuffer,
      metadata,
      contentType: 'image/png'
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