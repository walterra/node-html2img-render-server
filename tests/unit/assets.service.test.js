/**
 * Unit tests for asset service
 */
const { getMimeType } = require('../../src/services/assets');
const { addAssetsToPage } = require('../../src/services/assets');

describe('Asset Service', () => {
  describe('getMimeType', () => {
    test('Should return correct MIME type for common image formats', () => {
      expect(getMimeType('image.png')).toBe('image/png');
      expect(getMimeType('photo.jpg')).toBe('image/jpeg');
      expect(getMimeType('image.jpeg')).toBe('image/jpeg');
      expect(getMimeType('animation.gif')).toBe('image/gif');
      expect(getMimeType('icon.svg')).toBe('image/svg+xml');
      expect(getMimeType('photo.webp')).toBe('image/webp');
    });

    test('Should return correct MIME type for font formats', () => {
      expect(getMimeType('font.woff')).toBe('font/woff');
      expect(getMimeType('font.woff2')).toBe('font/woff2');
      expect(getMimeType('font.ttf')).toBe('font/ttf');
      expect(getMimeType('font.otf')).toBe('font/otf');
      expect(getMimeType('font.eot')).toBe('application/vnd.ms-fontobject');
    });

    test('Should return default MIME type for unknown extensions', () => {
      expect(getMimeType('document.xyz')).toBe('application/octet-stream');
      expect(getMimeType('file')).toBe('application/octet-stream');
    });

    test('Should handle file paths with dots in the middle', () => {
      expect(getMimeType('path/to/my.site.com/image.png')).toBe('image/png');
      expect(getMimeType('version.1.2/font.woff2')).toBe('font/woff2');
    });

    test('Should handle uppercase extensions', () => {
      expect(getMimeType('image.PNG')).toBe('image/png');
      expect(getMimeType('font.WOFF2')).toBe('font/woff2');
    });
  });

  describe('addAssetsToPage', () => {
    let page, route;

    beforeEach(() => {
      // Mock for Playwright page object
      route = {
        request: jest.fn().mockReturnValue({
          url: jest.fn()
        }),
        fulfill: jest.fn().mockResolvedValue(undefined),
        continue: jest.fn().mockResolvedValue(undefined)
      };

      page = {
        route: jest.fn().mockImplementation(async (pattern, handler) => {
          await handler(route);
        }),
        addStyleTag: jest.fn().mockResolvedValue(undefined),
        waitForTimeout: jest.fn().mockResolvedValue(undefined)
      };

      // Spy on console.error to avoid polluting test output
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('Should handle empty options gracefully', async () => {
      await addAssetsToPage(page, null);
      expect(page.route).not.toHaveBeenCalled();
      expect(page.addStyleTag).not.toHaveBeenCalled();
    });

    test('Should handle empty assets and fonts gracefully', async () => {
      await addAssetsToPage(page, { assets: {}, fonts: [] });
      expect(page.route).not.toHaveBeenCalled();
      expect(page.addStyleTag).not.toHaveBeenCalled();
    });

    test('Should inject font CSS for fonts', async () => {
      const fonts = [
        {
          name: 'TestFont',
          data: 'base64fontdata',
          weight: '400',
          style: 'normal'
        },
        {
          name: 'TestFont',
          data: 'base64fontdata',
          weight: '700',
          style: 'italic'
        }
      ];

      await addAssetsToPage(page, { fonts });

      expect(page.addStyleTag).toHaveBeenCalledTimes(1);
      const cssContent = page.addStyleTag.mock.calls[0][0].content;

      // Check that the CSS contains the font declarations
      expect(cssContent).toContain('@font-face');
      expect(cssContent).toContain("font-family: 'TestFont'");
      expect(cssContent).toContain('font-weight: 400');
      expect(cssContent).toContain('font-weight: 700');
      expect(cssContent).toContain('font-style: normal');
      expect(cssContent).toContain('font-style: italic');
      expect(cssContent).toContain('base64fontdata');

      // Should wait for fonts to load
      expect(page.waitForTimeout).toHaveBeenCalledTimes(1);
    });

    test('Should handle errors gracefully', async () => {
      // Make addStyleTag throw an error
      page.addStyleTag.mockRejectedValue(new Error('Test error'));

      await addAssetsToPage(page, {
        fonts: [{ name: 'TestFont', data: 'base64fontdata' }]
      });

      // Should log the error
      expect(console.error).toHaveBeenCalledWith('Error adding assets to page:', expect.any(Error));
    });

    test('Should handle font without explicit weight and style', async () => {
      const fonts = [
        {
          name: 'TestFont',
          data: 'base64fontdata'
          // No weight or style specified
        }
      ];

      await addAssetsToPage(page, { fonts });

      expect(page.addStyleTag).toHaveBeenCalledTimes(1);
      const cssContent = page.addStyleTag.mock.calls[0][0].content;

      // Should use default weight and style
      expect(cssContent).toContain('font-weight: normal');
      expect(cssContent).toContain('font-style: normal');
    });
  });
});
