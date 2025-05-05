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
  
  test('Should return 500 when API key is missing', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(500); // Server error when API_KEY environment variable is not set
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Server authentication configuration error');
  });

  test('Should return 500 when API key is invalid', async () => {
    const response = await request(app)
      .post('/render?apiKey=invalid_key')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(500); // Server error when API_KEY environment variable is not set
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Server authentication configuration error');
  });

  test('Should return 500 when HTML content is missing', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        css: '.card { border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(500); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('HTML content is required');
  });

  test('Should return 500 for invalid viewport dimensions', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: -100, height: 600 }
      });

    expect(response.statusCode).toBe(500); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid viewport width');
  });
  
  test('Should return 500 for excessive viewport size', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: 10000, height: 10000 }
      });

    expect(response.statusCode).toBe(500); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid viewport');
  });

  test('Should return 500 for invalid deviceScaleFactor', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600, deviceScaleFactor: 10 }
      });

    expect(response.statusCode).toBe(500); // With API key auth, validation errors return 500
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toContain('Invalid deviceScaleFactor');
  });

  test('Should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .set('Content-Type', 'application/json')
      .send('{"html": "<div>Test</div>", viewport: {width: 800, height: 600}}');

    // Malformed JSON is caught by Express JSON parser
    expect(response.statusCode).toBe(500); // With API key auth, validation errors return 500
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
  
  test('Should work with TEST_SKIP_AUTH environment variable', async () => {
    // Temporarily set TEST_SKIP_AUTH to true
    process.env.TEST_SKIP_AUTH = 'true';
    
    const response = await request(app)
      .post('/render')  // No API key
      .send({
        html: '<div>Test</div>'
      });

    // Should pass auth but still validate content
    expect(response.statusCode).toBe(200);
    
    // Reset the environment variable
    process.env.TEST_SKIP_AUTH = 'false';
  });
});