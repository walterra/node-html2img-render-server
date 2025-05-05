/**
 * Tests for basic HTML rendering functionality
 */
const request = require('supertest');
const app = require('../../server');
const {
  parseBinaryResponse,
  createTestHtml,
  snapshotConfig,
  authenticatedRequest
} = require('../utils/test-utils');

describe('Basic HTML Rendering', () => {
  test('Should render HTML and return image data directly', async () => {
    // Create test content
    const testFixture = createTestHtml({
      text: 'Basic Render Test',
      color: 'darkblue'
    });

    // Send request to render HTML
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture)
      .buffer()
      .parse(parseBinaryResponse);

    // Verify response status and headers
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers).toHaveProperty('x-screenshot-id');
    expect(response.headers).toHaveProperty('x-rendering-time');
    expect(response.headers).toHaveProperty('x-browser-version');
    expect(response.headers).toHaveProperty('x-rendered-at');
    expect(response.headers).toHaveProperty('x-viewport-width');
    expect(response.headers).toHaveProperty('x-viewport-height');
    
    // Check that we got a valid PNG buffer
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Verify PNG header bytes
    expect(response.body[0]).toBe(0x89);
    expect(response.body[1]).toBe(0x50); // P
    expect(response.body[2]).toBe(0x4E); // N
    expect(response.body[3]).toBe(0x47); // G
    
    // Compare with baseline image
    expect(response.body).toMatchImageSnapshot(snapshotConfig);
  }, 15000); // Extend timeout for rendering

  test('Should render with custom viewport dimensions', async () => {
    // Create test content with custom viewport
    const testFixture = createTestHtml({
      text: 'Custom Viewport Test',
      width: 500,
      height: 300,
      color: 'darkgreen',
      viewport: { width: 600, height: 400, deviceScaleFactor: 2 }
    });

    // Send request to render HTML
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture)
      .buffer()
      .parse(parseBinaryResponse);

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-viewport-width']).toBe('600');
    expect(response.headers['x-viewport-height']).toBe('400');
    expect(response.headers['x-viewport-devicescalefactor']).toBe('2');
    
    // Compare with baseline image
    expect(response.body).toMatchImageSnapshot(snapshotConfig);
  }, 15000);

  test('Should clip to selected element', async () => {
    // HTML with multiple elements, but we'll clip to just one
    const html = `
      <div style="padding: 50px; background-color: lightgray;">
        <div id="target" style="width: 200px; height: 100px; background-color: coral; padding: 20px;">
          Clipped Element
        </div>
        <div style="width: 300px; height: 150px; background-color: lightblue; margin-top: 20px;">
          Should Not Be Visible
        </div>
      </div>
    `;

    // Send request with clipSelector
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        clipSelector: '#target',
        viewport: { width: 800, height: 600 }
      })
      .buffer()
      .parse(parseBinaryResponse);

    // Verify response
    expect(response.statusCode).toBe(200);
    
    // The clipped image should be smaller than a full page
    expect(response.body).toMatchImageSnapshot(snapshotConfig);
  }, 15000);

  test('Should wait for dynamic content', async () => {
    // HTML with content that appears after a delay
    const html = `
      <div id="container" style="width: 300px; height: 200px; background-color: #f0f0f0;">
        <div id="loading">Loading...</div>
        <div id="content" style="display: none; color: green;">Content Loaded!</div>
      </div>
      <script>
        setTimeout(() => {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('content').style.display = 'block';
        }, 500);
      </script>
    `;

    // Send request with waitForSelector
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        waitForSelector: '#content[style*="display: block"]',
        viewport: { width: 400, height: 300 }
      })
      .buffer()
      .parse(parseBinaryResponse);

    // Verify response
    expect(response.statusCode).toBe(200);
    
    // The image should show the loaded content
    expect(response.body).toMatchImageSnapshot(snapshotConfig);
  }, 15000);
});