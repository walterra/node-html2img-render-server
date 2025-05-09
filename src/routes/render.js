const express = require('express');
const router = express.Router();
const { renderHTML } = require('../services/renderer');
const { validatePayload, authenticateApiKey } = require('../middleware/security');
const { ApiError } = require('../middleware/error');

/**
 * @route POST /render
 * @description Renders HTML content and returns the screenshot image directly
 * @access Private - Requires API key
 */
router.post('/', authenticateApiKey, validatePayload, async (req, res, next) => {
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

    // Validate format
    if (format && !['png', 'jpeg'].includes(format)) {
      const error = new ApiError('Format must be either "png" or "jpeg"', 400);
      return next(error);
    }

    // Validate JPEG quality if provided
    if (format === 'jpeg' && (quality < 1 || quality > 100)) {
      const error = new ApiError('JPEG quality must be between 1 and 100', 400);
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

    // Determine how to return the response based on requested format
    if (responseFormat === 'json') {
      // Return both image data (as base64) and metadata
      res.json({
        image: result.imageBuffer.toString('base64'),
        contentType: result.contentType,
        metadata: result.metadata
      });
    } else {
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

/**
 * @route POST /render/metadata
 * @description Extracts and returns metadata from a previously rendered image
 * @access Private - Requires API key
 */
router.post('/metadata', authenticateApiKey, async (req, res, next) => {
  try {
    const { image } = req.body;

    if (!image) {
      const error = new ApiError('Image data is required', 400);
      return next(error);
    }

    // TODO: If needed, implement metadata extraction from image here

    res.status(501).json({
      error: 'Metadata extraction from existing images not implemented yet'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
