const express = require('express');
const { renderHTML } = require('../services/renderer');
const security = require('../middleware/security');
const { ApiError } = require('../middleware/error');
const { createInstrumentedRouter, getTracer, SpanStatusCode } = require('../utils/telemetry');

// Get instrumented versions of middlewares
const { validatePayload, authenticateApiKey } = security.default;

// Create an instrumented router for better tracing
const router = createInstrumentedRouter('render');

/**
 * @route POST /render
 * @description Renders HTML content and returns the screenshot image directly
 * @access Private - Requires API key
 */
router.post('/', authenticateApiKey, validatePayload, async (req, res, next) => {
  // Get tracer for API routes
  const tracer = getTracer('api');

  // Start a span for the API request
  return tracer.startActiveSpan('api.render', async (span) => {
    try {
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

      // Add basic request information to span
      span.setAttribute('request.ip', req.ip);
      span.setAttribute('request.user_agent', req.get('User-Agent') || 'unknown');
      span.setAttribute('request.response_format', responseFormat);
      span.setAttribute('request.format', format);

      // Record content sizes
      span.setAttribute('content.html_size_bytes', html?.length || 0);
      span.setAttribute('content.css_size_bytes', css?.length || 0);
      span.setAttribute('content.js_size_bytes', javascript?.length || 0);

      // Add viewport dimensions
      span.setAttribute('viewport.width', viewport.width);
      span.setAttribute('viewport.height', viewport.height);
      span.setAttribute('viewport.scale_factor', viewport.deviceScaleFactor || 1);

      // Add other rendering options
      span.setAttribute('has_wait_selector', !!waitForSelector);
      span.setAttribute('has_clip_selector', !!clipSelector);
      span.setAttribute('has_assets', !!(assets || fonts));

      // Add validation events
      span.addEvent('request.validation.start');

      // Validate format
      if (format && !['png', 'jpeg'].includes(format)) {
        span.setAttribute('validation.error', 'invalid_format');
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Format must be either "png" or "jpeg"'
        });

        const error = new ApiError('Format must be either "png" or "jpeg"', 400);
        span.end();

        // Return a formatted error response directly
        return res.status(400).json({
          error: {
            message: 'Format must be either "png" or "jpeg"',
            status: 400
          }
        });
      }

      // Validate JPEG quality if provided
      if (format === 'jpeg' && (quality < 1 || quality > 100)) {
        span.setAttribute('validation.error', 'invalid_quality');
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'JPEG quality must be between 1 and 100'
        });

        const error = new ApiError('JPEG quality must be between 1 and 100', 400);
        span.end();

        // Return a formatted error response directly
        return res.status(400).json({
          error: {
            message: 'JPEG quality must be between 1 and 100',
            status: 400
          }
        });
      }

      span.addEvent('request.validation.complete');

      // Create render params span event
      span.addEvent('render.start', {
        format,
        responseFormat,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height
      });

      // Render HTML and get screenshot
      // Renderer function has its own detailed spans as children of this one
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

      // Record success and result info
      span.addEvent('render.complete', {
        renderingTime: result.metadata.renderingTime,
        screenshotId: result.metadata.screenshotId,
        imageSize: result.imageBuffer.length
      });

      span.setAttribute('render.success', true);
      span.setAttribute('render.duration_ms', result.metadata.renderingTime);
      span.setAttribute('render.image_size_bytes', result.imageBuffer.length);
      span.setAttribute('response.status_code', 200);

      // Determine how to return the response based on requested format
      if (responseFormat === 'json') {
        span.addEvent('response.json.prepare');
        // Return both image data (as base64) and metadata
        res.json({
          image: result.imageBuffer.toString('base64'),
          contentType: result.contentType,
          metadata: result.metadata
        });
      } else {
        span.addEvent('response.image.prepare');
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

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      // Record error information
      span.recordException(error);
      span.setAttribute('render.success', false);
      span.setAttribute('error.message', error.message);
      span.setAttribute('error.type', error.name || 'Error');

      // Convert playwright errors to API errors
      if (error.name === 'TimeoutError') {
        span.setAttribute('error.category', 'timeout');
        span.setAttribute('response.status_code', 408);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Operation timed out'
        });
        next(new ApiError('Operation timed out. Check selectors or simplify content.', 408));
      } else {
        span.setAttribute('error.category', 'unknown');
        span.setAttribute('response.status_code', 500);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        next(error);
      }
    } finally {
      span.end();
    }
  });
});

/**
 * @route POST /render/metadata
 * @description Extracts and returns metadata from a previously rendered image
 * @access Private - Requires API key
 */
router.post('/metadata', authenticateApiKey, async (req, res, next) => {
  // Get tracer for API routes
  const tracer = getTracer('api');

  // Start a span for the API request
  return tracer.startActiveSpan('api.extract_metadata', async (span) => {
    try {
      const { image } = req.body;

      // Add basic request information to span
      span.setAttribute('request.ip', req.ip);
      span.setAttribute('request.user_agent', req.get('User-Agent') || 'unknown');

      // Validate input
      span.addEvent('request.validation.start');

      if (!image) {
        span.setAttribute('validation.error', 'missing_image');
        span.setAttribute('response.status_code', 400);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Image data is required'
        });

        const error = new ApiError('Image data is required', 400);
        span.end();
        return next(error);
      }

      span.addEvent('request.validation.complete');

      // Record image size
      span.setAttribute('image.size_bytes', image.length);

      // TODO: If needed, implement metadata extraction from image here
      span.addEvent('metadata.extract.not_implemented');
      span.setAttribute('response.status_code', 501);

      res.status(501).json({
        error: 'Metadata extraction from existing images not implemented yet'
      });

      span.setStatus({
        code: SpanStatusCode.UNSET,
        message: 'Feature not implemented'
      });
    } catch (error) {
      // Record error information
      span.recordException(error);
      span.setAttribute('error.message', error.message);
      span.setAttribute('error.type', error.name || 'Error');
      span.setAttribute('response.status_code', 500);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });

      next(error);
    } finally {
      span.end();
    }
  });
});

module.exports = router;
