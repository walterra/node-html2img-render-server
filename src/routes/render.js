const express = require('express');
const router = express.Router();
const { renderHTML } = require('../services/renderer');
const { validatePayload } = require('../middleware/security');
const { ApiError } = require('../middleware/error');

/**
 * @route POST /render
 * @description Renders HTML content and returns screenshot information
 * @access Public
 */
router.post('/', validatePayload, async (req, res, next) => {
  try {
    const {
      html,
      css,
      javascript,
      viewport = { width: 1280, height: 720, deviceScaleFactor: 1 },
      waitForSelector,
      clipSelector,
      assets,
      fonts
    } = req.body;

    // Render HTML and get screenshot
    const result = await renderHTML({
      html,
      css,
      javascript,
      viewport,
      waitForSelector,
      clipSelector,
      assets,
      fonts
    });

    res.json(result);
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
 * @route GET /render/screenshot/:id
 * @description Gets a screenshot by ID
 * @access Public
 */
router.get('/screenshot/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
      return next(new ApiError('Invalid screenshot ID', 400));
    }
    
    // Redirect to the screenshot URL
    res.redirect(`/screenshots/${id}.png`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;