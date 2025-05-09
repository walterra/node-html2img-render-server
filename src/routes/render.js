const express = require('express');
const router = express.Router();
const { renderHTML } = require('../services/renderer');
const { validatePayload, authenticateApiKey } = require('../middleware/security');
const { ApiError } = require('../middleware/error');
const { withSpan, getCurrentSpan } = require('../services/telemetry');

/**
 * @route POST /render
 * @description Renders HTML content and returns the screenshot image directly
 * @access Private - Requires API key
 */
router.post('/', authenticateApiKey, validatePayload, async (req, res, next) => {
  // Create a span for the entire request
  return withSpan('route.render', async () => {
    try {
      const span = getCurrentSpan();

      const {
        html,
        css,
        javascript,
        viewport = { width: 1280, height: 720, deviceScaleFactor: 1 },
        waitForSelector,
        clipSelector,
        assets,
        fonts,
        responseFormat = 'image', // 'image' or 'json'
        format = 'png', // 'png' or 'jpeg'
        quality = 90 // Quality for JPEG format (1-100)
      } = req.body;

      // Add request attributes to span for observability
      if (span) {
        span.setAttribute('request.api', 'render');
        span.setAttribute('request.format', format);
        span.setAttribute('request.response_format', responseFormat);
        span.setAttribute('request.client_ip', req.ip);
        span.setAttribute('request.user_agent', req.get('User-Agent') || 'unknown');

        // Track content size
        if (html) span.setAttribute('request.html_size', html.length);
        if (css) span.setAttribute('request.css_size', css.length);
        if (javascript) span.setAttribute('request.js_size', javascript.length);

        // Track options used
        span.setAttribute('request.has_wait_selector', Boolean(waitForSelector));
        span.setAttribute('request.has_clip_selector', Boolean(clipSelector));
        span.setAttribute('request.has_assets', Boolean(assets));
        span.setAttribute('request.has_fonts', Boolean(fonts));
      }

      // Validate format
      if (format && !['png', 'jpeg'].includes(format)) {
        const error = new ApiError('Format must be either "png" or "jpeg"', 400);
        if (span) {
          span.recordException(error);
          span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
        }
        return next(error);
      }

      // Validate JPEG quality if provided
      if (format === 'jpeg' && (quality < 1 || quality > 100)) {
        const error = new ApiError('JPEG quality must be between 1 and 100', 400);
        if (span) {
          span.recordException(error);
          span.setStatus({ code: 2, message: error.message });
        }
        return next(error);
      }

      // Start render timing
      const requestStartTime = Date.now();

      // Render HTML and get screenshot
      const result = await renderHTML({
        html,
        css,
        javascript,
        viewport,
        waitForSelector,
        clipSelector,
        assets,
        fonts,
        embedMetadata: true, // Always embed metadata in PNG images
        format,
        quality
      });

      // Calculate total request duration
      const requestDuration = Date.now() - requestStartTime;

      if (span) {
        // Track overall performance metrics
        span.setAttribute('request.duration_ms', requestDuration);
        span.setAttribute('request.rendering_time_ms', result.metadata.renderingTime);
        span.setAttribute('request.browser_version', result.metadata.browserVersion);
        span.setAttribute('request.screenshot_id', result.metadata.screenshotId);

        // Track response size
        span.setAttribute('response.size_bytes', result.imageBuffer.length);
      }

      // Determine how to return the response based on requested format
      if (responseFormat === 'json') {
        // Add span attribute for response type
        if (span) span.setAttribute('response.type', 'json');

        // Return both image data (as base64) and metadata
        res.json({
          image: result.imageBuffer.toString('base64'),
          contentType: result.contentType,
          metadata: result.metadata
        });
      } else {
        // Add span attribute for response type
        if (span) span.setAttribute('response.type', 'image');

        // Set appropriate headers for image response
        res.set('Content-Type', result.contentType);
        res.set('X-Screenshot-ID', result.metadata.screenshotId);
        res.set('X-Rendering-Time', result.metadata.renderingTime);
        res.set('X-Browser-Version', result.metadata.browserVersion);
        res.set('X-Rendered-At', result.metadata.renderedAt);

        // Add viewport info in headers
        Object.entries(result.metadata.viewport).forEach(([key, value]) => {
          res.set(`X-Viewport-${key.charAt(0).toUpperCase() + key.slice(1)}`, value);
        });

        // Stream the image buffer directly to client
        res.send(result.imageBuffer);
      }
    } catch (error) {
      // Capture error details in span
      const span = getCurrentSpan();
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
        span.setAttribute('error.type', error.name);
        span.setAttribute('error.message', error.message);
      }

      // Convert playwright errors to API errors
      if (error.name === 'TimeoutError') {
        next(new ApiError('Operation timed out. Check selectors or simplify content.', 408));
      } else {
        next(error);
      }
    }
  });
});

/**
 * @route POST /render/metadata
 * @description Extracts and returns metadata from a previously rendered image
 * @access Private - Requires API key
 */
router.post('/metadata', authenticateApiKey, async (req, res, next) => {
  // Create a span for the metadata request
  return withSpan('route.metadata', async () => {
    try {
      const span = getCurrentSpan();
      if (span) {
        span.setAttribute('request.api', 'metadata');
        span.setAttribute('request.client_ip', req.ip);
        span.setAttribute('request.user_agent', req.get('User-Agent') || 'unknown');
      }

      const { image } = req.body;

      if (!image) {
        const error = new ApiError('Image data is required', 400);
        if (span) {
          span.recordException(error);
          span.setStatus({ code: 2, message: error.message });
        }
        return next(error);
      }

      if (span) {
        span.setAttribute('request.image_size', image.length);
      }

      // TODO: If needed, implement metadata extraction from image here

      if (span) {
        span.setAttribute('response.status', 501);
        span.setAttribute('response.message', 'Not implemented');
      }

      res.status(501).json({
        error: 'Metadata extraction from existing images not implemented yet'
      });
    } catch (error) {
      // Capture error details in span
      const span = getCurrentSpan();
      if (span) {
        span.recordException(error);
        span.setStatus({ code: 2, message: error.message });
        span.setAttribute('error.type', error.name);
        span.setAttribute('error.message', error.message);
      }

      next(error);
    }
  });
});

module.exports = router;