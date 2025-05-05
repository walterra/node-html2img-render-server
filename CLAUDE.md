# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands
- Install dependencies: `npm install`
- Start service: `npm start` (runs `node server.js`)
- Run tests: `npm test`
- Run single test: `npm test -- --testPathPattern=path/to/test`
- Lint code: `npm run lint`
- Build Docker: `docker build -t html-renderer .`
- Run Docker: `docker run -p 3000:3000 html-renderer`

## Code Style Guidelines
- **Formatting**: Follow JavaScript Standard Style
- **Imports**: Group imports by external packages, internal modules, then types
- **Types**: Use TypeScript for type safety; prefer explicit return types on functions
- **Naming**: Use camelCase for variables/functions, PascalCase for classes/components
- **Error Handling**: Use try/catch blocks with structured error objects
- **API Structure**: Follow RESTful design patterns for endpoints
- **Async**: Use async/await over promise chains
- **Security**: Sanitize HTML input, validate request parameters
- **Comments**: Document complex logic, API parameters, and return values