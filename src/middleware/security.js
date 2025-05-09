const { ApiError } = require('./error');

/**
 * Authenticates requests using API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.query.apiKey;
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    console.error('API_KEY environment variable is not set');
    return next(new ApiError('Server authentication configuration error', 500));
  }

  if (!apiKey) {
    return next(new ApiError('API key is required', 401));
  }

  if (apiKey !== expectedApiKey) {
    return next(new ApiError('Invalid API key', 401));
  }

  next();
}

/**
 * Validates request payloads
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validatePayload(req, res, next) {
  const { html, viewport } = req.body;

  // Check for required fields
  if (!html) {
    return next(new ApiError('HTML content is required', 400));
  }

  // Validate viewport if provided
  if (viewport) {
    const { width, height, deviceScaleFactor } = viewport;

    if (typeof width !== 'number' || width <= 0 || width > 5000) {
      return next(new ApiError('Invalid viewport width (must be between 1-5000)', 400));
    }

    if (typeof height !== 'number' || height <= 0 || height > 5000) {
      return next(new ApiError('Invalid viewport height (must be between 1-5000)', 400));
    }

    if (
      deviceScaleFactor &&
      (typeof deviceScaleFactor !== 'number' || deviceScaleFactor <= 0 || deviceScaleFactor > 5)
    ) {
      return next(new ApiError('Invalid deviceScaleFactor (must be between 0-5)', 400));
    }
  }

  // Check for malicious patterns in HTML/JavaScript
  const maliciousPatterns = [
    /electron/i,
    /child_process/i,
    /require\s*\(\s*['"]os['"]\s*\)/i,
    /require\s*\(\s*['"]fs['"]\s*\)/i,
    /require\s*\(\s*['"]path['"]\s*\)/i,
    /process\.env/i,
    /process\.exit/i,
    /<\s*iframe.*src\s*=\s*["']file:\/\//i
  ];

  const combinedContent = [req.body.html, req.body.javascript, req.body.css]
    .filter(Boolean)
    .join(' ');

  for (const pattern of maliciousPatterns) {
    if (pattern.test(combinedContent)) {
      return next(new ApiError('Potentially malicious code detected', 400));
    }
  }

  // Check payload size
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.headers['content-length'] > maxSize) {
    return next(new ApiError('Payload too large', 413));
  }

  next();
}

/**
 * Rate limiting middleware
 * @param {number} maxRequests - Maximum requests per IP per window
 * @param {number} windowMs - Time window in milliseconds
 */
function rateLimit(maxRequests = 60, windowMs = 60 * 1000) {
  const requests = new Map();

  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();

    for (const [key, entry] of requests.entries()) {
      if (now - entry.timestamp > windowMs) {
        requests.delete(key);
      }
    }
  }, 60 * 1000);

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();

    if (!requests.has(ip)) {
      requests.set(ip, { count: 1, timestamp: now });
      return next();
    }

    const entry = requests.get(ip);

    // Reset counter if window has passed
    if (now - entry.timestamp > windowMs) {
      entry.count = 1;
      entry.timestamp = now;
      return next();
    }

    // Increment counter and check limit
    entry.count++;

    if (entry.count > maxRequests) {
      return next(
        new ApiError('Too many requests', 429, {
          retryAfter: Math.ceil((entry.timestamp + windowMs - now) / 1000)
        })
      );
    }

    next();
  };
}

/**
 * Sanitizes URLs to prevent SSRF attacks
 * @param {string} url - URL to sanitize
 * @returns {boolean} - Whether the URL is safe
 */
function isSafeUrl(url) {
  try {
    const parsedUrl = new URL(url);

    // Block private IP ranges
    const hostname = parsedUrl.hostname;

    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return false;
    }

    // Check for private IP ranges
    const privateRanges = [
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^169\.254\.\d+\.\d+$/,
      /^127\.\d+\.\d+\.\d+$/
    ];

    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return false;
      }
    }

    // Check for non-HTTP protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  validatePayload,
  rateLimit,
  isSafeUrl,
  authenticateApiKey
};
