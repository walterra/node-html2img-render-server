/**
 * Utility for validating OpenTelemetry configuration
 * This module validates the OpenTelemetry configuration at startup
 * to provide immediate feedback if configuration is incorrect.
 */

/**
 * Validates required OpenTelemetry environment variables
 * @returns {Object} - Validation result with status and messages
 */
function validateOtelConfig() {
  const result = {
    isValid: true,
    messages: [],
    hasWarnings: false
  };

  // Check if OpenTelemetry is explicitly disabled
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    result.messages.push('OpenTelemetry is explicitly disabled via OTEL_SDK_DISABLED=true');
    result.hasWarnings = true;
    return result;
  }

  // Array to collect all validation errors and warnings
  const errors = [];
  const warnings = [];

  // Check for required environment variables
  const requiredVars = {
    OTEL_SERVICE_NAME: 'Service name for telemetry identification',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'OpenTelemetry collector endpoint'
  };

  const missingVars = [];
  for (const [varName, description] of Object.entries(requiredVars)) {
    if (!process.env[varName]) {
      missingVars.push(`${varName} (${description})`);
    }
  }

  if (missingVars.length > 0) {
    errors.push(`Missing required OpenTelemetry environment variables: ${missingVars.join(', ')}`);
  }

  // Validate endpoint format if provided
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      const url = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push(
          `Invalid OTEL_EXPORTER_OTLP_ENDPOINT protocol: ${url.protocol}. Must be http: or https:`
        );
      }
    } catch (error) {
      errors.push(`Invalid OTEL_EXPORTER_OTLP_ENDPOINT URL format: ${error.message}`);
    }
  }

  // Check for optional but recommended variables
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    warnings.push(
      'Warning: OTEL_EXPORTER_OTLP_HEADERS is not set - this might cause authentication failures with your collector endpoint'
    );
  }

  // Validate headers format if provided
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    try {
      // Headers should be in format "key1=value1,key2=value2"
      const headerParts = process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',');
      const invalidParts = headerParts.filter(part => !part.includes('='));

      if (invalidParts.length > 0) {
        warnings.push(
          `Invalid OTEL_EXPORTER_OTLP_HEADERS format. Each header must be in "key=value" format, separated by commas.`
        );
      }
    } catch (error) {
      warnings.push(`Error parsing OTEL_EXPORTER_OTLP_HEADERS: ${error.message}`);
    }
  }

  // Add all errors first (critical issues)
  result.messages.push(...errors);

  // Then add all warnings (non-critical issues)
  result.messages.push(...warnings);

  // Update result status
  if (errors.length > 0) {
    result.isValid = false;
  }

  if (warnings.length > 0) {
    result.hasWarnings = true;
  }

  return result;
}

module.exports = {
  validateOtelConfig
};
