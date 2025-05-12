/**
 * Tests for telemetry utilities
 */
const {
  getTracer,
  getMeter,
  createTracedFunction,
  createTracedMiddleware,
  createInstrumentedRouter,
  recordRenderMetrics
} = require('../../src/utils/telemetry');

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => {
  // Mock span implementation
  const mockSpan = {
    setAttribute: jest.fn(),
    addEvent: jest.fn(),
    recordException: jest.fn(),
    setStatus: jest.fn(),
    end: jest.fn(),
    isRecording: jest.fn().mockReturnValue(true)
  };

  // Mock tracer implementation
  const mockTracer = {
    startSpan: jest.fn().mockReturnValue(mockSpan),
    startActiveSpan: jest.fn((name, callback) => callback(mockSpan))
  };

  // Mock counter implementation
  const mockCounter = {
    add: jest.fn()
  };

  // Mock histogram implementation
  const mockHistogram = {
    record: jest.fn()
  };

  // Mock meter implementation
  const mockMeter = {
    createCounter: jest.fn().mockReturnValue(mockCounter),
    createHistogram: jest.fn().mockReturnValue(mockHistogram)
  };

  return {
    trace: {
      getTracer: jest.fn().mockReturnValue(mockTracer),
      getActiveSpan: jest.fn().mockReturnValue(mockSpan)
    },
    metrics: {
      getMeter: jest.fn().mockReturnValue(mockMeter)
    },
    context: {
      active: jest.fn()
    },
    SpanStatusCode: {
      OK: 'OK',
      ERROR: 'ERROR',
      UNSET: 'UNSET'
    }
  };
});

