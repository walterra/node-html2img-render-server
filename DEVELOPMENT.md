# Development Guide

This document provides information for developers who want to modify, extend, or contribute to the html2img-render-server.

## Project Structure

```
html2img-render-server/
├── src/
│   ├── middleware/      # Express middleware (error handling, security)
│   ├── routes/          # API routes
│   ├── services/        # Core functionality
│   └── utils/           # Utilities
├── public/              # Public assets
├── tests/               # Test files
│   └── snapshots/       # Image snapshots for tests
├── server.js            # Main server entry point
├── Dockerfile           # Docker configuration
├── package.json         # Dependencies and scripts
├── README.md            # User documentation
├── EXAMPLES.md          # Usage examples
└── DEVELOPMENT.md       # This file
```

## Setup Development Environment

### Prerequisites

- Node.js (v18 or later)
- Yarn package manager
- Docker (optional, for containerized development)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourorg/html2img-render-server.git
cd html2img-render-server

# Install dependencies
yarn

# Start in development mode
yarn dev
```

The service will start on `http://localhost:3000` with auto-reload enabled for development.

## Running Tests

```bash
# Run all tests
yarn test

# Run a specific test
yarn test --testPathPattern=tests/render.test.js

# Update snapshots if needed
yarn test -u
```

### Image Snapshot Testing

This project uses Jest's snapshot testing capabilities with `jest-image-snapshot` to verify that rendered images match expected baselines:

```bash
# Run image format snapshot tests
yarn test --testPathPattern=tests/integration/image-format.test.js

# Update image snapshots when intentional changes are made
yarn test --testPathPattern=tests/integration/image-format.test.js -u
```

The service tests both PNG and JPEG formats with snapshots to ensure consistent rendering across formats. When working with JPEG snapshots, remember that quality settings affect the visual output and file size.

## Implementation Details

### Key Components

1. **Renderer Service** (`src/services/renderer.js`):

   - Uses Playwright to render HTML content in a Chromium environment
   - Handles screenshot capture and metadata embedding
   - Returns image data directly in the response

2. **Asset Handling** (`src/services/assets.js`):

   - Injects custom fonts and assets into the page
   - Intercepts resource requests to serve embedded assets

3. **API Routes** (`src/routes/render.js`):

   - Defines the `/render` endpoint and parameter handling
   - Supports both direct image and JSON response formats

4. **Security Middleware** (`src/middleware/security.js`):
   - Implements input validation
   - Rate limiting
   - Protection against malicious code

### Architecture

The service uses a simple Express.js based architecture:

1. **Stateless Rendering**: Each request is completely independent, with no data persistence between requests
2. **Sandboxed Execution**: All JavaScript is executed in an isolated Playwright browser context
3. **Embedded Metadata**: Render metadata is embedded directly in the image using EXIF and returned in HTTP headers
4. **Parallel Processing**: Capable of handling multiple rendering requests simultaneously

## Building the Docker Image

```bash
# Build the Docker image
docker build -t node-html2img-render-server .

# Run the Docker container (without telemetry)
docker run -p 3000:3000 -e API_KEY="your-api-key" node-html2img-render-server

# Run with OpenTelemetry for observability
docker run -p 3000:3000 \
  -e API_KEY="your-api-key" \
  -e OTEL_SERVICE_NAME="node-html2img-render-server" \
  -e OTEL_EXPORTER_OTLP_ENDPOINT="your-otlp-endpoint" \
  -e OTEL_EXPORTER_OTLP_HEADERS="Authorization=ApiKey your-api-key" \
  node-html2img-render-server
```

## Configuration

Environment variables that can be set:

- `API_KEY`: Authentication key for API access (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: 60)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 60000)
- `REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 30000)

### OpenTelemetry Configuration

- `OTEL_SERVICE_NAME`: Service name for telemetry reporting
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint (required for telemetry)
- `OTEL_EXPORTER_OTLP_HEADERS`: Headers for OTLP endpoint authentication (format: `Authorization=ApiKey your-api-key`)
- `OTEL_SDK_DISABLED`: Set to `true` to explicitly disable telemetry

The service automatically loads the OpenTelemetry instrumentation at startup via the `-r @elastic/opentelemetry-node` flag. For Docker deployments, all telemetry settings can be passed as environment variables.

## Extending the Service

### Adding New Features

1. Implement the feature in the appropriate module
2. Add tests for the new functionality
3. Update documentation (README.md and EXAMPLES.md)
4. Submit a pull request

### Common Extension Points

- **Additional Response Formats**: Add new response formats in `src/routes/render.js`
- **Playwright Extensions**: Extend browser capabilities in `src/services/renderer.js`
- **Custom Screenshot Transformations**: Add image processing in the renderer service

## Performance Considerations

- **Browser Instances**: The service maintains a browser instance pool for better performance
- **Memory Usage**: Monitor memory usage, as rendering can be memory-intensive
- **Timeouts**: Configure appropriate timeouts to prevent hanging requests

## Security Best Practices

- Keep the service behind a firewall or API gateway
- Use HTTPS in production
- Always use the API key authentication for all endpoints
- Keep your API keys secure and rotate them periodically
- When making API requests, pass the API key as a query parameter: `?apiKey=your-api-key`
- Regularly update dependencies to address security vulnerabilities
- Use container security scanning in CI/CD pipelines

## Release Process

### Publishing a New Version

1. Update version in `package.json`
2. Update the CHANGELOG.md with the new version details
3. Commit changes and tag the release:
   ```bash
   git add .
   git commit -m "Release v1.x.x"
   git tag v1.x.x
   git push origin main --tags
   ```
4. Publish to npm:
   ```bash
   npm publish
   ```

### Publishing Docker Images

When releasing a new version, update and publish the Docker image:

1. **Log in to Docker Hub**:

   ```bash
   # Authenticate with Docker Hub
   docker login
   # Enter your Docker Hub username and password when prompted
   ```

2. **Build for the current architecture**:

   ```bash
   # Build with version tag
   docker build -t walterra/node-html2img-render-server:1.x.x .
   docker tag walterra/node-html2img-render-server:1.x.x walterra/node-html2img-render-server:latest

   # Push to Docker Hub
   docker push walterra/node-html2img-render-server:1.x.x
   docker push walterra/node-html2img-render-server:latest
   ```

3. **Build for multiple architectures with Docker Buildx** (recommended):

   ```bash
   # Set up buildx if not already configured
   docker buildx create --name mybuilder --driver docker-container --use

   # Build and push for multiple platforms in one command
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t walterra/node-html2img-render-server:1.x.x \
     -t walterra/node-html2img-render-server:latest \
     --push .
   ```

4. **Verify the image**:

   ```bash
   # Pull and test the image
   docker pull walterra/node-html2img-render-server:1.x.x
   docker run -p 3000:3000 -e API_KEY="test-key" walterra/node-html2img-render-server:1.x.x

   # Test a simple rendering request
   curl -X POST -H "Content-Type: application/json" \
     -H "X-API-Key: test-key" \
     -d '{"html":"<div style=\"background:blue;width:100px;height:100px;\"></div>"}' \
     http://localhost:3000/render -o test.png
   ```

5. **Update documentation**:
   - Update README.md with the latest Docker image version
   - Ensure the release notes mention the new Docker image

## Next Steps and Roadmap

- Implement baseline management within the service
- Add diff visualization tools
- Support for animations and transitions
- Automated baseline updates based on approved changes
- API versioning
- Performance optimizations for high-volume usage
