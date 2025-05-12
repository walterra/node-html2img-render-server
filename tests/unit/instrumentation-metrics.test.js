/**
 * Tests for instrumentation metrics utilities
 */
const { recordRenderMetrics } = require('../../src/instrumentation/metrics');

// Mock the modules we need to test
jest.mock('../../src/instrumentation/telemetry', () => {
  return {
    getMeter: jest.fn().mockReturnValue({
      createCounter: jest.fn().mockReturnValue({
        add: jest.fn()
      }),
      createHistogram: jest.fn().mockReturnValue({
        record: jest.fn()
      })
    })
  };
});

// Get the actual implementation of metrics module, which will use our mock
const metrics = require('../../src/instrumentation/metrics');

describe('Instrumentation Metrics', () => {
  let mockCounter, mockHistogram;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get references to the mocked objects
    const telemetry = require('../../src/instrumentation/telemetry');
    const mockMeter = telemetry.getMeter();
    mockCounter = mockMeter.createCounter();
    mockHistogram = mockMeter.createHistogram();

    // Reset the add and record mocks
    mockCounter.add.mockClear();
    if (mockHistogram.record) {
      mockHistogram.record.mockClear();
    }
  });

  describe('recordRenderMetrics', () => {
    test('should record successful render metrics', () => {
      // Call recordRenderMetrics with success data
      metrics.recordRenderMetrics({
        format: 'png',
        durationMs: 150,
        sizeBytes: 65536
      });

      // Verify counter was incremented
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        format: 'png',
        status: 'success'
      });

      // Verify histograms were recorded
      expect(mockHistogram.record).toHaveBeenCalledTimes(2);
    });

    test('should record error render metrics', () => {
      // Reset mocks
      mockCounter.add.mockClear();
      mockHistogram.record.mockClear();

      // Call recordRenderMetrics with error data
      metrics.recordRenderMetrics({
        format: 'jpeg',
        error: true
      });

      // Verify counter was incremented with error status
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        format: 'jpeg',
        status: 'error'
      });

      // Verify histograms were not recorded for errors
      expect(mockHistogram.record).not.toHaveBeenCalled();
    });

    test('should not record histograms if values are missing', () => {
      // Reset mocks
      mockCounter.add.mockClear();
      mockHistogram.record.mockClear();

      // Call recordRenderMetrics with minimal data
      metrics.recordRenderMetrics({
        format: 'png'
      });

      // Verify counter was incremented
      expect(mockCounter.add).toHaveBeenCalledWith(1, {
        format: 'png',
        status: 'success'
      });

      // Since durationMs and sizeBytes are missing, histograms should not be recorded
      expect(mockHistogram.record).not.toHaveBeenCalled();
    });
  });
});
