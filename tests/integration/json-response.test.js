/**
 * Tests for JSON response format
 */
const request = require('supertest');
const app = require('../../server');
const { createTestHtml, snapshotConfig } = require('../utils/test-utils');

describe('JSON Response Format', () => {
  test('Should render HTML and return JSON with base64 image and metadata', async () => {
    // Create test content
    const testFixture = createTestHtml({
      text: 'JSON Response Test',
      color: 'purple'
    });

    // Add responseFormat parameter
    const requestBody = {
      ...testFixture,
      responseFormat: 'json'
    };

    // Send request to render HTML with JSON response
    const response = await request(app)
      .post('/render')
      .send(requestBody);

    // Verify response structure
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('image');
    expect(response.body).toHaveProperty('contentType', 'image/png');
    expect(response.body).toHaveProperty('metadata');
    
    // Verify metadata
    const { metadata } = response.body;
    expect(metadata).toHaveProperty('screenshotId');
    expect(metadata).toHaveProperty('renderedAt');
    expect(metadata).toHaveProperty('browserVersion');
    expect(metadata).toHaveProperty('renderingTime');
    expect(typeof metadata.renderingTime).toBe('number');
    
    // Verify viewport matches what we sent
    expect(metadata).toHaveProperty('viewport');
    expect(metadata.viewport).toEqual(testFixture.viewport);
    
    // Verify image is base64 encoded
    expect(typeof response.body.image).toBe('string');
    const imageBuffer = Buffer.from(response.body.image, 'base64');
    expect(imageBuffer.length).toBeGreaterThan(0);
    
    // Check PNG header
    expect(imageBuffer[0]).toBe(0x89);
    expect(imageBuffer[1]).toBe(0x50); // P
    expect(imageBuffer[2]).toBe(0x4E); // N
    expect(imageBuffer[3]).toBe(0x47); // G
    
    // Compare with baseline image snapshot
    expect(imageBuffer).toMatchImageSnapshot(snapshotConfig);
  }, 15000);

  test('Should include all metadata fields in JSON response', async () => {
    // Create test content
    const testFixture = createTestHtml({
      text: 'Metadata Test',
      viewport: { width: 640, height: 480, deviceScaleFactor: 1.5 }
    });

    // Send request with JSON response format
    const response = await request(app)
      .post('/render')
      .send({
        ...testFixture,
        responseFormat: 'json'
      });

    // Verify detailed metadata fields
    expect(response.statusCode).toBe(200);
    const { metadata } = response.body;
    
    // Required fields
    expect(metadata).toHaveProperty('screenshotId');
    expect(typeof metadata.screenshotId).toBe('string');
    expect(metadata.screenshotId.length).toBeGreaterThan(8);
    
    expect(metadata).toHaveProperty('renderedAt');
    expect(new Date(metadata.renderedAt)).toBeInstanceOf(Date);
    
    expect(metadata).toHaveProperty('renderingTime');
    expect(typeof metadata.renderingTime).toBe('number');
    expect(metadata.renderingTime).toBeGreaterThan(0);
    
    expect(metadata).toHaveProperty('browserVersion');
    expect(typeof metadata.browserVersion).toBe('string');
    expect(metadata.browserVersion).toContain('136.0.7103.25');
    
    // Viewport settings
    expect(metadata.viewport).toEqual({
      width: 640,
      height: 480,
      deviceScaleFactor: 1.5
    });
  }, 15000);
});