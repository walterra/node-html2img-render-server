# Changelog

All notable changes to the node-html2img-render-server project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- OpenTelemetry support in Docker configuration
- Environment variables for telemetry in Dockerfile (OTEL_SERVICE_NAME, etc.)

### Changed

- Updated Docker CMD to use OpenTelemetry preload
- Improved documentation for Docker deployment with OpenTelemetry

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
