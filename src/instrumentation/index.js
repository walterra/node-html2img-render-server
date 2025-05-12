/**
 * Centralized instrumentation module
 * This module provides all the instrumentation utilities in a centralized location
 */

// Re-export the telemetry validator
const { validateOtelConfig } = require('../utils/telemetry-validator');

// Expose all instrumentation tools through a single import
module.exports = {
  // Validator
  validateOtelConfig,
  
  // Core telemetry utilities
  ...require('./telemetry'),
  
  // Higher-order function wrappers
  ...require('./wrappers'),
  
  // Metrics registration and recording
  ...require('./metrics'),
  
  // Router instrumentation
  ...require('./router')
};