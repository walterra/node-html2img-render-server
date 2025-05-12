/**
 * Tests for instrumentation wrappers
 */
const {
  withTracing,
  withTracedMiddleware,
  createSpanManager
} = require('../../src/instrumentation/wrappers');

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
    startActiveSpan: jest.fn((...args) => {
      // Handle different method signatures gracefully
      const callback = args[args.length - 1];
      return callback(mockSpan);
    })
  };

  return {
    trace: {
      getTracer: jest.fn().mockReturnValue(mockTracer),
      getActiveSpan: jest.fn().mockReturnValue(mockSpan)
    },
    metrics: {
      getMeter: jest.fn()
    },
    SpanStatusCode: {
      OK: 'OK',
      ERROR: 'ERROR',
      UNSET: 'UNSET'
    }
  };
});

describe('Instrumentation Wrappers', () => {
  const { trace, SpanStatusCode } = require('@opentelemetry/api');
  let mockSpan;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpan = trace.getTracer().startSpan();
  });

  describe('withTracing', () => {
    test('should properly wrap a function with tracing', async () => {
      // Function to trace
      const mockFn = jest.fn().mockResolvedValue('result');

      // Create a traced version of the function
      const tracedFn = withTracing({
        name: 'test_function',
        component: 'test',
        attributes: {
          'test.attr': 'test-value',
          'dynamic.attr': (...args) => args[0]
        }
      })(mockFn);

      // Call the traced function
      const result = await tracedFn('input-value', 'another-value');

      // Verify the tracer was created
      expect(trace.getTracer).toHaveBeenCalled();

      // Verify span had the right attributes
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('test.attr', 'test-value');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('dynamic.attr', 'input-value');

      // Verify original function was called with all args
      expect(mockFn).toHaveBeenCalledWith('input-value', 'another-value');

      // Verify span was properly completed
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify result was passed through
      expect(result).toBe('result');
    });

    test('should handle the attributes as a function', async () => {
      // Function to trace
      const mockFn = jest.fn().mockResolvedValue('result');

      // Create a traced version with function attributes
      const tracedFn = withTracing({
        name: 'test_function',
        component: 'test',
        attributes: (arg1, arg2) => ({
          'arg1.value': arg1,
          'arg2.value': arg2
        })
      })(mockFn);

      // Call the traced function
      await tracedFn('first', 'second');

      // Verify span had the right dynamic attributes
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('arg1.value', 'first');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('arg2.value', 'second');
    });

    test('should handle errors and record them in the span', async () => {
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);

      // Create a traced version
      const tracedFn = withTracing({
        name: 'failing_function',
        component: 'test'
      })(mockFn);

      // Call the traced function and expect it to throw
      await expect(tracedFn()).rejects.toThrow('Test error');

      // Verify span recorded the error
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error'
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('withTracedMiddleware', () => {
    let req, res, next, middleware;

    beforeEach(() => {
      // Mock Express request, response, and next
      req = {
        method: 'GET',
        originalUrl: '/test',
        path: '/test',
        ip: '127.0.0.1',
        headers: { 'x-request-id': 'test-id' }
      };

      res = {
        statusCode: 200,
        end: jest.fn(),
        on: jest.fn()
      };

      next = jest.fn();

      // Mock middleware function
      middleware = jest.fn((req, res, next) => next());
    });

    test('should wrap middleware and add request attributes', () => {
      // Create traced middleware
      const tracedMiddleware = withTracedMiddleware({
        name: 'test_middleware',
        attributesFn: req => ({ 'custom.attr': 'value' })
      })(middleware);

      // Call middleware
      tracedMiddleware(req, res, next);

      // Verify standard request attributes were added
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.method', 'GET');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.url', '/test');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.path', '/test');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.client_ip', '127.0.0.1');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('request.id', 'test-id');

      // Verify custom attributes were added
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('custom.attr', 'value');

      // Verify middleware was called
      expect(middleware).toHaveBeenCalledWith(req, res, expect.any(Function));
    });

    test('should patch res.end to capture response status', () => {
      // Create traced middleware
      const tracedMiddleware = withTracedMiddleware({
        name: 'test_middleware'
      })(middleware);

      // Call middleware
      tracedMiddleware(req, res, next);

      // Call the patched res.end function
      res.end();

      // Verify status code was captured
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    test('should handle errors passed to next', () => {
      // Create middleware that calls next with error
      const errorMiddleware = jest.fn((req, res, next) => {
        next(new Error('Test middleware error'));
      });

      // Create traced middleware
      const tracedMiddleware = withTracedMiddleware({
        name: 'error_middleware'
      })(errorMiddleware);

      // Call middleware
      tracedMiddleware(req, res, next);

      // Verify error was recorded
      expect(mockSpan.recordException).toHaveBeenCalled();
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', 'Test middleware error');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test middleware error'
      });
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify original next was called with error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Test middleware error');
    });

    test('should handle promise returning middleware', async () => {
      // Create async middleware that returns a promise
      const asyncMiddleware = jest.fn(async (req, res, next) => {
        return 'async result';
      });

      // Create traced middleware
      const tracedMiddleware = withTracedMiddleware({
        name: 'async_middleware'
      })(asyncMiddleware);

      // Call middleware
      const result = await tracedMiddleware(req, res, next);

      // Verify middleware was called
      expect(asyncMiddleware).toHaveBeenCalledWith(req, res, expect.any(Function));

      // Verify result was passed through
      expect(result).toBe('async result');
    });

    test('should handle async errors in promise returning middleware', async () => {
      const error = new Error('Async error');

      // Create async middleware that throws
      const asyncMiddleware = jest.fn(async (req, res, next) => {
        throw error;
      });

      // Create traced middleware
      const tracedMiddleware = withTracedMiddleware({
        name: 'failing_async_middleware'
      })(asyncMiddleware);

      // Call middleware and expect it to throw
      await expect(tracedMiddleware(req, res, next)).rejects.toThrow('Async error');

      // Verify error was recorded
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Async error'
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('createSpanManager', () => {
    test('should create spans and manage their lifecycle', async () => {
      // Create a span manager
      const spanManager = createSpanManager({ component: 'test' });

      // Create a span with the manager
      const spanResult = await spanManager.withSpan(
        'test_span',
        { 'test.attribute': 'value' },
        async span => {
          // Return some value from the span
          return 'span result';
        }
      );

      // Verify span was created with attributes
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('test.attribute', 'value');

      // Verify span was ended and status set
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify result was passed through
      expect(spanResult).toBe('span result');
    });

    test('should handle errors in span function', async () => {
      const error = new Error('Span function error');

      // Create a span manager
      const spanManager = createSpanManager({ component: 'test' });

      // Create a span with a function that throws
      await expect(
        spanManager.withSpan('error_span', {}, async () => {
          throw error;
        })
      ).rejects.toThrow('Span function error');

      // Verify error was recorded
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Span function error'
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    test('should add events to parent span', () => {
      // Create a parentSpan mock
      const parentSpan = {
        addEvent: jest.fn(),
        setAttribute: jest.fn()
      };

      // Create a span manager with parent span
      const spanManager = createSpanManager({
        component: 'test',
        parentSpan
      });

      // Add event and attribute
      spanManager.addEvent('test_event', { 'event.detail': 'value' });
      spanManager.setAttribute('test.attribute', 'attribute value');

      // Verify event and attribute were added to parent span
      expect(parentSpan.addEvent).toHaveBeenCalledWith('test_event', { 'event.detail': 'value' });
      expect(parentSpan.setAttribute).toHaveBeenCalledWith('test.attribute', 'attribute value');
    });

    test('should not error when no parent span is provided', () => {
      // Create a span manager without parent span
      const spanManager = createSpanManager({ component: 'test' });

      // These calls should not throw errors
      expect(() => {
        spanManager.addEvent('test_event');
        spanManager.setAttribute('test.attr', 'value');
      }).not.toThrow();
    });
  });
});
