# Contributing

## Development Setup

1. Fork and clone the repository
2. Run `./setup.sh` to set up the environment
3. Create a feature branch: `git checkout -b feature/my-feature`

## Project Structure

- `client/` - React frontend (Vite, TypeScript, Tailwind)
- `server/` - Node.js backend (Socket.IO, Docker)
- `runtimes/` - Dockerfiles for each language runtime
- `docs/` - Documentation

## Development Commands

```bash
# Server (with hot reload)
cd server && npm run dev

# Client (with hot reload)
cd client && npm run dev

# Build server
cd server && npm run build

# Lint client
cd client && npm run lint
```

## Adding a New Language Runtime

1. Create `runtimes/<language>/Dockerfile`
2. Add image name to `server/src/config.ts`
3. Update `setup.sh` to build the new image
4. Add file extension mapping in `client/src/lib/file-utils.ts`

## Code Style

- TypeScript for both frontend and backend
- Use existing patterns from the codebase
- Keep functions small and focused
- Add comments for complex logic

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Create PR with clear description
4. Wait for review

## Questions?

Open an issue on GitHub.
