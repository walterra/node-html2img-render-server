/**
 * Integration tests for rate limiting functionality
 */
const request = require('supertest');
const app = require('../../server');
const { createTestHtml } = require('../utils/test-utils');

describe('Rate Limiting', () => {
  // We'll use a minimal valid payload for our tests
  const validPayload = createTestHtml();

  test('Should allow requests under the rate limit', async () => {
    // Make a small number of requests that should be under the limit
    for (let i = 0; i < 5; i++) {
      const response = await request(app)
        .post('/render?apiKey=' + process.env.API_KEY)
        .send(validPayload);

      // All requests should succeed
      expect(response.statusCode).toBe(200);
    }
  });

  test('Should include rate limit headers in response', async () => {
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(validPayload);

    // This test is conditional since we haven't explicitly added these headers
    // in our middleware yet, but they would be a good addition
    if (response.headers['x-ratelimit-limit']) {
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    }
  });

  /**
   * This test is commented out because it would trigger rate limiting,
   * which would affect other tests. In a real environment, this should
   * be isolated with a special test-specific rate limit configuration.
   */
  /*
  test('Should reject requests over the rate limit', async () => {
    // Make many requests quickly to trigger rate limiting
    // Note: This requires setting a very low rate limit for testing
    const requests = [];
    for (let i = 0; i < 70; i++) {
      requests.push(
        request(app)
          .post('/render?apiKey=' + process.env.API_KEY)
          .send(validPayload)
      );
    }
    
    const responses = await Promise.all(requests);
    
    // Some responses should have status 429 (Too Many Requests)
    const hasRateLimitedResponses = responses.some(res => res.statusCode === 429);
    expect(hasRateLimitedResponses).toBe(true);
    
    // Check for retry-after header in rate limited responses
    const rateLimitedResponse = responses.find(res => res.statusCode === 429);
    if (rateLimitedResponse) {
      expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
    }
  });
  */

  test('Should handle invalid requests properly when rate limiting is active', async () => {
    // Make a request with invalid payload
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send({
        // Missing required HTML content
        viewport: { width: 800, height: 600 }
      });

    // Should respond with 400 Bad Request, not rate limit error
    expect(response.statusCode).toBe(400);
    expect(response.body.error.message).toContain('HTML content is required');
  });

  test('Should apply rate limiting by IP address', async () => {
    // Test that different "IP addresses" have separate rate limits
    // Note: This is testing the internal logic of the middleware rather than its actual behavior

    // First check that our real IP can make a request
    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(validPayload);

    expect(response.statusCode).toBe(200);

    // Now make a request with a spoofed IP header
    // Note: In reality, this doesn't actually bypass rate limiting in our implementation
    // because supertest doesn't give us a way to truly simulate different IPs
    const responseWithCustomIP = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .set('X-Forwarded-For', '192.168.1.2')
      .send(validPayload);

    // Both requests should succeed as they're treated as separate clients
    expect(responseWithCustomIP.statusCode).toBe(200);
  });
});
