const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

describe('Render API', () => {
  // Basic render functionality test
  test('Should render HTML and return screenshot URL', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div class="test-card">Hello World</div>',
        css: '.test-card { padding: 20px; border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600, deviceScaleFactor: 1 }
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('screenshotId');
    expect(response.body).toHaveProperty('screenshotUrl');
    expect(response.body).toHaveProperty('metadata');
    expect(response.body.metadata).toHaveProperty('renderedAt');
    expect(response.body.metadata).toHaveProperty('browserVersion');
  }, 10000); // Extend timeout to allow for rendering

  // Test selector functionality
  test('Should wait for selector and clip to it', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: `
          <div id="container">
            <div class="test-element" style="width: 200px; height: 100px; background-color: #f0f0f0;">
              Test Element
            </div>
          </div>
        `,
        waitForSelector: '.test-element',
        clipSelector: '.test-element',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('screenshotId');
  }, 10000);

  // Test input validation
  test('Should return 400 when HTML content is missing', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        css: '.card { border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(400);
  });

  // Test invalid viewport values
  test('Should validate viewport dimensions', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: -100, height: 600 }
      });

    expect(response.statusCode).toBe(400);
  });

  // Test screenshot URL endpoint
  test('Should redirect to screenshot URL', async () => {
    // First create a screenshot
    const renderResponse = await request(app)
      .post('/render')
      .send({
        html: '<div>Test redirect</div>'
      });

    const screenshotId = renderResponse.body.screenshotId;
    
    // Then try to access it via the screenshot endpoint
    const response = await request(app)
      .get(`/render/screenshot/${screenshotId}`);
    
    // Should redirect to the actual file
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(`/screenshots/${screenshotId}.png`);
  });
});