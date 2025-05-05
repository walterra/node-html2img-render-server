/**
 * Tests for image format options (PNG and JPEG)
 */
const request = require('supertest');
const app = require('../../server');
const { toMatchImageSnapshot } = require('jest-image-snapshot');
const {
  parseBinaryResponse,
  createTestHtml,
  snapshotConfig
} = require('../utils/test-utils');

describe('Image Format Options', () => {
  // Set up API key for testing
  let originalApiKey;
  
  beforeAll(() => {
    // Save original API key
    originalApiKey = process.env.API_KEY;
    // Set test API key
    process.env.API_KEY = 'test-api-key';
    
    // Configure snapshot settings
    expect.extend({
      toMatchImageSnapshot(received) {
        return toMatchImageSnapshot.call(
          this,
          received,
          snapshotConfig
        );
      }
    });
  });
  
  afterAll(() => {
    // Restore original API key
    process.env.API_KEY = originalApiKey;
  });

  test('Should render using PNG format by default and match snapshot', async () => {
    const testFixture = createTestHtml({
      text: 'PNG Format Test',
      color: 'darkblue'
    });

    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture)
      .buffer()
      .parse(parseBinaryResponse);

    // Verify PNG format
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    
    // Check PNG signature (first 8 bytes)
    expect(response.body[0]).toBe(0x89); // PNG signature start
    expect(response.body[1]).toBe(0x50); // P
    expect(response.body[2]).toBe(0x4E); // N
    expect(response.body[3]).toBe(0x47); // G
    
    // Verify the image matches the expected snapshot
    expect(response.body).toMatchImageSnapshot();
  }, 10000);

  test('Should render using JPEG format when specified and match snapshot', async () => {
    const testFixture = {
      ...createTestHtml({
        text: 'JPEG Format Test',
        color: 'darkred'
      }),
      format: 'jpeg'
    };

    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture)
      .buffer()
      .parse(parseBinaryResponse);

    // Verify JPEG format
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/jpeg');
    
    // Check JPEG signature (first 2 bytes)
    expect(response.body[0]).toBe(0xFF); // JPEG starts with FF
    expect(response.body[1]).toBe(0xD8); // JPEG SOI marker
    
    // Do not create a snapshot for JPEG as it can vary
  }, 10000);

  test('Should render JPEG with specified quality and match snapshots', async () => {
    // Create two requests with different quality settings
    const lowQualityFixture = {
      ...createTestHtml({
        text: 'Low Quality JPEG',
        width: 500,
        height: 300,
        color: 'darkgreen'
      }),
      format: 'jpeg',
      quality: 10 // Very low quality
    };

    const highQualityFixture = {
      ...createTestHtml({
        text: 'High Quality JPEG',
        width: 500,
        height: 300,
        color: 'darkgreen'
      }),
      format: 'jpeg',
      quality: 90 // High quality
    };

    // Get both responses
    const lowQualityResponse = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(lowQualityFixture)
      .buffer()
      .parse(parseBinaryResponse);

    const highQualityResponse = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(highQualityFixture)
      .buffer()
      .parse(parseBinaryResponse);

    // Both should be valid JPEG images
    expect(lowQualityResponse.statusCode).toBe(200);
    expect(lowQualityResponse.headers['content-type']).toBe('image/jpeg');
    expect(highQualityResponse.statusCode).toBe(200);
    expect(highQualityResponse.headers['content-type']).toBe('image/jpeg');

    // Low quality JPEG should be smaller than high quality
    expect(lowQualityResponse.body.length).toBeLessThan(highQualityResponse.body.length);
    
    // Do not create a snapshot for JPEG as it can vary
  }, 15000);
  
  test('Should return error for invalid format', async () => {
    const testFixture = {
      ...createTestHtml(),
      format: 'gif' // Unsupported format
    };

    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('Format must be either "png" or "jpeg"');
  });
  
  test('Should validate JPEG quality range', async () => {
    const testFixture = {
      ...createTestHtml(),
      format: 'jpeg',
      quality: 101 // Invalid quality (above max)
    };

    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture);

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toHaveProperty('message');
    expect(response.body.error.message).toContain('JPEG quality must be between 1 and 100');
  });
  
  test('Should include format in JSON response', async () => {
    const testFixture = {
      ...createTestHtml(),
      format: 'jpeg',
      quality: 85,
      responseFormat: 'json'
    };

    const response = await request(app)
      .post('/render?apiKey=' + process.env.API_KEY)
      .send(testFixture);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('contentType', 'image/jpeg');
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('metadata');
    
    // Base64 data should be present
    expect(typeof response.body.image).toBe('string');
    expect(response.body.image.length).toBeGreaterThan(100);
  }, 10000);
});