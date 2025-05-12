/**
 * Metrics collection and recording utilities
 */

const { getMeter } = require('./telemetry');

/**
 * Create and initialize metrics for the renderer component
 */
function createRendererMetrics() {
  const meter = getMeter('renderer');
  
  // Initialize counters
  const renderCounter = meter.createCounter('html_render_count', {
    description: 'Count of HTML rendering operations'
  });
  
  // Initialize histograms
  const renderDurationHistogram = meter.createHistogram('html_render_duration_ms', {
    description: 'Duration of HTML rendering operations in milliseconds',
    unit: 'ms'
  });
  
  const screenshotSizeHistogram = meter.createHistogram('screenshot_size_bytes', {
    description: 'Size of generated screenshots in bytes',
    unit: 'By'
  });
  
  return {
    renderCounter,
    renderDurationHistogram,
    screenshotSizeHistogram
  };
}

// Export metrics objects
const rendererMetrics = createRendererMetrics();

/**
 * Record rendering metrics
 * @param {Object} data - Metrics data
 * @param {string} data.format - Image format (png, jpeg)
 * @param {number} data.durationMs - Rendering duration in milliseconds
 * @param {number} data.sizeBytes - Size of the screenshot in bytes
 */
function recordRenderMetrics(data) {
  const { format, durationMs, sizeBytes, error = false } = data;
  
  // Record render count by format and status
  rendererMetrics.renderCounter.add(1, { 
    format, 
    status: error ? 'error' : 'success' 
  });
  
  // Only record duration and size for successful renders
  if (!error) {
    // Record render duration
    rendererMetrics.renderDurationHistogram.record(durationMs, { format });
    
    // Record screenshot size
    rendererMetrics.screenshotSizeHistogram.record(sizeBytes, { format });
  }
}

module.exports = {
  createRendererMetrics,
  recordRenderMetrics
};