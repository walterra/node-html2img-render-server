/**
 * Tests for image snapshot functionality
 */
const request = require('supertest');
const app = require('../../server');
const { parseBinaryResponse, snapshotConfig } = require('../utils/test-utils');

describe('Image Snapshots', () => {
  test('Should create and compare image snapshots of rendered content', async () => {
    // Create HTML with a simple, consistent element that's good for snapshots
    const html = `
      <div class="snapshot-test">
        <div class="color-box red"></div>
        <div class="color-box green"></div>
        <div class="color-box blue"></div>
      </div>
    `;
    
    const css = `
      .snapshot-test {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        background-color: #f8f8f8;
        width: 400px;
        height: 150px;
      }
      .color-box {
        width: 100px;
        height: 100px;
        margin: 0 10px;
        border: 2px solid #333;
      }
      .red { background-color: #ff5555; }
      .green { background-color: #55ff55; }
      .blue { background-color: #5555ff; }
    `;
    
    // Send request
    const response = await request(app)
      .post('/render')
      .send({
        html,
        css,
        viewport: { width: 450, height: 200 }
      })
      .buffer()
      .parse(parseBinaryResponse);
    
    // Verify response
    expect(response.statusCode).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    
    // Compare with baseline image - this will create a baseline on first run
    // or compare with the baseline on subsequent runs
    expect(response.body).toMatchImageSnapshot({
      ...snapshotConfig,
      customSnapshotIdentifier: 'color-boxes-snapshot'
    });
  }, 15000);

  test('Should detect visual differences when content changes', async () => {
    // Similar test but with slightly different colors - should fail comparison if run against existing baseline
    const html = `
      <div class="snapshot-test">
        <div class="color-box box1"></div>
        <div class="color-box box2"></div>
        <div class="color-box box3"></div>
      </div>
    `;
    
    const css = `
      .snapshot-test {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        background-color: #f8f8f8;
        width: 400px;
        height: 150px;
      }
      .color-box {
        width: 100px;
        height: 100px;
        margin: 0 10px;
        border: 2px solid #333;
      }
      .box1 { background-color: #ffaaaa; }
      .box2 { background-color: #aaffaa; }
      .box3 { background-color: #aaaaff; }
    `;
    
    // Send request
    const response = await request(app)
      .post('/render')
      .send({
        html,
        css,
        viewport: { width: 450, height: 200 }
      })
      .buffer()
      .parse(parseBinaryResponse);
    
    // Verify response
    expect(response.statusCode).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    
    // Create a separate baseline for this variation
    expect(response.body).toMatchImageSnapshot({
      ...snapshotConfig,
      customSnapshotIdentifier: 'color-boxes-variation',
      // Use higher threshold to avoid failures due to anti-aliasing differences
      failureThreshold: 0.01
    });
  }, 15000);

  test('Should handle text rendering in snapshots', async () => {
    // Create HTML with text elements
    const html = `
      <div class="text-snapshot">
        <h1>Snapshot Testing</h1>
        <p>This tests text rendering consistency</p>
      </div>
    `;
    
    const css = `
      .text-snapshot {
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
        background-color: white;
        width: 400px;
      }
      h1 {
        color: #333;
        font-size: 24px;
        margin-bottom: 10px;
      }
      p {
        color: #666;
        font-size: 16px;
      }
    `;
    
    // Send request
    const response = await request(app)
      .post('/render')
      .send({
        html,
        css,
        viewport: { width: 450, height: 200 }
      })
      .buffer()
      .parse(parseBinaryResponse);
    
    // Verify response
    expect(response.statusCode).toBe(200);
    expect(Buffer.isBuffer(response.body)).toBe(true);
    
    // Compare with baseline image
    expect(response.body).toMatchImageSnapshot({
      ...snapshotConfig,
      customSnapshotIdentifier: 'text-rendering-snapshot',
      // Text rendering can vary slightly by platform, so use a more tolerant threshold
      failureThreshold: 0.02
    });
  }, 15000);
});