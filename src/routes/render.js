const express = require('express');
const { renderHTML } = require('../services/renderer');
const security = require('../middleware/security');
const { ApiError } = require('../middleware/error');
const { withTracing, createSpanManager } = require('../instrumentation/wrappers');
const {
  createInstrumentedRouter,
  wrapMiddlewareWithErrorFormat
} = require('../instrumentation/router');

// Get instrumented versions of middlewares
const { validatePayload, authenticateApiKey } = security.default;

// Create an instrumented router for better tracing
const router = createInstrumentedRouter('render');

/**
 * @route POST /render
 * @description Renders HTML content and returns the screenshot image directly
 * @access Private - Requires API key
 */
router.post(
  '/',
  authenticateApiKey,
  validatePayload,
  wrapMiddlewareWithErrorFormat(async (req, res, next) => {
    // Create helper for tracing
    const renderFunction = withTracing({
      name: 'api.render',
      component: 'api',
      attributes: req => ({
        'request.ip': req.ip,
        'request.user_agent': req.get('User-Agent') || 'unknown',
        'request.response_format': req.body.responseFormat || 'image',
        'request.format': req.body.format || 'png',
        'content.html_size_bytes': req.body.html?.length || 0,
        'content.css_size_bytes': req.body.css?.length || 0,
        'content.js_size_bytes': req.body.javascript?.length || 0,
        'viewport.width': req.body.viewport?.width || 1280,
        'viewport.height': req.body.viewport?.height || 720,
        'viewport.scale_factor': req.body.viewport?.deviceScaleFactor || 1,
        has_wait_selector: !!req.body.waitForSelector,
        has_clip_selector: !!req.body.clipSelector,
        has_assets: !!(req.body.assets || req.body.fonts)
      })
    })(async function renderRequestImpl(req, res, next) {
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

        // Create span manager for events
        const spans = createSpanManager({ component: 'api' });

        // Add validation events
        spans.addEvent('request.validation.start');

        // Validate format
        if (format && !['png', 'jpeg'].includes(format)) {
          return res.status(400).json({
            error: {
              message: 'Format must be either "png" or "jpeg"',
              status: 400
            }
          });
        }

        // Validate JPEG quality if provided
        if (format === 'jpeg' && (quality < 1 || quality > 100)) {
          return res.status(400).json({
            error: {
              message: 'JPEG quality must be between 1 and 100',
              status: 400
            }
          });
        }

        spans.addEvent('request.validation.complete');

        // Create render params span event
        spans.addEvent('render.start', {
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
        spans.addEvent('render.complete', {
          renderingTime: result.metadata.renderingTime,
          screenshotId: result.metadata.screenshotId,
          imageSize: result.imageBuffer.length
        });

        spans.setAttribute('render.success', true);
        spans.setAttribute('render.duration_ms', result.metadata.renderingTime);
        spans.setAttribute('render.image_size_bytes', result.imageBuffer.length);
        spans.setAttribute('response.status_code', 200);

        // Determine how to return the response based on requested format
        if (responseFormat === 'json') {
          spans.addEvent('response.json.prepare');
          // Return both image data (as base64) and metadata
          res.json({
            image: result.imageBuffer.toString('base64'),
            contentType: result.contentType,
            metadata: result.metadata
          });
        } else {
          spans.addEvent('response.image.prepare');
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
        // Convert playwright errors to API errors
        if (error.name === 'TimeoutError') {
          next(new ApiError('Operation timed out. Check selectors or simplify content.', 408));
        } else {
          next(error);
        }
      }
    });

    // Call the wrapped function
    return renderFunction(req, res, next);
  })
);

/**
 * @route POST /render/metadata
 * @description Extracts and returns metadata from a previously rendered image
 * @access Private - Requires API key
 */
router.post(
  '/metadata',
  authenticateApiKey,
  wrapMiddlewareWithErrorFormat(async (req, res, next) => {
    // Create helper for tracing
    const metadataFunction = withTracing({
      name: 'api.extract_metadata',
      component: 'api',
      attributes: req => ({
        'request.ip': req.ip,
        'request.user_agent': req.get('User-Agent') || 'unknown',
        'image.size_bytes': req.body.image?.length || 0
      })
    })(async function extractMetadataImpl(req, res, next) {
      try {
        const { image } = req.body;

        // Create span manager for events
        const spans = createSpanManager({ component: 'api' });

        // Validate input
        spans.addEvent('request.validation.start');

        if (!image) {
          spans.setAttribute('validation.error', 'missing_image');
          spans.setAttribute('response.status_code', 400);
          const error = new ApiError('Image data is required', 400);
          return next(error);
        }

        spans.addEvent('request.validation.complete');

        // TODO: If needed, implement metadata extraction from image here
        spans.addEvent('metadata.extract.not_implemented');
        spans.setAttribute('response.status_code', 501);

        res.status(501).json({
          error: 'Metadata extraction from existing images not implemented yet'
        });
      } catch (error) {
        next(error);
      }
    });

    // Call the wrapped function
    return metadataFunction(req, res, next);
  })
);

module.exports = router;
