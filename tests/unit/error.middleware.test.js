/**
 * Unit tests for error middleware
 */
const { ApiError, errorHandler, notFound, timeout } = require('../../src/middleware/error');

// Mock winston to avoid actual logging during tests
jest.mock('winston', () => {
  const mock = {
    format: {
      timestamp: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      combine: jest.fn().mockReturnThis()
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn()
    },
    createLogger: jest.fn().mockReturnThis(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
  return {
    createLogger: jest.fn(() => mock),
    format: mock.format,
    transports: mock.transports
  };
});

describe('Error Middleware', () => {
  // Tests for ApiError
  describe('ApiError', () => {
    test('Should create error with default values', () => {
      const error = new ApiError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.details).toBeNull();
      expect(error.name).toBe('ApiError');
      expect(error.stack).toBeDefined();
    });

    test('Should create error with custom values', () => {
      const error = new ApiError('Not found', 404, { resource: 'user' });
      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
      expect(error.details).toEqual({ resource: 'user' });
    });
  });

  // Tests for errorHandler
  describe('errorHandler', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1'
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('Should respond with error details', () => {
      const error = new ApiError('Test error', 400);
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Test error',
          status: 400,
          stack: expect.any(String)
        }
      });
    });

    test('Should use default status 500 for non-ApiErrors', () => {
      const error = new Error('System error');
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'System error',
          status: 500,
          stack: expect.any(String)
        }
      });
    });

    test('Should hide stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new ApiError('Production error', 500);
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Production error',
          status: 500
        }
      });
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  // Tests for notFound
  describe('notFound', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        originalUrl: '/not-found'
      };
      res = {};
      next = jest.fn();
    });

    test('Should create 404 error and pass to next', () => {
      notFound(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = next.mock.calls[0][0];
      expect(error.status).toBe(404);
      expect(error.message).toContain('/not-found');
    });
  });

  // Tests for timeout
  describe('timeout', () => {
    let req, res, next;
    let timeoutFn;

    beforeEach(() => {
      jest.useFakeTimers();
      
      req = {};
      res = {
        on: jest.fn()
      };
      next = jest.fn();
      
      timeoutFn = timeout(1000);
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });

    test('Should set timeout and call next', () => {
      timeoutFn(req, res, next);
      
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
      expect(next).toHaveBeenCalledWith();
    });

    test('Should trigger timeout error after specified time', () => {
      timeoutFn(req, res, next);
      
      // Fast-forward time past timeout
      jest.advanceTimersByTime(1001);
      
      expect(next).toHaveBeenCalledTimes(2);
      expect(next.mock.calls[1][0]).toBeInstanceOf(ApiError);
      expect(next.mock.calls[1][0].status).toBe(408);
    });

    test('Should clear timeout when response finishes', () => {
      timeoutFn(req, res, next);
      
      // Extract the finish handler
      const finishHandler = res.on.mock.calls[0][1];
      
      // Call the finish handler
      finishHandler();
      
      // Fast-forward time past timeout
      jest.advanceTimersByTime(1001);
      
      // Should not call next with error
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('Should use default timeout value when not specified', () => {
      const defaultTimeoutFn = timeout();
      
      defaultTimeoutFn(req, res, next);
      
      // Fast-forward time just before default timeout (30s)
      jest.advanceTimersByTime(29999);
      expect(next).toHaveBeenCalledTimes(1);
      
      // Fast-forward past default timeout
      jest.advanceTimersByTime(1);
      expect(next).toHaveBeenCalledTimes(2);
      expect(next.mock.calls[1][0].status).toBe(408);
    });
  });
});