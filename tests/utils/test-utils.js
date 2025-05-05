/**
 * Common test utilities for the html2img-render-server
 */
const path = require('path');
const { PNG } = require('pngjs');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

// Extend Jest with custom matchers
expect.extend({ toMatchImageSnapshot });

// Set a test API key for all tests
process.env.API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';

/**
 * Custom request parser for binary responses
 * @param {Object} res - Response object from supertest
 * @param {Function} callback - Callback function
 */
function parseBinaryResponse(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    callback(null, Buffer.from(data, 'binary'));
  });
}

/**
 * Parse PNG metadata from image buffer
 * @param {Buffer} buffer - Image buffer
 * @returns {Object|null} - Parsed metadata or null if not found
 */
function extractMetadataFromPng(buffer) {
  try {
    const png = PNG.sync.read(buffer);
    if (png.text && png.text.metadata) {
      return JSON.parse(png.text.metadata);
    }
    console.log('No metadata found in PNG:', png.text);
    return null;
  } catch (error) {
    console.error('Error parsing PNG metadata:', error);
    return null;
  }
}

/**
 * Extract metadata from HTTP headers
 * @param {Object} headers - HTTP response headers
 * @param {Object} viewport - Original viewport settings
 * @returns {Object} - Metadata object
 */
function extractMetadataFromHeaders(headers, viewport) {
  return {
    screenshotId: headers['x-screenshot-id'],
    renderedAt: headers['x-rendered-at'],
    renderingTime: parseInt(headers['x-rendering-time'] || '0'),
    browserVersion: headers['x-browser-version'],
    viewport: {
      width: parseInt(headers['x-viewport-width'] || viewport.width),
      height: parseInt(headers['x-viewport-height'] || viewport.height),
      deviceScaleFactor: parseFloat(headers['x-viewport-devicescalefactor'] || viewport.deviceScaleFactor || 1)
    }
  };
}

/**
 * Create a simple HTML test fixture
 * @param {Object} options - Options for the HTML
 * @returns {Object} - The HTML, CSS and options for the test
 */
function createTestHtml(options = {}) {
  const width = options.width || 300;
  const height = options.height || 200;
  const bgColor = options.color || 'cornflowerblue';
  const text = options.text || 'Test Content';
  const viewport = options.viewport || { width: width + 100, height: height + 100, deviceScaleFactor: 1 };
  
  return {
    html: `<div class="test-element">${text}</div>`,
    css: `.test-element { 
      width: ${width}px; 
      height: ${height}px; 
      background-color: ${bgColor}; 
      color: white; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-family: sans-serif;
      font-size: 18px;
    }`,
    viewport
  };
}

/**
 * Configuration for snapshot testing
 */
const snapshotConfig = {
  customSnapshotsDir: path.join(__dirname, '../snapshots'),
  customDiffDir: path.join(__dirname, '../snapshots/diffs'),
  failureThreshold: 0.01,
  failureThresholdType: 'percent'
};

/**
 * Helper function to add API key to request URL
 * @param {Object} request - Supertest request object
 * @param {string} path - API endpoint path
 * @returns {Object} - Request with API key
 */
function authenticatedRequest(request, path) {
  return request(`${path}?apiKey=${process.env.API_KEY}`);
}

module.exports = {
  parseBinaryResponse,
  extractMetadataFromPng,
  extractMetadataFromHeaders,
  createTestHtml,
  snapshotConfig,
  authenticatedRequest
};