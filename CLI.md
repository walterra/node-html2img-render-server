# NODE-HTML2IMG CLI Usage

The node-html2img-render-server can be run directly from the command line using `npx` without requiring global installation.

## Quick Start

```bash
# Run the server with default settings
npx node-html2img-render-server

# Run with a custom port
npx node-html2img-render-server --port 8080

# Specify a custom API key
npx node-html2img-render-server --api-key your-secret-key
```

## Command Line Options

```
Usage: node-html2img-server [options]

A server for converting HTML to images with Playwright - allows direct HTML input and returns screenshots for visual testing

Options:
  -V, --version            output the version number
  -p, --port <number>      Port to run the server on (default: 3000)
  -h, --host <string>      Host to bind the server to (default: "localhost")
  -k, --api-key <string>   API key for authentication (required in production)
  -r, --rate-limit <number>  Rate limit (requests per minute) (default: 60)
  -t, --timeout <number>   Request timeout in milliseconds (default: 30000)
  --help                   display help for command
```

## API Key Authentication

In production environments, you must provide an API key either:
- As a command-line option: `--api-key your-secret-key`
- As an environment variable: `API_KEY=your-secret-key npx node-html2img-render-server`

In development mode, if no API key is provided, a random key will be generated and displayed in the console output.

## Example Usage

### Basic Local Development

```bash
npx node-html2img-render-server
```

This will:
1. Start the server on port 3000
2. Generate a random API key for development
3. Display example usage in the console

### Production Configuration

```bash
# Run with production settings
npx node-html2img-render-server \
  --port 8080 \
  --host 0.0.0.0 \
  --api-key your-secure-api-key \
  --rate-limit 120 \
  --timeout 60000
```

## Testing the Render Endpoint

Once the server is running, you can test it with a simple curl command:

```bash
curl -X POST "http://localhost:3000/render?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"html": "<div style=\"padding: 20px; background-color: blue; color: white;\">Hello World</div>"}' \
  --output test.png
```

## Using in Scripting and CI/CD

You can use the CLI in scripts and CI/CD pipelines:

```bash
# Start server in the background
npx node-html2img-render-server --port 8080 --api-key test-key &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run your tests or use the service
curl -X POST "http://localhost:8080/render?apiKey=test-key" \
  -H "Content-Type: application/json" \
  -d '{"html": "<div>Test Content</div>"}' \
  --output output.png

# Kill the server when done
kill $SERVER_PID
```

## Environment Variables

The CLI also supports configuration through environment variables:

### Service Configuration
- `API_KEY`: Authentication key
- `PORT`: Server port
- `RATE_LIMIT_MAX`: Maximum requests per minute
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds
- `REQUEST_TIMEOUT_MS`: Request timeout in milliseconds

### OpenTelemetry Configuration
- `OTEL_SERVICE_NAME`: Service name for telemetry reporting
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OpenTelemetry collector endpoint
- `OTEL_EXPORTER_OTLP_HEADERS`: Headers for OTLP endpoint authentication

Command-line options take precedence over environment variables.

For more details on telemetry configuration, see [Observability](docs/observability.md).