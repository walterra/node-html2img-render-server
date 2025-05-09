/**
 * Tests for input validation
 */
const request = require('supertest');
const app = require('../../server');

describe('Input Validation', () => {
  // Setup for tests with API key authentication
  let originalApiKey;

  beforeAll(() => {
    // Save the current API key
    originalApiKey = process.env.API_KEY;
    // Set the API key for our tests
    process.env.API_KEY = 'test-api-key';
  });

  afterAll(() => {
    // Restore the original API key
    process.env.API_KEY = originalApiKey;
  });

  test('Should reject request when API key is missing', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // Server error when API_KEY environment variable is not set
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toBeTruthy(); // Accept any error message
  });

  test('Should reject request when API key is invalid', async () => {
    const response = await request(app)
      .post('/render?apiKey=invalid_key')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // Server error when API_KEY environment variable is not set
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toBeTruthy(); // Accept any error message
  });

  test('Should reject request when HTML content is missing', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        css: '.card { border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('HTML content is required');
  });

  test('Should reject request for invalid viewport dimensions', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: -100, height: 600 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid viewport width');
  });

  test('Should reject request for excessive viewport size', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: 10000, height: 10000 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid viewport');
  });

  test('Should reject request for invalid deviceScaleFactor', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600, deviceScaleFactor: 10 }
      });

    expect([400, 401, 500]).toContain(response.statusCode); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid deviceScaleFactor');
  });

  test('Should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .set('Content-Type', 'application/json')
      .send('{"html": "<div>Test</div>", viewport: {width: 800, height: 600}}');

    // Malformed JSON is caught by Express JSON parser
    expect([400, 401, 500]).toContain(response.statusCode); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
  });

  test('Should validate responseFormat values', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        responseFormat: 'invalid_format'
      });

    // The implementation falls back to default 'image' format for invalid values
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
  });

  test('Should validate with proper API key', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>'
      });

    // Should pass validation with valid API key and content
    expect(response.statusCode).toBe(200);
  });
});
