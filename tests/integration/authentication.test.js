/**
 * Tests for API authentication functionality
 */
const request = require('supertest');
const app = require('../../server');
const { createTestHtml } = require('../utils/test-utils');

describe('API Authentication', () => {
  // Set up API key for testing
  let originalApiKey;

  beforeAll(() => {
    // Save original API key
    originalApiKey = process.env.API_KEY;
    // Set test API key
    process.env.API_KEY = 'test-api-key';
  });

  afterAll(() => {
    // Restore original API key
    process.env.API_KEY = originalApiKey;
  });
  test('Should reject requests without API key', async () => {
    // Create test content
    const testFixture = createTestHtml();

    // Send request without API key
    const response = await request(app).post('/render').send(testFixture);

    // Verify response status
    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toBe('API key is required');
  });

  test('Should reject requests with invalid API key', async () => {
    // Create test content
    const testFixture = createTestHtml();

    // Send request with invalid API key
    const response = await request(app).post('/render?apiKey=invalid-key').send(testFixture);

    // Verify response status
    expect(response.statusCode).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.message).toBe('Invalid API key');
  });

  test('Should accept requests with valid API key', async () => {
    // Create test content
    const testFixture = createTestHtml();

    // Send request with valid API key
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture);

    // Verify successful response status
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
  });
});
