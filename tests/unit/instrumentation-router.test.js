/**
 * Tests for router instrumentation
 */
const {
  createInstrumentedRouter,
  wrapMiddlewareWithErrorFormat
} = require('../../src/instrumentation/router');

// Mock OpenTelemetry API (needed for router tests)
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

// Mock the wrappers which is used by router.js
jest.mock('../../src/instrumentation/wrappers', () => {
  return {
    withTracedMiddleware: jest.fn(options => middleware => {
      // Return a function that just wraps the original middleware
      return function wrappedMiddleware(...args) {
        return middleware(...args);
      };
    })
  };
});

describe('Router Instrumentation', () => {
  // Import our mocked dependencies
  const { withTracedMiddleware } = require('../../src/instrumentation/wrappers');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInstrumentedRouter', () => {
    test('should create an instrumented router', () => {
      // Create mock express module
      const mockGet = jest.fn();
      const mockPost = jest.fn();
      const mockUse = jest.fn();
      const mockRouter = {
        get: mockGet,
        post: mockPost,
        put: jest.fn(),
        delete: jest.fn(),
        patch: jest.fn(),
        all: jest.fn(),
        use: mockUse
      };
      const mockExpress = {
        Router: jest.fn().mockReturnValue(mockRouter)
      };

      // Create an instrumented router
      const router = createInstrumentedRouter('test_module', { express: mockExpress });

      // Verify Express.Router was called
      expect(mockExpress.Router).toHaveBeenCalled();

      // Create middleware with a name
      function testMiddleware(req, res, next) {}

      // Use get method
      router.get('/test-path', testMiddleware);

      // Verify that withTracedMiddleware was called
      expect(withTracedMiddleware).toHaveBeenCalled();
      expect(withTracedMiddleware.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          name: 'test_module.get.testMiddleware',
          component: 'router'
        })
      );

      // Verify that the original router method was called with path and a function
      expect(mockGet).toHaveBeenCalledWith('/test-path', expect.any(Function));

      // Use post method with multiple middlewares
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();
      router.post('/another-path', middleware1, middleware2);

      // Verify that withTracedMiddleware was called twice more
      expect(withTracedMiddleware).toHaveBeenCalledTimes(3);

      // Verify post was called
      expect(mockPost).toHaveBeenCalledWith(
        '/another-path',
        expect.any(Function),
        expect.any(Function)
      );

      // Use use method without path
      router.use(testMiddleware);

      // Verify use was called
      expect(mockUse).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('wrapMiddlewareWithErrorFormat', () => {
    test('should format errors consistently', () => {
      // Mock Express objects
      const req = {};
      const res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Create middleware that calls next with an error
      const errorMiddleware = (req, res, next) => {
        next(new Error('Test error'));
      };

      // Wrap the middleware
      const wrappedMiddleware = wrapMiddlewareWithErrorFormat(errorMiddleware);

      // Set production environment to exclude stack trace
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Call the middleware
      wrappedMiddleware(req, res, next);

      // Verify error was formatted correctly
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          status: 500
          // No stack in production
        }
      });

      // Original next should not be called since we handled the error
      expect(next).not.toHaveBeenCalled();

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should include stack trace in development mode', () => {
      // Mock Express objects
      const req = {};
      const res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Create middleware that calls next with an error
      const errorMiddleware = (req, res, next) => {
        const error = new Error('Test error');
        error.stack = 'Error: Test error\n    at file.js:1:1';
        next(error);
      };

      // Wrap the middleware
      const wrappedMiddleware = wrapMiddlewareWithErrorFormat(errorMiddleware);

      // Set development environment to include stack trace
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Call the middleware
      wrappedMiddleware(req, res, next);

      // Verify stack trace was included
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          status: 500,
          stack: 'Error: Test error\n    at file.js:1:1'
        }
      });

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('should respect custom status codes', () => {
      // Mock Express objects
      const req = {};
      const res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Create middleware that calls next with an error that has a status
      const errorMiddleware = (req, res, next) => {
        const error = new Error('Not Found');
        error.status = 404;
        next(error);
      };

      // Wrap the middleware
      const wrappedMiddleware = wrapMiddlewareWithErrorFormat(errorMiddleware);

      // Call the middleware
      wrappedMiddleware(req, res, next);

      // Verify status was used
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            status: 404
          })
        })
      );
    });

    test('should pass through to original next when no error', () => {
      // Mock Express objects
      const req = {};
      const res = {};
      const next = jest.fn();

      // Create middleware that calls next without an error
      const middleware = (req, res, next) => {
        next();
      };

      // Wrap the middleware
      const wrappedMiddleware = wrapMiddlewareWithErrorFormat(middleware);

      // Call the middleware
      wrappedMiddleware(req, res, next);

      // Verify original next was called
      expect(next).toHaveBeenCalled();
    });

    test('should not modify response if headers already sent', () => {
      // Mock Express objects
      const req = {};
      const res = {
        headersSent: true,
        status: jest.fn(),
        json: jest.fn()
      };
      const next = jest.fn();

      // Create middleware that calls next with an error
      const errorMiddleware = (req, res, next) => {
        next(new Error('Test error'));
      };

      // Wrap the middleware
      const wrappedMiddleware = wrapMiddlewareWithErrorFormat(errorMiddleware);

      // Call the middleware
      wrappedMiddleware(req, res, next);

      // Verify response was not modified
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();

      // Verify original next was called with the error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Test error');
    });
  });
});