describe('Telemetry Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getTracer returns a tracer instance with the correct name', () => {
    const { trace } = require('@opentelemetry/api');

    const tracer1 = getTracer();
    expect(trace.getTracer).toHaveBeenCalledWith('node-html2img-render-server');

    const tracer2 = getTracer('renderer');
    expect(trace.getTracer).toHaveBeenCalledWith('node-html2img-render-server.renderer');
  });

  test('getMeter returns a meter instance with the correct name', () => {
    const { metrics } = require('@opentelemetry/api');

    const meter1 = getMeter();
    expect(metrics.getMeter).toHaveBeenCalledWith('node-html2img-render-server');

    const meter2 = getMeter('api');
    expect(metrics.getMeter).toHaveBeenCalledWith('node-html2img-render-server.api');
  });

  test('createTracedFunction wraps a function with tracing', async () => {
    const { trace } = require('@opentelemetry/api');
    const mockSpan = trace.getTracer().startSpan();

    // Function to be traced
    const testFn = jest.fn().mockResolvedValue('result');

    // Create traced version
    const tracedFn = createTracedFunction('test.operation', testFn, {
      component: 'test',
      attributes: {
        'test.attribute': 'test-value',
        'dynamic.attribute': arg1 => arg1
      }
    });

    // Call the traced function
    const result = await tracedFn('input-value');

    // Original function should be called
    expect(testFn).toHaveBeenCalledWith('input-value');

    // Tracer should be created with component name
    expect(trace.getTracer).toHaveBeenCalledWith('node-html2img-render-server.test');

    // Span should be created and configured correctly
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('test.attribute', 'test-value');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('dynamic.attribute', 'input-value');
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 'OK' });
    expect(mockSpan.end).toHaveBeenCalled();

    // Function should return original result
    expect(result).toBe('result');
  });

  test('createTracedFunction correctly handles errors', async () => {
    const { trace, SpanStatusCode } = require('@opentelemetry/api');
    const mockSpan = trace.getTracer().startSpan();

    // Function that throws an error
    const error = new Error('Test error');
    const failingFn = jest.fn().mockRejectedValue(error);

    // Create traced version
    const tracedFn = createTracedFunction('test.failing', failingFn);

    // Call and expect it to throw
    await expect(tracedFn()).rejects.toThrow('Test error');

    // Error should be recorded on the span
    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Test error'
    });
    expect(mockSpan.end).toHaveBeenCalled();
  });

  test('recordRenderMetrics records metrics correctly', () => {
    const { metrics } = require('@opentelemetry/api');
    const mockMeter = metrics.getMeter();
    const mockCounter = mockMeter.createCounter();
    const mockHistogram = mockMeter.createHistogram();

    // Record successful render metrics
    recordRenderMetrics({
      format: 'png',
      durationMs: 100,
      sizeBytes: 50000
    });

    // Counter should be incremented with correct attributes
    expect(mockCounter.add).toHaveBeenCalledWith(1, {
      format: 'png',
      status: 'success'
    });

    // Duration should be recorded in histogram
    expect(mockHistogram.record).toHaveBeenCalledWith(100, {
      format: 'png'
    });

    // Size should be recorded in histogram
    expect(mockHistogram.record).toHaveBeenCalledWith(50000, {
      format: 'png'
    });

    // Clear calls
    jest.clearAllMocks();

    // Record error metrics
    recordRenderMetrics({
      format: 'jpeg',
      error: true
    });

    // Counter should be incremented with error status
    expect(mockCounter.add).toHaveBeenCalledWith(1, {
      format: 'jpeg',
      status: 'error'
    });

    // Histograms should not be recorded for errors
    expect(mockHistogram.record).not.toHaveBeenCalled();
  });

  test('createTracedMiddleware wraps Express middleware with tracing', async () => {
    const { trace, SpanStatusCode } = require('@opentelemetry/api');
    const mockSpan = trace.getTracer().startSpan();

    // Mock Express objects
    const req = {
      method: 'GET',
      originalUrl: '/test',
      path: '/test',
      ip: '127.0.0.1',
      headers: { 'x-request-id': 'test-id' }
    };
    const res = {
      statusCode: 200,
      end: jest.fn(),
      on: jest.fn()
    };
    const next = jest.fn();

    // Mock middleware function
    const middleware = jest.fn((req, res, next) => next());

    // Create traced middleware
    const tracedMiddleware = createTracedMiddleware('test_middleware', middleware, {
      attributesFn: req => ({ 'test.attr': 'test-value' })
    });

    // Call the middleware
    tracedMiddleware(req, res, next);

    // Original middleware should be called
    expect(middleware).toHaveBeenCalled();

    // Span should have attributes
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.method', 'GET');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.url', '/test');
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('test.attr', 'test-value');

    // Simulate response end
    const endCallback = res.end;
    endCallback();

    // Span should be ended with success status
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
    expect(mockSpan.end).toHaveBeenCalled();
  });

  test('createTracedMiddleware handles errors correctly', () => {
    const { trace, SpanStatusCode } = require('@opentelemetry/api');
    const mockSpan = trace.getTracer().startSpan();

    // Mock Express objects
    const req = {
      method: 'GET',
      originalUrl: '/test',
      path: '/test',
      headers: {}, // Add empty headers to avoid errors
      ip: '127.0.0.1'
    };
    const res = { statusCode: 500, end: jest.fn(), on: jest.fn() };
    const next = jest.fn();

    // Create an error
    const error = new Error('Test middleware error');

    // Mock middleware that calls next with an error
    const middleware = jest.fn((req, res, next) => next(error));

    // Create traced middleware
    const tracedMiddleware = createTracedMiddleware('error_middleware', middleware);

    // Call the middleware
    tracedMiddleware(req, res, next);

    // Original middleware should be called
    expect(middleware).toHaveBeenCalled();

    // Span should record error
    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', error.message);
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    expect(mockSpan.end).toHaveBeenCalled();

    // Next should be called with error
    expect(next).toHaveBeenCalledWith(error);
  });

  test('createInstrumentedRouter returns a router with instrumented methods', () => {
    // Create a proper mock for the router methods
    const getMock = jest.fn();
    const postMock = jest.fn();
    const putMock = jest.fn();

    // Mock Express router
    const mockRouter = {
      get: getMock,
      post: postMock,
      put: putMock,
      delete: jest.fn(),
      patch: jest.fn(),
      all: jest.fn(),
      use: jest.fn()
    };

    // Mock Express module
    const mockExpress = {
      Router: jest.fn().mockReturnValue(mockRouter)
    };

    // Create instrumented router
    const router = createInstrumentedRouter('test_module', { express: mockExpress });

    // Express.Router should be called
    expect(mockExpress.Router).toHaveBeenCalled();

    // Router methods should be available
    expect(router.get).toBeDefined();
    expect(router.post).toBeDefined();

    // Test router method wrapping
    const mockHandler = jest.fn();
    router.get('/test', mockHandler);

    // Original router.get should be called
    expect(getMock).toHaveBeenCalled();

    // Path should be preserved
    const firstCallArg = getMock.mock.calls[0][0];
    expect(firstCallArg).toBe('/test');

    // Handler should be wrapped but still a function
    const wrappedHandler = getMock.mock.calls[0][1];
    expect(typeof wrappedHandler).toBe('function');
  });
});
