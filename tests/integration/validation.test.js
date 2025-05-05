/**
 * Tests for input validation
 */
const request = require('supertest');
const app = require('../../server');

describe('Input Validation', () => {
  test('Should return 400 when HTML content is missing', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        css: '.card { border: 1px solid #ccc; }',
        viewport: { width: 800, height: 600 }
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('HTML content is required');
  });

  test('Should validate viewport dimensions', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: -100, height: 600 }
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
  
  test('Should validate maximum viewport size', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 10000, height: 10000 }
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('Should validate deviceScaleFactor range', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600, deviceScaleFactor: 10 }
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('Should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/render')
      .set('Content-Type', 'application/json')
      .send('{"html": "<div>Test</div>", viewport: {width: 800, height: 600}}');

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty('error');
  });

  test('Should validate responseFormat values', async () => {
    const response = await request(app)
      .post('/render')
      .send({
        html: '<div>Test</div>',
        responseFormat: 'invalid_format'
      });

    // This might return 400 if you validate responseFormat, or might use the default
    // format if you allow unknown values to fall back to default
    if (response.statusCode === 400) {
      expect(response.body).toHaveProperty('error');
    } else {
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    }
  });
});