/**
 * Tests for telemetry-validator
 */
const { validateOtelConfig } = require('../../src/utils/telemetry-validator');

describe('Telemetry Validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear and reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.OTEL_SDK_DISABLED;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('Should detect missing required configuration', () => {
    const result = validateOtelConfig();

    expect(result.isValid).toBe(false);
    expect(result.messages.length).toBeGreaterThan(0);
    // Should check for both service name and endpoint
    expect(result.messages[0]).toContain('OTEL_SERVICE_NAME');
    expect(result.messages[0]).toContain('OTEL_EXPORTER_OTLP_ENDPOINT');
  });

  test('Should pass with all required configuration', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://example.com:4317';
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=ApiKey test';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(true);
    expect(result.hasWarnings).toBe(false);
    expect(result.messages.length).toBe(0);
  });

  test('Should warn when authentication headers are missing', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://example.com:4317';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(true);
    expect(result.hasWarnings).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('OTEL_EXPORTER_OTLP_HEADERS');
  });

  test('Should detect invalid endpoint URL', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'invalid-url';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(false);
    // Find the message about invalid URL format
    const invalidUrlMessage = result.messages.find(msg =>
      msg.includes('Invalid OTEL_EXPORTER_OTLP_ENDPOINT URL format')
    );
    expect(invalidUrlMessage).toBeDefined();
  });

  test('Should detect invalid protocol in endpoint URL', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'ftp://example.com';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(false);
    // Find the message about invalid protocol
    const invalidProtocolMessage = result.messages.find(msg =>
      msg.includes('Invalid OTEL_EXPORTER_OTLP_ENDPOINT protocol')
    );
    expect(invalidProtocolMessage).toBeDefined();
  });

  test('Should detect invalid headers format', () => {
    process.env.OTEL_SERVICE_NAME = 'test-service';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://example.com:4317';
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'invalid-format';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(true); // Headers are optional
    expect(result.hasWarnings).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('Invalid OTEL_EXPORTER_OTLP_HEADERS format');
  });

  test('Should handle disabled OpenTelemetry', () => {
    process.env.OTEL_SDK_DISABLED = 'true';

    const result = validateOtelConfig();

    expect(result.isValid).toBe(true);
    expect(result.hasWarnings).toBe(true);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]).toContain('OpenTelemetry is explicitly disabled');
  });
});
