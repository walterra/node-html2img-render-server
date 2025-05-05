const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');
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
 * Renders HTML content and takes a screenshot
 * @param {object} params - Rendering parameters
 * @returns {object} - Screenshot information
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
    fonts
  } = params;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.deviceScaleFactor || 1,
    userAgent: 'HTML-Render-Service/1.0'
  });

  // Generate screenshot ID
  const screenshotId = uuidv4();
  const screenshotFileName = `${screenshotId}.png`;
  const screenshotPath = path.join(__dirname, '../../public/screenshots', screenshotFileName);
  
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
      path: screenshotPath,
      type: 'png',
      fullPage: !clipSelector
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
    
    await page.screenshot(screenshotOptions);
    
    const renderingTime = Date.now() - startTime;
    
    // Get browser version
    const browserVersion = await browser.version();
    
    // Create result
    const result = {
      screenshotId,
      screenshotUrl: `/screenshots/${screenshotFileName}`,
      metadata: {
        renderedAt: new Date().toISOString(),
        viewport,
        browserVersion,
        renderingTime
      }
    };
    
    return result;
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