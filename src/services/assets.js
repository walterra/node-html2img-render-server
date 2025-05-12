/**
 * Asset handling service for injecting fonts and assets into the page
 */
const { withTracing, createSpanManager } = require('../instrumentation/wrappers');

/**
 * Adds assets and fonts to a page
 * @param {Object} page - Playwright page instance
 * @param {Object} options - Assets and fonts to add
 * @returns {Promise<void>}
 */
const addAssetsToPage = withTracing({
  name: 'assets.add_to_page',
  component: 'assets',
  attributes: (page, options) => ({
    'assets.count': options?.assets ? Object.keys(options.assets).length : 0,
    'fonts.count': options?.fonts ? options.fonts.length : 0
  })
})(async function addAssetsToPageImpl(page, options) {
  const { assets, fonts } = options || {};
  
  // Create a span manager for nested spans
  const spans = createSpanManager({ component: 'assets' });

  try {
    // Inject custom assets (images, etc.)
    if (assets && Object.keys(assets).length > 0) {
      await spans.withSpan('assets.setup_interceptor', 
        { 'assets.count': Object.keys(assets).length },
        async (span) => {
          // Collect asset types for metrics
          const assetTypes = {};
          Object.keys(assets).forEach(fileName => {
            const ext = fileName.split('.').pop().toLowerCase();
            assetTypes[ext] = (assetTypes[ext] || 0) + 1;
          });

          // Add asset type counts to span
          Object.entries(assetTypes).forEach(([type, count]) => {
            span.setAttribute(`assets.type.${type}`, count);
          });

          // Set up route interception for assets
          await page.route('**/*', async route => {
            const url = route.request().url();
            const fileName = url.split('/').pop();

            // Use a nested span for each route request
            await spans.withSpan('assets.route_handler', 
              { 
                'request.url': url,
                'request.filename': fileName
              },
              async (routeSpan) => {
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
                  } catch (error) {
                    console.error(`Error serving asset ${fileName}:`, error);
                    routeSpan.setAttribute('asset.error', error.message);
                    await route.continue();
                  }
                } else {
                  // Not one of our assets, continue normal handling
                  routeSpan.setAttribute('asset.found', false);
                  await route.continue();
                }
              }
            );
          });
        }
      );
    }

    // Inject custom fonts
    if (fonts && fonts.length > 0) {
      await spans.withSpan('assets.add_fonts', 
        { 'fonts.count': fonts.length },
        async (span) => {
          // Add font details to span
          fonts.forEach((font, index) => {
            span.setAttribute(`font.${index}.name`, font.name);
            span.setAttribute(`font.${index}.weight`, font.weight || 'normal');
            span.setAttribute(`font.${index}.style`, font.style || 'normal');
            if (font.data) {
              span.setAttribute(`font.${index}.size_bytes`, font.data.length);
            }
          });

          spans.addEvent('fonts.css_generation.start');

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

          spans.addEvent('fonts.css_generation.complete');
          span.setAttribute('fonts.css_size_bytes', fontFaceCSS.length);

          // Add the font-face declarations to the page
          spans.addEvent('fonts.add_style_tag.start');
          await page.addStyleTag({ content: fontFaceCSS });
          spans.addEvent('fonts.add_style_tag.complete');

          // Wait a brief moment to allow any font processing
          spans.addEvent('fonts.processing.start');
          await page.waitForTimeout(50);
          spans.addEvent('fonts.processing.complete');
        }
      );
    }
  } catch (error) {
    // Log and continue if there are issues with assets
    console.error('Error adding assets to page:', error);
  }
});

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