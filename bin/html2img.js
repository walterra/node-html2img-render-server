#!/usr/bin/env node

/**
 * Command-line interface for the node-html2img-render-server
 * Allows running the server via npx with configuration options
 */

const { program } = require('commander');
const { version, description } = require('../package.json');

// Load the server application
const app = require('../server');
const { logger } = require('../src/middleware/error');

// Define CLI options
program
  .name('node-html2img-server')
  .description(description)
  .version(version)
  .option('-p, --port <number>', 'Port to run the server on', 3000)
  .option('-h, --host <string>', 'Host to bind the server to', 'localhost')
  .option('-k, --api-key <string>', 'API key for authentication (required in production)')
  .option('-r, --rate-limit <number>', 'Rate limit (requests per minute)', 60)
  .option('-t, --timeout <number>', 'Request timeout in milliseconds', 30000);

// Parse command-line arguments
program.parse(process.argv);
const options = program.opts();

// Set environment variables based on options
if (options.apiKey) {
  process.env.API_KEY = options.apiKey;
} else if (process.env.NODE_ENV === 'production') {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: API_KEY is required in production mode.');
  console.error('Use --api-key option or set the API_KEY environment variable.');
  throw new Error('API_KEY is required in production mode');
} else if (!process.env.API_KEY) {
  // Generate a random API key for development
  const randomApiKey = 'dev-' + Math.random().toString(36).substring(2, 15);
  process.env.API_KEY = randomApiKey;
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Using auto-generated API key for development.');
  console.warn(`API Key: ${randomApiKey}`);
}

// Set rate limit if provided
if (options.rateLimit) {
  process.env.RATE_LIMIT_MAX = options.rateLimit;
  process.env.RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
}

// Set request timeout if provided
if (options.timeout) {
  process.env.REQUEST_TIMEOUT_MS = options.timeout;
}

// Start the server
const port = parseInt(options.port, 10);
const host = options.host;

const server = app.listen(port, host, () => {
  const serverUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  logger.info(`Server running at ${serverUrl}`);

  console.log('\x1b[32m%s\x1b[0m', '✨ node-html2img server started successfully!');
  console.log('\x1b[36m%s\x1b[0m', `Server URL: ${serverUrl}`);
  console.log('\x1b[36m%s\x1b[0m', `API Key:    ${process.env.API_KEY}`);
  console.log('\nExample usage:');
  console.log(`  curl -X POST "${serverUrl}/render?apiKey=${process.env.API_KEY}" \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log(
    '  -d \'{"html": "<div style=\\"padding: 20px; background: blue; color: white;\\">Hello World</div>"}\' \\'
  );
  console.log('  --output test.png');
});

// Handle graceful shutdown
const shutdown = () => {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down server...');
  server.close(() => {
    console.log('\x1b[32m%s\x1b[0m', 'Server shutdown complete.');
    // Close the server without calling process.exit
  });

  // Force exit after 5 seconds if server hasn't closed
  setTimeout(() => {
    console.log('\x1b[31m%s\x1b[0m', 'Server shutdown timed out, forcing exit.');
    throw new Error('Server shutdown timed out');
  }, 5000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
