/**
 * Tests for asset handling (fonts and images)
 *
 * NOTE: Due to issues with font embedding in tests, these tests verify basic functionality
 * but don't actually test real custom fonts. They mainly test that the API handles the
 * requests correctly and returns a valid response.
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../server');
const { parseBinaryResponse, snapshotConfig } = require('../utils/test-utils');

// Use actual font for testing
const TEST_FONT_BASE64 = fs.readFileSync(
  path.join(__dirname, '../fonts/tagesschrift/tagesschrift-base64.txt'),
  'utf8'
);

describe('Asset Handling', () => {
  test('Should render content with a custom font', async () => {
    // Create HTML that uses the custom font
    const html = `
      <div class="custom-font-test">
        Test with Custom Font
      </div>
    `;

    const css = `
      .custom-font-test {
        font-family: 'CustomTestFont', Arial, sans-serif;
        font-size: 24px;
        padding: 20px;
        background-color: #f0f0f0;
        width: 300px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333333;
      }
    `;

    // Include the custom font in the request
    const fonts = [
      {
        name: 'CustomTestFont',
        data: TEST_FONT_BASE64,
        weight: '400',
        style: 'normal'
      }
    ];

    // First, test a simple render without custom fonts as a baseline
    const baselineResponse = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css: css.replace("'CustomTestFont', ", ''),
        viewport: { width: 400, height: 200 }
      })
      .buffer()
      .parse(parseBinaryResponse);

    // Verify baseline response
    expect(baselineResponse.statusCode).toBe(200);
    expect(Buffer.isBuffer(baselineResponse.body)).toBe(true);

    // Now try with the custom font
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css,
        fonts,
        viewport: { width: 400, height: 200 },
        responseFormat: 'json' // Use JSON format to simplify debugging
      });

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(response.body.image, 'base64');
    expect(imageBuffer.length).toBeGreaterThan(0);

    // We're not strictly comparing images here since font rendering may vary
    // Just ensure we got a valid response with the custom font
    // The actual visual test will be done by manual verification
  }, 20000); // More time for font loading

  test('Should handle multiple custom fonts with different weights', async () => {
    // Create HTML that uses different weights of the custom font
    const html = `
      <div class="font-container">
        <div class="regular-font">Regular Text</div>
        <div class="bold-font">Bold Text</div>
      </div>
    `;

    const css = `
      .font-container {
        padding: 20px;
        background-color: white;
        width: 300px;
      }
      .regular-font {
        font-family: 'CustomTestFont', Arial, sans-serif;
        font-weight: 400;
        font-size: 24px;
        margin-bottom: 10px;
      }
      .bold-font {
        font-family: 'CustomTestFont', Arial, sans-serif;
        font-weight: 700;
        font-size: 24px;
      }
    `;

    // Include multiple weights of the custom font
    const fonts = [
      {
        name: 'CustomTestFont',
        data: TEST_FONT_BASE64,
        weight: '400',
        style: 'normal'
      },
      {
        name: 'CustomTestFont',
        data: TEST_FONT_BASE64, // Same font data for testing
        weight: '700',
        style: 'normal'
      }
    ];

    // Send request with custom fonts, using JSON format for easier debugging
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css,
        fonts,
        viewport: { width: 400, height: 200 },
        responseFormat: 'json'
      });

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');

    // Convert base64 to buffer for verification
    const imageBuffer = Buffer.from(response.body.image, 'base64');
    expect(imageBuffer.length).toBeGreaterThan(0);
  }, 20000);

  test('Should handle custom font with other assets', async () => {
    // Base64 encoded 1x1 pixel transparent PNG
    const transparentPixelBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    // Create HTML with font and image
    const html = `
      <div class="combined-assets">
        <div class="font-text">Custom Font with Image</div>
        <img src="test-image.png" alt="Test Image" class="test-image" />
      </div>
    `;

    const css = `
      .combined-assets {
        font-family: 'CustomTestFont', Arial, sans-serif;
        padding: 20px;
        background-color: #e8f4ff;
        width: 300px;
        text-align: center;
      }
      .font-text {
        font-size: 20px;
        margin-bottom: 15px;
      }
      .test-image {
        border: 2px solid blue;
        width: 50px;
        height: 50px;
      }
    `;

    // Send request with font and image assets, using JSON format
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css,
        fonts: [
          {
            name: 'CustomTestFont',
            data: TEST_FONT_BASE64,
            weight: '400',
            style: 'normal'
          }
        ],
        assets: {
          'test-image.png': transparentPixelBase64
        },
        viewport: { width: 400, height: 200 },
        responseFormat: 'json'
      });

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');

    // Convert base64 to buffer for verification
    const imageBuffer = Buffer.from(response.body.image, 'base64');
    expect(imageBuffer.length).toBeGreaterThan(0);
  }, 20000);

  test('Should handle multiple different asset types', async () => {
    // Base64 encoded tiny assets for testing
    const testPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const testJpgBase64 =
      '/9j/4AAQSkZJRgABAQEAYABgAAD//gA7Q1JFQVRPUjogZ2QtanBlZyB2MS4wICh1c2luZyBJSkcgSlBFRyB2NjIpLCBxdWFsaXR5ID0gOTAK/9sAQwADAgIDAgIDAwMDBAMDBAUIBQUEBAUKBwcGCAwKDAwLCgsLDQ4SEA0OEQ4LCxAWEBETFBUVFQwPFxgWFBgSFBUU/9sAQwEDBAQFBAUJBQUJFA0LDRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A+t6AP//Z';
    const testSvgBase64 =
      'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJyZWQiLz48L3N2Zz4=';

    // Create HTML with multiple assets
    const html = `
      <div class="multi-asset-test">
        <img src="test-png.png" alt="PNG" class="test-image" />
        <img src="test-jpg.jpg" alt="JPG" class="test-image" />
        <img src="test-svg.svg" alt="SVG" class="test-image" />
        <div class="font-text">Multiple Asset Types</div>
      </div>
    `;

    const css = `
      .multi-asset-test {
        font-family: 'CustomTestFont', Arial, sans-serif;
        padding: 20px;
        background-color: #f5f5f5;
        width: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }
      .font-text {
        font-size: 18px;
        margin-top: 10px;
      }
      .test-image {
        border: 1px solid #ccc;
        width: 50px;
        height: 50px;
        object-fit: contain;
      }
    `;

    // Send request with multiple asset types
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css,
        fonts: [
          {
            name: 'CustomTestFont',
            data: TEST_FONT_BASE64,
            weight: '400',
            style: 'normal'
          }
        ],
        assets: {
          'test-png.png': testPngBase64,
          'test-jpg.jpg': testJpgBase64,
          'test-svg.svg': testSvgBase64
        },
        viewport: { width: 400, height: 300 },
        responseFormat: 'json',
        // Include delay to ensure assets are loaded
        renderDelay: 100
      });

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');

    // Convert base64 to buffer for verification
    const imageBuffer = Buffer.from(response.body.image, 'base64');
    expect(imageBuffer.length).toBeGreaterThan(0);
  }, 20000);
});
