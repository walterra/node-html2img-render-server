const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const { toMatchImageSnapshot } = require('jest-image-snapshot');

expect.extend({ toMatchImageSnapshot });

describe('Render API', () => {
  // Basic render functionality test for direct image response
  test('Should render HTML and return image data directly', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div class="test-card">Hello World</div>',
        css: '.test-card { padding: 20px; border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600, deviceScaleFactor: 1 }
      })
      .buffer()
      .parse((res, callback) => {
        res.setEncoding('binary');
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          callback(null, Buffer.from(data, 'binary'));
        });
      });

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
    // PNG files start with these hex values
    expect(response.body[0]).toBe(0x89);
    expect(response.body[1]).toBe(0x50); // P
    expect(response.body[2]).toBe(0x4E); // N
    expect(response.body[3]).toBe(0x47); // G
  }, 15000); // Extend timeout to allow for rendering

  // Test image snapshot matching
  test('Should generate consistent image snapshots', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div style="width:200px;height:100px;background-color:blue;"></div>',
        viewport: { width: 400, height: 200 }
      })
      .buffer()
      .parse((res, callback) => {
        res.setEncoding('binary');
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          callback(null, Buffer.from(data, 'binary'));
        });
      });

    expect(response.statusCode).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    
    // This creates or compares against a baseline image
    expect(response.body).toMatchImageSnapshot({
      customSnapshotsDir: path.join(__dirname, 'snapshots'),
      customDiffDir: path.join(__dirname, 'snapshots', 'diffs')
    });
  }, 15000);

  // Test for JSON response format
  test('Should render HTML and return JSON with base64 image and metadata', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div class="test-card">Hello World</div>',
        css: '.test-card { padding: 20px; border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600, deviceScaleFactor: 1 },
        responseFormat: 'json'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('contentType', 'image/png');
    expect(response.body).toHaveProperty('metadata');
    expect(response.body.metadata).toHaveProperty('screenshotId');
    expect(response.body.metadata).toHaveProperty('renderedAt');
    expect(response.body.metadata).toHaveProperty('viewport');
    expect(response.body.metadata).toHaveProperty('browserVersion');
    expect(response.body.metadata).toHaveProperty('renderingTime');
    
    // Validate that image is base64 encoded
    expect(typeof response.body.image).toBe('string');
    const buffer = Buffer.from(response.body.image, 'base64');
    expect(buffer.length).toBeGreaterThan(0);
  }, 15000);

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
        viewport: { width: 800, height: 600 },
        responseFormat: 'json'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');
    expect(response.body.metadata).toHaveProperty('screenshotId');
    
    // Validate that image is base64 encoded
    const buffer = Buffer.from(response.body.image, 'base64');
    expect(buffer.length).toBeGreaterThan(0);
  }, 15000);

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
});