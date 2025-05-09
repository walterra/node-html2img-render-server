/**
 * Tests for custom font rendering with snapshot comparison
 */
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../server');
const { parseBinaryResponse, snapshotConfig } = require('../utils/test-utils');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

// Configure jest-image-snapshot
expect.extend({ toMatchImageSnapshot });

// Load the actual font for testing
const TEST_FONT_BASE64 = fs.readFileSync(
  path.join(__dirname, '../fonts/tagesschrift/tagesschrift-base64.txt'),
  'utf8'
);

describe('Font Rendering Snapshots', () => {
  test('Should render text with custom font matching snapshot', async () => {
    // Create HTML that explicitly uses the custom font
    const html = `
      <div class="custom-font-sample">
        <div class="heading">Tagesschrift Font</div>
        <div class="sample-text">ABCDEFGHIJKLM</div>
        <div class="sample-text">NOPQRSTUVWXYZ</div>
        <div class="sample-text">abcdefghijklm</div>
        <div class="sample-text">nopqrstuvwxyz</div>
        <div class="sample-text">0123456789</div>
      </div>
    `;

    const css = `
      .custom-font-sample {
        font-family: 'TagesschriftFont', sans-serif;
        background-color: white;
        padding: 20px;
        width: 500px;
        text-align: center;
        border: 1px solid #ccc;
      }
      .heading {
        font-size: 24px;
        margin-bottom: 10px;
        font-weight: bold;
      }
      .sample-text {
        font-size: 20px;
        margin: 10px 0;
        letter-spacing: 2px;
      }
    `;

    // Include the custom font in the request
    const fonts = [
      {
        name: 'TagesschriftFont',
        data: TEST_FONT_BASE64,
        weight: '400',
        style: 'normal'
      }
    ];

    // Add some delay to ensure font is properly loaded
    const renderDelay = 200;

    // Perform the request to get the rendered image
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html,
        css,
        fonts,
        viewport: { width: 600, height: 400 },
        renderDelay
      })
      .buffer()
      .parse(parseBinaryResponse);

    // Verify we got a valid response
    expect(response.statusCode).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);

    // Compare the image against the snapshot
    expect(response.body).toMatchImageSnapshot({
      ...snapshotConfig,
      customSnapshotIdentifier: 'custom-font-rendering',
      // Make the comparison slightly more forgiving because font rendering
      // can vary slightly across environments and runs
      failureThreshold: 0.01,
      failureThresholdType: 'percent'
    });
  }, 30000); // Longer timeout for font rendering
});
