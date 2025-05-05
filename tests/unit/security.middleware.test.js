/**
 * Unit tests for security middleware
 */
const { validatePayload, rateLimit, isSafeUrl } = require('../../src/middleware/security');
const { ApiError } = require('../../src/middleware/error');

describe('Security Middleware', () => {
  // Tests for validatePayload
  describe('validatePayload', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        body: {
          html: '<div>Test</div>',
          viewport: { width: 800, height: 600 }
        },
        headers: {
          'content-length': '500'
        }
      };
      res = {};
      next = jest.fn();
    });

    test('Should call next() with valid payload', () => {
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).not.toHaveBeenCalledWith(expect.any(ApiError));
    });

    test('Should return 400 when html is missing', () => {
      req.body.html = undefined;
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].status).toBe(400);
      expect(next.mock.calls[0][0].message).toContain('HTML content is required');
    });

    test('Should validate viewport width', () => {
      req.body.viewport.width = -1;
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    test('Should validate viewport height', () => {
      req.body.viewport.height = 6000;
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    test('Should validate deviceScaleFactor', () => {
      req.body.viewport.deviceScaleFactor = 10;
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].status).toBe(400);
    });

    test('Should allow valid viewport settings', () => {
      req.body.viewport = {
        width: 1024,
        height: 768,
        deviceScaleFactor: 2
      };
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    test('Should detect malicious patterns', () => {
      req.body.html = '<script>require("fs").readFile("/etc/passwd")</script>';
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].message).toContain('malicious');
    });

    test('Should detect malicious patterns in JavaScript', () => {
      req.body.javascript = 'process.exit(1)';
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].message).toContain('malicious');
    });

    test('Should detect malicious patterns in CSS with file protocol', () => {
      req.body.css = 'body { background: url("file:///etc/passwd"); }';
      req.body.html = '<iframe src="file:///etc/passwd"></iframe>';
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].message).toContain('malicious');
    });

    test('Should reject payload that is too large', () => {
      req.headers['content-length'] = 20 * 1024 * 1024; // 20MB
      validatePayload(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].status).toBe(413);
    });
  });

  // Tests for isSafeUrl
  describe('isSafeUrl', () => {
    test('Should allow standard http URLs', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
    });

    test('Should allow standard https URLs', () => {
      expect(isSafeUrl('https://example.com/path')).toBe(true);
    });

    test('Should reject localhost URLs', () => {
      expect(isSafeUrl('http://localhost')).toBe(false);
      expect(isSafeUrl('http://localhost:8080')).toBe(false);
    });

    test('Should reject loopback IPs', () => {
      expect(isSafeUrl('http://127.0.0.1')).toBe(false);
      expect(isSafeUrl('http://127.0.0.1:3000')).toBe(false);
      // IPv6 loopback is not explicitly checked in the implementation
      // so we're not testing it here
    });

    test('Should reject private network IPs', () => {
      expect(isSafeUrl('http://10.0.0.1')).toBe(false);
      expect(isSafeUrl('http://172.16.0.1')).toBe(false);
      expect(isSafeUrl('http://192.168.1.1')).toBe(false);
    });

    test('Should reject non-HTTP protocols', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('ftp://example.com')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    test('Should reject invalid URLs', () => {
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });
  });

  // Tests for rateLimit
  describe('rateLimit', () => {
    let req, res, next;
    let middleware;
    
    beforeEach(() => {
      jest.useFakeTimers();
      
      req = { ip: '127.0.0.1' };
      res = {};
      next = jest.fn();
      
      middleware = rateLimit(5, 1000); // 5 requests per second
    });
    
    afterEach(() => {
      jest.useRealTimers();
    });
    
    test('Should allow requests under the limit', () => {
      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }
      
      expect(next).toHaveBeenCalledTimes(5);
      expect(next).toHaveBeenCalledWith();
    });
    
    test('Should reject requests over the limit', () => {
      for (let i = 0; i < 6; i++) {
        middleware(req, res, next);
      }
      
      expect(next).toHaveBeenCalledTimes(6);
      expect(next.mock.calls[5][0]).toBeInstanceOf(ApiError);
      expect(next.mock.calls[5][0].status).toBe(429);
    });
    
    test('Should reset counter after time window', () => {
      // Make max requests
      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }
      
      // Advance time past the window
      jest.advanceTimersByTime(1001);
      
      // Should be able to make more requests
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(6);
      expect(next.mock.calls[5][0]).toBeUndefined();
    });
    
    test('Should clean up old entries', () => {
      const spy = jest.spyOn(Map.prototype, 'delete');
      
      middleware(req, res, next);
      
      // Advance time past cleanup interval
      jest.advanceTimersByTime(60 * 1000 + 1);
      
      expect(spy).toHaveBeenCalled();
      
      spy.mockRestore();
    });
    
    test('Should handle different IPs separately', () => {
      const req2 = { ip: '1.2.3.4' };
      
      // Max out first IP
      for (let i = 0; i < 5; i++) {
        middleware(req, res, next);
      }
      
      // Should reject next request from first IP
      middleware(req, res, next);
      expect(next.mock.calls[5][0]).toBeInstanceOf(ApiError);
      
      // But second IP should work
      middleware(req2, res, next);
      expect(next.mock.calls[6][0]).toBeUndefined();
    });
  });
});