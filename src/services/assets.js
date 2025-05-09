/**
 * Asset handling service for injecting fonts and assets into the page
 */

/**
 * Adds assets and fonts to a page
 * @param {Object} page - Playwright page instance
 * @param {Object} options - Assets and fonts to add
 * @returns {Promise<void>}
 */
async function addAssetsToPage(page, options) {
  const { assets, fonts } = options || {};

  try {
    // Inject custom assets (images, etc.)
    if (assets && Object.keys(assets).length > 0) {
      // Set up route interception for assets
      await page.route('**/*', async route => {
        const url = route.request().url();
        const fileName = url.split('/').pop();

        // Check if this is one of our assets
        if (assets[fileName]) {
          try {
            const base64Data = assets[fileName];
            const mimeType = getMimeType(fileName);
            const buffer = Buffer.from(base64Data, 'base64');

            // Fulfill the request with our asset data
            await route.fulfill({
              status: 200,
              contentType: mimeType,
              body: buffer
            });
          } catch (error) {
            console.error(`Error serving asset ${fileName}:`, error);
            await route.continue();
          }
        } else {
          // Not one of our assets, continue normal handling
          await route.continue();
        }
      });
    }

    // Inject custom fonts - simplify to just CSS injection without forcing font load
    if (fonts && fonts.length > 0) {
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

      // Add the font-face declarations to the page
      await page.addStyleTag({ content: fontFaceCSS });

      // Wait a brief moment to allow any font processing
      await page.waitForTimeout(50);
    }
  } catch (error) {
    // Log and continue if there are issues with assets
    console.error('Error adding assets to page:', error);
  }
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
