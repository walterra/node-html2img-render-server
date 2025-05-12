const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { v4: uuidv4 } = require('uuid');
const { addAssetsToPage } = require('./assets');
const { 
  withTracing, 
  createSpanManager 
} = require('../instrumentation/wrappers');
const { recordRenderMetrics } = require('../instrumentation/metrics');

// Cache for the browser instance to improve performance
let browserInstance = null;

/**
 * Gets a browser instance, creating one if it doesn't exist
 */
const getBrowser = withTracing({
  name: 'renderer.get_browser',
  component: 'renderer'
})(async function getBrowserImpl() {
  if (!browserInstance) {
    try {
      // Try with environment variable for Docker environments
      process.env.PLAYWRIGHT_BROWSERS_PATH =
        process.env.PLAYWRIGHT_BROWSERS_PATH || '/home/renderuser/.cache/ms-playwright';

      browserInstance = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    } catch (error) {
      console.error('Error launching browser:', error.message);
      throw error;
    }
  }
  
  return browserInstance;
});

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
const embedMetadataInImage = withTracing({
  name: 'renderer.embed_metadata',
  component: 'renderer'
})(async function embedMetadataInImageImpl(imageBuffer, metadata) {
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
});

/**
 * Renders HTML content and returns the screenshot
 * @param {object} params - Rendering parameters
 * @returns {object} - Screenshot buffer and metadata
 */
const renderHTML = withTracing({
  name: 'renderer.render_html',
  component: 'renderer',
  attributes: (params) => ({
    'html.size_bytes': params.html?.length || 0,
    'css.size_bytes': params.css?.length || 0,
    'js.size_bytes': params.javascript?.length || 0,
    'format': params.format || 'png',
    'viewport.width': params.viewport?.width || 1280,
    'viewport.height': params.viewport?.height || 720,
    'viewport.scale': params.viewport?.deviceScaleFactor || 1,
    'has_assets': !!(params.assets || params.fonts),
    'wait_for_selector': !!params.waitForSelector,
    'clip_selector': !!params.clipSelector
  })
})(async function renderHTMLImpl(params) {
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
    quality = 90 // JPEG quality (1-100)
  } = params;

  let browser, context, page = null;
  let screenshotBuffer, renderingTime, browserVersion;
  
  // Create span manager for nested spans
  const spans = createSpanManager({ component: 'renderer' });

  try {
    // Get browser
    browser = await getBrowser();

    // Create browser context
    context = await spans.withSpan('renderer.create_context', {
      'viewport.width': viewport.width,
      'viewport.height': viewport.height,
      'viewport.scale': viewport.deviceScaleFactor || 1
    }, async () => {
      return browser.newContext({
        viewport,
        deviceScaleFactor: viewport.deviceScaleFactor || 1,
        userAgent: 'html2img-render-server/1.0.1'
      });
    });

    // Create page
    page = await spans.withSpan('renderer.create_page', {}, async () => {
      return context.newPage();
    });

    // Set HTML content
    await spans.withSpan('renderer.set_content', {
      'content.size_bytes': createHTMLContent({ html, css, javascript }).length
    }, async (span) => {
      spans.addEvent('content.generate.start');
      const htmlContent = createHTMLContent({ html, css, javascript });
      spans.addEvent('content.generate.complete');

      spans.addEvent('content.load.start');
      await page.setContent(htmlContent, { waitUntil: 'networkidle' });
      spans.addEvent('content.load.complete');
    });

    // Add assets and fonts if provided
    if (assets || fonts) {
      await addAssetsToPage(page, { assets, fonts });
    }

    // Wait for selector if specified
    if (waitForSelector) {
      await spans.withSpan('renderer.wait_for_selector', {
        'selector': waitForSelector
      }, async (span) => {
        spans.addEvent('wait.start');
        await page.waitForSelector(waitForSelector, { timeout: 5000 });
        spans.addEvent('wait.complete');
      });
    }

    // Take screenshot
    const screenshotData = await spans.withSpan('renderer.take_screenshot', {
      'format': format,
      'quality': format === 'jpeg' ? quality : undefined
    }, async (span) => {
      const startTime = Date.now();
      
      spans.addEvent('screenshot.prepare.start');

      const screenshotOptions = {
        type: format === 'jpeg' ? 'jpeg' : 'png',
        fullPage: !clipSelector,
        omitBackground: false
      };

      // Add quality option for JPEG format
      if (format === 'jpeg') {
        screenshotOptions.quality = quality;
        span.setAttribute('jpeg.quality', quality);
      }

      // Clip to selector if specified
      if (clipSelector) {
        spans.addEvent('clip.lookup.start');
        
        try {
          const element = await page.$(clipSelector);
          if (element) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
              screenshotOptions.clip = boundingBox;
              delete screenshotOptions.fullPage;

              span.setAttribute('clip.found', true);
              span.setAttribute('clip.x', boundingBox.x);
              span.setAttribute('clip.y', boundingBox.y);
              span.setAttribute('clip.width', boundingBox.width);
              span.setAttribute('clip.height', boundingBox.height);
            } else {
              span.setAttribute('clip.found', false);
              span.setAttribute('clip.error', 'No bounding box');
            }
          } else {
            span.setAttribute('clip.found', false);
            span.setAttribute('clip.error', 'Element not found');
          }
        } catch (error) {
          console.error(`Error clipping to selector ${clipSelector}:`, error);
          span.setAttribute('clip.error', error.message);
        }
        
        spans.addEvent('clip.lookup.complete');
      }

      spans.addEvent('screenshot.capture.start');
      const buffer = await page.screenshot(screenshotOptions);
      spans.addEvent('screenshot.capture.complete');
      
      const captureTime = Date.now() - startTime;
      
      return {
        buffer,
        captureTime,
        screenshotOptions
      };
    });
    
    screenshotBuffer = screenshotData.buffer;
    renderingTime = screenshotData.captureTime;

    // Get browser version and create metadata
    browserVersion = await browser.version();
    
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
      try {
        finalImageBuffer = await embedMetadataInImage(screenshotBuffer, metadata);
      } catch (error) {
        console.error('Error embedding metadata:', error);
        finalImageBuffer = screenshotBuffer; // Fallback to original on error
      }
    } else {
      finalImageBuffer = screenshotBuffer;
    }

    // Determine content type based on format
    const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const outputBuffer = finalImageBuffer;

    // Record metrics
    recordRenderMetrics({
      format,
      durationMs: renderingTime,
      sizeBytes: outputBuffer.length
    });

    // Return both image and metadata
    return {
      imageBuffer: outputBuffer,
      metadata,
      contentType
    };
  } catch (error) {
    // Record error metrics
    if (format) {
      recordRenderMetrics({
        format,
        error: true
      });
    }
    throw error;
  } finally {
    // Clean up resources
    if (page) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
  }
});

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
  // Let the process terminate naturally
});

process.on('SIGINT', async () => {
  await closeBrowser();
  // Let the process terminate naturally
});

module.exports = {
  renderHTML,
  closeBrowser
};