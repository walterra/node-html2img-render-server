# Changelog

All notable changes to the node-html2img-render-server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1] - 2025-05-13

### Changed

- Improved telemetry opt-in behavior with clearer status messages
- Telemetry no longer logs errors when configuration is missing
- Docker containers now only load OpenTelemetry when OTEL_EXPORTER_OTLP_ENDPOINT is set
- Refined instrumentation for better tracing and performance analysis
- Added unit tests for OpenTelemetry instrumentation

## [1.1.0] - 2025-05-09

### Added

- OpenTelemetry integration using `@elastic/opentelemetry-node`
- Chore: Added eslint/prettier (c29c829)

## [1.0.1] - 2025-05-06

Maintenance release with Docker container improvements.

### Added

- GitHub repository URL in package.json
- Explicit PLAYWRIGHT_BROWSERS_PATH environment variable

### Fixed

- Playwright browser installation in Docker containers
- Browser cache directory permissions
- Browser launch error handling

## [1.0.0] - 2025-05-05

First stable release.

### Added

- HTML to image rendering service using Playwright
- Direct HTML/CSS/JS input without requiring public URLs
- Consistent rendering environment for visual testing
- Custom font and image injection
- Configurable viewport and wait conditions
- Element selection and clipping
- PNG/JPEG format support with quality settings
- API key authentication and rate limiting
- JSON or binary image response formats
- Docker support
- npx command-line support
