const fs = require('fs').promises;
const path = require('path');

// Screenshot storage directory
const SCREENSHOT_DIR = path.join(__dirname, '../../public/screenshots');

/**
 * Ensures the screenshots directory exists
 */
async function ensureDirectoryExists() {
  try {
    await fs.access(SCREENSHOT_DIR);
  } catch (error) {
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  }
}

/**
 * Saves a screenshot buffer to disk
 * @param {string} screenshotId - Unique ID for the screenshot
 * @param {Buffer} buffer - Screenshot data buffer
 * @returns {Promise<string>} Path to the saved screenshot
 */
async function saveScreenshot(screenshotId, buffer) {
  await ensureDirectoryExists();
  
  const filePath = path.join(SCREENSHOT_DIR, `${screenshotId}.png`);
  await fs.writeFile(filePath, buffer);
  
  return filePath;
}

/**
 * Gets a screenshot from disk
 * @param {string} screenshotId - Unique ID for the screenshot
 * @returns {Promise<Buffer>} Screenshot data buffer
 */
async function getScreenshot(screenshotId) {
  const filePath = path.join(SCREENSHOT_DIR, `${screenshotId}.png`);
  
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`Screenshot not found: ${screenshotId}`);
  }
}

/**
 * Cleans up old screenshots to prevent disk space issues
 * @param {number} maxAgeHours - Maximum age of screenshots to keep (in hours)
 */
async function cleanupOldScreenshots(maxAgeHours = 24) {
  try {
    await ensureDirectoryExists();
    
    const files = await fs.readdir(SCREENSHOT_DIR);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    for (const file of files) {
      if (!file.endsWith('.png')) continue;
      
      const filePath = path.join(SCREENSHOT_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAgeMs) {
        await fs.unlink(filePath);
      }
    }
  } catch (error) {
    console.error('Error cleaning up old screenshots:', error);
  }
}

// Set up scheduled cleanup
setInterval(() => {
  cleanupOldScreenshots().catch(console.error);
}, 1000 * 60 * 60); // Run every hour

module.exports = {
  saveScreenshot,
  getScreenshot,
  cleanupOldScreenshots
};