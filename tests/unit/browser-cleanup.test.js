/**
 * Tests for browser instance cleanup
 */
const { renderHTML, closeBrowser } = require('../../src/services/renderer');

// Mock playwright chromium module
jest.mock('playwright', () => {
  // Create mock browser, context, and page objects
  const mockPage = {
    setContent: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    $: jest.fn().mockImplementation(() => {
      return {
        boundingBox: jest.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 100 })
      };
    }),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('test')),
    close: jest.fn().mockResolvedValue(undefined)
  };

  const mockContext = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined)
  };

  const mockBrowser = {
    newContext: jest.fn().mockResolvedValue(mockContext),
    version: jest.fn().mockResolvedValue('Chrome/90.0.4430.212'),
    close: jest.fn().mockResolvedValue(undefined)
  };

  return {
    chromium: {
      launch: jest.fn().mockResolvedValue(mockBrowser)
    }
  };
});

// Mock pngjs
jest.mock('pngjs', () => {
  return {
    PNG: {
      sync: {
        read: jest.fn().mockImplementation(() => ({ width: 100, height: 100 })),
        write: jest.fn().mockImplementation(png => Buffer.from('test-with-metadata'))
      }
    }
  };
});

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123')
}));

describe('Browser Cleanup', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('Should close page and context after rendering', async () => {
    const playwright = require('playwright');
    const mockBrowser = await playwright.chromium.launch();
    const mockContext = await mockBrowser.newContext();
    const mockPage = await mockContext.newPage();

    const result = await renderHTML({
      html: '<div>Test</div>',
      viewport: { width: 800, height: 600 }
    });

    // Check that page and context are closed properly
    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();

    // But browser should be kept open for reuse
    expect(mockBrowser.close).not.toHaveBeenCalled();
  });

  test('Should close page and context even if rendering fails', async () => {
    const playwright = require('playwright');
    const mockBrowser = await playwright.chromium.launch();
    const mockContext = await mockBrowser.newContext();
    const mockPage = await mockContext.newPage();

    // Make screenshot throw an error
    mockPage.screenshot.mockRejectedValueOnce(new Error('Screenshot error'));

    try {
      await renderHTML({
        html: '<div>Test</div>',
        viewport: { width: 800, height: 600 }
      });
    } catch (error) {
      // Expected to fail
    }

    // Page and context should still be closed
    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
  });

  test('Should close browser when closeBrowser is called', async () => {
    const playwright = require('playwright');
    const mockBrowser = await playwright.chromium.launch();

    // Render first to create a browser instance
    await renderHTML({
      html: '<div>Test</div>'
    });

    // Then close the browser
    await closeBrowser();

    // Browser should be closed
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  test('Should handle closeBrowser being called when no browser exists', async () => {
    const playwright = require('playwright');

    // Reset mock to simulate no browser instance
    playwright.chromium.launch.mockClear();

    // Should not throw an error
    await expect(closeBrowser()).resolves.not.toThrow();
  });

  test('Should create a new browser after previous one is closed', async () => {
    const playwright = require('playwright');

    // First render to create a browser
    await renderHTML({
      html: '<div>First</div>'
    });

    // Close browser
    await closeBrowser();

    // Clear mock to track new calls
    playwright.chromium.launch.mockClear();

    // Render again
    await renderHTML({
      html: '<div>Second</div>'
    });

    // Should have created a new browser
    expect(playwright.chromium.launch).toHaveBeenCalled();
  });
});
