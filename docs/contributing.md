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
cd server && npm run dev      # Backend
cd client && npm run dev      # Frontend
cd server && npm test         # Tests
```

## Pull Request Process

1. Tests pass: `./run-tests.sh`
2. Add tests for new features
3. Update documentation if needed
4. Create PR

📖 **See [docs/contributing-testing.md](contributing-testing.md) for testing guidelines.**

## Code Style

- TypeScript for both frontend and backend
- Use existing patterns from the codebase
- Keep functions small and focused
- Add comments for complex logic
- Run tests before committing

## Adding a New Language Runtime

1. Create `runtimes/<language>/Dockerfile`
2. Add image name to `server/src/config.ts`
3. Update `setup.sh` to build the new image
4. Add file extension mapping in `client/src/lib/file-utils.ts`
5. Add tests for new language support
6. Update documentation

## Pre-commit Checklist

- [ ] Code is TypeScript and properly typed
- [ ] Tests pass: `./run-tests.sh`
- [ ] No console errors or warnings
- [ ] Documentation updated if needed
- [ ] Commit message is clear and descriptive

```bash
# Pre-commit verification
cd server && npm test -- --bail
cd ../client && npm run test:run -- --bail
```

## Pull Request Process

1. **Ensure all tests pass**: `./run-tests.sh`
2. **Update documentation** if needed
3. **Include test coverage** for new features
4. **Create PR** with clear description including:
   - What changes are made
   - Why they're needed
   - How to test the changes
   - Any breaking changes (if applicable)

## Questions?

See the full [Testing Guide](testing.md) for comprehensive testing documentation. 4. Wait for review

## Questions?

Open an issue on GitHub.
