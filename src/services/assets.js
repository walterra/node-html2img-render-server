/**
 * Asset handling service for injecting fonts and assets into the page
 */
const { getTracer, SpanStatusCode } = require('../utils/telemetry');

/**
 * Adds assets and fonts to a page
 * @param {Object} page - Playwright page instance
 * @param {Object} options - Assets and fonts to add
 * @returns {Promise<void>}
 */
async function addAssetsToPage(page, options) {
  // Get tracer for assets component
  const tracer = getTracer('assets');

  // Start a span for asset injection
  return tracer.startActiveSpan('assets.add_to_page', async (span) => {
    const { assets, fonts } = options || {};

    // Add basic attributes to the span
    span.setAttribute('assets.count', assets ? Object.keys(assets).length : 0);
    span.setAttribute('fonts.count', fonts ? fonts.length : 0);

    try {
      // Inject custom assets (images, etc.)
      if (assets && Object.keys(assets).length > 0) {
        const assetSpan = tracer.startSpan('assets.setup_interceptor', {
          parent: span
        });

        try {
          assetSpan.setAttribute('assets.count', Object.keys(assets).length);

          // Collect asset types for metrics
          const assetTypes = {};
          Object.keys(assets).forEach(fileName => {
            const ext = fileName.split('.').pop().toLowerCase();
            assetTypes[ext] = (assetTypes[ext] || 0) + 1;
          });

          // Add asset type counts to span
          Object.entries(assetTypes).forEach(([type, count]) => {
            assetSpan.setAttribute(`assets.type.${type}`, count);
          });

          // Set up route interception for assets
          await page.route('**/*', async route => {
            const routeSpan = tracer.startSpan('assets.route_handler', {
              parent: assetSpan
            });

            try {
              const url = route.request().url();
              const fileName = url.split('/').pop();

              routeSpan.setAttribute('request.url', url);
              routeSpan.setAttribute('request.filename', fileName);

              // Check if this is one of our assets
              if (assets[fileName]) {
                routeSpan.setAttribute('asset.found', true);

                try {
                  const base64Data = assets[fileName];
                  const mimeType = getMimeType(fileName);
                  const buffer = Buffer.from(base64Data, 'base64');

                  routeSpan.setAttribute('asset.mime_type', mimeType);
                  routeSpan.setAttribute('asset.size_bytes', buffer.length);

                  // Fulfill the request with our asset data
                  await route.fulfill({
                    status: 200,
                    contentType: mimeType,
                    body: buffer
                  });

                  routeSpan.setStatus({ code: SpanStatusCode.OK });
                } catch (error) {
                  console.error(`Error serving asset ${fileName}:`, error);
                  routeSpan.recordException(error);
                  routeSpan.setAttribute('asset.error', error.message);
                  routeSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: `Error serving asset: ${error.message}`
                  });

                  await route.continue();
                }
              } else {
                // Not one of our assets, continue normal handling
                routeSpan.setAttribute('asset.found', false);
                await route.continue();
              }
            } finally {
              routeSpan.end();
            }
          });

          assetSpan.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          assetSpan.recordException(error);
          assetSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Failed to set up asset interceptor: ${error.message}`
          });
          throw error;
        } finally {
          assetSpan.end();
        }
      }

      // Inject custom fonts
      if (fonts && fonts.length > 0) {
        const fontSpan = tracer.startSpan('assets.add_fonts', {
          parent: span
        });

        try {
          fontSpan.setAttribute('fonts.count', fonts.length);

          // Add font details to span
          fonts.forEach((font, index) => {
            fontSpan.setAttribute(`font.${index}.name`, font.name);
            fontSpan.setAttribute(`font.${index}.weight`, font.weight || 'normal');
            fontSpan.setAttribute(`font.${index}.style`, font.style || 'normal');
            if (font.data) {
              fontSpan.setAttribute(`font.${index}.size_bytes`, font.data.length);
            }
          });

          fontSpan.addEvent('fonts.css_generation.start');

          // Create CSS for all the fonts
          const fontFaceCSS = fonts
            .map(font => {
              return `
              @font-face {
                font-family: '${font.name}';
                font-weight: ${font.weight || 'normal'};
                font-style: ${font.style || 'normal'};
                src: url(data:font/woff2;base64,${font.data}) format('woff2');
                font-display: swap;
              }
            `;
            })
            .join('\n');

          fontSpan.addEvent('fonts.css_generation.complete');
          fontSpan.setAttribute('fonts.css_size_bytes', fontFaceCSS.length);

          // Add the font-face declarations to the page
          fontSpan.addEvent('fonts.add_style_tag.start');
          await page.addStyleTag({ content: fontFaceCSS });
          fontSpan.addEvent('fonts.add_style_tag.complete');

          // Wait a brief moment to allow any font processing
          fontSpan.addEvent('fonts.processing.start');
          await page.waitForTimeout(50);
          fontSpan.addEvent('fonts.processing.complete');

          fontSpan.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          fontSpan.recordException(error);
          fontSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Failed to add fonts: ${error.message}`
          });
          throw error;
        } finally {
          fontSpan.end();
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      // Log and continue if there are issues with assets
      console.error('Error adding assets to page:', error);
      span.recordException(error);
      span.setAttribute('error.message', error.message);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Error adding assets to page: ${error.message}`
      });
    } finally {
      span.end();
    }
  });
}

/**
 * Determine MIME type from file extension
 * @param {string} filename - Filename with extension
 * @returns {string} - MIME type
 */
function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

module.exports = {
  addAssetsToPage,
  getMimeType
};
