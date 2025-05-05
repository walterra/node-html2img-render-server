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
  const { assets, fonts } = options;
  
  // Inject custom assets
  if (assets && Object.keys(assets).length > 0) {
    await page.evaluate((assetMap) => {
      // Create a function to handle asset requests
      window.resolveAsset = function(url) {
        const assetName = url.split('/').pop();
        if (assetMap[assetName]) {
          return `data:${getMimeType(assetName)};base64,${assetMap[assetName]}`;
        }
        return url;
      };
      
      // Helper to determine MIME type from file extension
      function getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'svg': 'image/svg+xml',
          'webp': 'image/webp',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'ttf': 'font/ttf',
          'otf': 'font/otf',
          'eot': 'application/vnd.ms-fontobject'
        };
        return mimeTypes[ext] || 'application/octet-stream';
      }
      
      // Override fetch to handle asset URLs
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        if (typeof url === 'string') {
          const assetName = url.split('/').pop();
          if (assetMap[assetName]) {
            return originalFetch(window.resolveAsset(url), options);
          }
        }
        return originalFetch(url, options);
      };
      
      // Override Image.prototype.src to handle asset URLs
      const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
      Object.defineProperty(Image.prototype, 'src', {
        get: function() {
          return originalImageSrc.get.call(this);
        },
        set: function(value) {
          originalImageSrc.set.call(this, window.resolveAsset(value));
        }
      });
      
      // Patch existing image elements
      document.querySelectorAll('img').forEach(img => {
        const originalSrc = img.getAttribute('src');
        if (originalSrc) {
          img.src = window.resolveAsset(originalSrc);
        }
      });
      
    }, assets);
  }
  
  // Inject custom fonts
  if (fonts && fonts.length > 0) {
    await page.evaluate((fontList) => {
      // Add @font-face declarations to head
      const style = document.createElement('style');
      style.textContent = fontList.map(font => {
        return `
          @font-face {
            font-family: '${font.name}';
            font-weight: ${font.weight || 'normal'};
            font-style: ${font.style || 'normal'};
            src: url(data:font/woff2;base64,${font.data}) format('woff2');
            font-display: swap;
          }
        `;
      }).join('\n');
      
      document.head.appendChild(style);
      
      // Force font loading by creating temporary elements
      const div = document.createElement('div');
      div.style.opacity = '0';
      div.style.position = 'absolute';
      div.style.top = '-9999px';
      
      fontList.forEach(font => {
        const span = document.createElement('span');
        span.style.fontFamily = font.name;
        span.textContent = 'Font Loading';
        div.appendChild(span);
      });
      
      document.body.appendChild(div);
      
      // Remove after a delay
      setTimeout(() => {
        document.body.removeChild(div);
      }, 100);
      
    }, fonts);
    
    // Wait a moment for fonts to load
    await page.waitForTimeout(100);
  }
}

module.exports = {
  addAssetsToPage
};