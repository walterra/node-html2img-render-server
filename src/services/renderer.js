const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { v4: uuidv4 } = require('uuid');
const { addAssetsToPage } = require('./assets');
const { getTracer, SpanStatusCode, recordRenderMetrics } = require('../utils/telemetry');

// Cache for the browser instance to improve performance
let browserInstance = null;

/**
 * Gets a browser instance, creating one if it doesn't exist
 */
async function getBrowser() {
  // Get a tracer for browser operations
  const tracer = getTracer('renderer');

  // Create a span for browser initialization
  return await tracer.startActiveSpan('renderer.get_browser', async (span) => {
    try {
      if (!browserInstance) {
        // Add event for browser initialization
        span.addEvent('browser.init.start');

        try {
          // Try with environment variable for Docker environments
          process.env.PLAYWRIGHT_BROWSERS_PATH =
            process.env.PLAYWRIGHT_BROWSERS_PATH || '/home/renderuser/.cache/ms-playwright';

          browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });

          // Add browser info to span
          span.setAttribute('browser.instance', 'created');
          span.addEvent('browser.init.complete');
        } catch (error) {
          console.error('Error launching browser:', error.message);
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Failed to launch browser: ${error.message}`
          });
          throw error;
        }
      } else {
        span.setAttribute('browser.instance', 'cached');
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return browserInstance;
    } finally {
      span.end();
    }
  });
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
  // Get a tracer for the renderer component
  const tracer = getTracer('renderer');

  // Start a parent span for the entire rendering process
  return tracer.startActiveSpan('renderer.render_html', async (parentSpan) => {
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

    // Add input parameters as span attributes
    parentSpan.setAttribute('html.size_bytes', (html?.length || 0));
    parentSpan.setAttribute('css.size_bytes', (css?.length || 0));
    parentSpan.setAttribute('js.size_bytes', (javascript?.length || 0));
    parentSpan.setAttribute('format', format);
    parentSpan.setAttribute('viewport.width', viewport.width);
    parentSpan.setAttribute('viewport.height', viewport.height);
    parentSpan.setAttribute('viewport.scale', viewport.deviceScaleFactor || 1);
    parentSpan.setAttribute('has_assets', !!(assets || fonts));
    parentSpan.setAttribute('wait_for_selector', !!waitForSelector);
    parentSpan.setAttribute('clip_selector', !!clipSelector);

    let browser, context, page = null;
    let screenshotBuffer, renderingTime, browserVersion;

    try {
      // Get browser (this is already traced internally)
      parentSpan.addEvent('browser.get');
      browser = await getBrowser();

      // Create browser context with tracing
      const contextSpan = tracer.startSpan('renderer.create_context', {
        parent: parentSpan
      });

      try {
        contextSpan.addEvent('context.create.start');
        context = await browser.newContext({
          viewport,
          deviceScaleFactor: viewport.deviceScaleFactor || 1,
          userAgent: 'html2img-render-server/1.0.1'
        });
        contextSpan.addEvent('context.create.complete');
        contextSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        contextSpan.recordException(error);
        contextSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Failed to create browser context: ${error.message}`
        });
        throw error;
      } finally {
        contextSpan.end();
      }

      // Create page with tracing
      const pageSpan = tracer.startSpan('renderer.create_page', {
        parent: parentSpan
      });

      try {
        pageSpan.addEvent('page.create.start');
        page = await context.newPage();
        pageSpan.addEvent('page.create.complete');
        pageSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        pageSpan.recordException(error);
        pageSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Failed to create page: ${error.message}`
        });
        throw error;
      } finally {
        pageSpan.end();
      }

      // Set HTML content with tracing
      const contentSpan = tracer.startSpan('renderer.set_content', {
        parent: parentSpan
      });

      try {
        contentSpan.addEvent('content.generate.start');
        const htmlContent = createHTMLContent({ html, css, javascript });
        contentSpan.setAttribute('content.size_bytes', htmlContent.length);
        contentSpan.addEvent('content.generate.complete');

        contentSpan.addEvent('content.load.start');
        await page.setContent(htmlContent, { waitUntil: 'networkidle' });
        contentSpan.addEvent('content.load.complete');
        contentSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        contentSpan.recordException(error);
        contentSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Failed to set page content: ${error.message}`
        });
        throw error;
      } finally {
        contentSpan.end();
      }

      // Add assets and fonts if provided
      if (assets || fonts) {
        const assetsSpan = tracer.startSpan('renderer.add_assets', {
          parent: parentSpan
        });

        try {
          assetsSpan.addEvent('assets.add.start');
          assetsSpan.setAttribute('assets.count', assets ? Object.keys(assets).length : 0);
          assetsSpan.setAttribute('fonts.count', fonts ? fonts.length : 0);

          await addAssetsToPage(page, { assets, fonts });

          assetsSpan.addEvent('assets.add.complete');
          assetsSpan.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          assetsSpan.recordException(error);
          assetsSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Failed to add assets: ${error.message}`
          });
          throw error;
        } finally {
          assetsSpan.end();
        }
      }

      // Wait for selector if specified
      if (waitForSelector) {
        const waitSpan = tracer.startSpan('renderer.wait_for_selector', {
          parent: parentSpan
        });

        try {
          waitSpan.setAttribute('selector', waitForSelector);
          waitSpan.addEvent('wait.start');

          await page.waitForSelector(waitForSelector, { timeout: 5000 });

          waitSpan.addEvent('wait.complete');
          waitSpan.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          waitSpan.recordException(error);
          waitSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Timeout waiting for selector: ${error.message}`
          });
          throw error;
        } finally {
          waitSpan.end();
        }
      }

      // Take screenshot with tracing
      const screenshotSpan = tracer.startSpan('renderer.take_screenshot', {
        parent: parentSpan
      });

      try {
        const startTime = Date.now();
        screenshotSpan.addEvent('screenshot.prepare.start');

        const screenshotOptions = {
          type: format === 'jpeg' ? 'jpeg' : 'png',
          fullPage: !clipSelector,
          omitBackground: false
        };

        // Add quality option for JPEG format
        if (format === 'jpeg') {
          screenshotOptions.quality = quality;
          screenshotSpan.setAttribute('jpeg.quality', quality);
        }

        // Clip to selector if specified
        if (clipSelector) {
          try {
            screenshotSpan.setAttribute('clip.selector', clipSelector);
            screenshotSpan.addEvent('clip.lookup.start');

            const element = await page.$(clipSelector);
            if (element) {
              const boundingBox = await element.boundingBox();
              if (boundingBox) {
                screenshotOptions.clip = boundingBox;
                delete screenshotOptions.fullPage;

                screenshotSpan.setAttribute('clip.found', true);
                screenshotSpan.setAttribute('clip.x', boundingBox.x);
                screenshotSpan.setAttribute('clip.y', boundingBox.y);
                screenshotSpan.setAttribute('clip.width', boundingBox.width);
                screenshotSpan.setAttribute('clip.height', boundingBox.height);
              } else {
                screenshotSpan.setAttribute('clip.found', false);
                screenshotSpan.setAttribute('clip.error', 'No bounding box');
              }
            } else {
              screenshotSpan.setAttribute('clip.found', false);
              screenshotSpan.setAttribute('clip.error', 'Element not found');
            }

            screenshotSpan.addEvent('clip.lookup.complete');
          } catch (error) {
            console.error(`Error clipping to selector ${clipSelector}:`, error);
            screenshotSpan.recordException(error);
            screenshotSpan.setAttribute('clip.error', error.message);
          }
        }

        // Take the actual screenshot
        screenshotSpan.addEvent('screenshot.capture.start');
        screenshotBuffer = await page.screenshot(screenshotOptions);
        screenshotSpan.addEvent('screenshot.capture.complete');

        renderingTime = Date.now() - startTime;
        screenshotSpan.setAttribute('screenshot.size_bytes', screenshotBuffer.length);
        screenshotSpan.setAttribute('screenshot.duration_ms', renderingTime);

        screenshotSpan.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        screenshotSpan.recordException(error);
        screenshotSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Failed to take screenshot: ${error.message}`
        });
        throw error;
      } finally {
        screenshotSpan.end();
      }

      // Get browser version and create metadata
      const metadataSpan = tracer.startSpan('renderer.create_metadata', {
        parent: parentSpan
      });

      try {
        browserVersion = await browser.version();
        metadataSpan.setAttribute('browser.version', browserVersion);

        // Generate a unique ID for reference
        const screenshotId = uuidv4();
        metadataSpan.setAttribute('screenshot.id', screenshotId);

        // Create metadata
        const metadata = {
          renderedAt: new Date().toISOString(),
          viewport,
          browserVersion,
          renderingTime,
          screenshotId
        };

        metadataSpan.setStatus({ code: SpanStatusCode.OK });

        // Embed metadata in image if requested (only for PNG)
        let finalImageBuffer;
        if (embedMetadata && format === 'png') {
          const embedSpan = tracer.startSpan('renderer.embed_metadata', {
            parent: parentSpan
          });

          try {
            finalImageBuffer = await embedMetadataInImage(screenshotBuffer, metadata);
            embedSpan.setStatus({ code: SpanStatusCode.OK });
          } catch (error) {
            embedSpan.recordException(error);
            embedSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: `Failed to embed metadata: ${error.message}`
            });
            console.error('Error embedding metadata:', error);
            finalImageBuffer = screenshotBuffer; // Fallback to original on error
          } finally {
            embedSpan.end();
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

        parentSpan.setAttribute('render.success', true);
        parentSpan.setAttribute('render.duration_ms', renderingTime);
        parentSpan.setAttribute('render.size_bytes', outputBuffer.length);
        parentSpan.setStatus({ code: SpanStatusCode.OK });

        // Return both image and metadata
        return {
          imageBuffer: outputBuffer,
          metadata,
          contentType
        };
      } catch (error) {
        metadataSpan.recordException(error);
        metadataSpan.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        metadataSpan.end();
      }
    } catch (error) {
      // Record error metrics
      if (format) {
        recordRenderMetrics({
          format,
          error: true
        });
      }

      parentSpan.recordException(error);
      parentSpan.setAttribute('render.success', false);
      parentSpan.setAttribute('render.error', error.message);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      throw error;
    } finally {
      // Clean up resources
      if (page) {
        await page.close();
      }
      if (context) {
        await context.close();
      }

      parentSpan.end();
    }
  });
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
