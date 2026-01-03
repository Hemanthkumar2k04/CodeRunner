# Contributing

We welcome contributions!

## Setup

1. Fork and clone the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```
4. Build Docker images: `cd runtimes && ./build-all.sh`
5. Start dev servers:

   ```bash
   # Terminal 1
   cd server && npm run dev

   # Terminal 2
   cd client && npm run dev
   ```

## Before Submitting

- Follow existing code style (TypeScript, React hooks conventions)
- Test your changes on at least 2 languages
- Update relevant docs in `/docs`
- Run `npm run build` in both client and server to verify compilation

## PR Process

1. Make your changes with clear commit messages
2. Push to your fork
3. Open a PR with description of changes
4. Address any review feedback

## Adding a New Language

1. Create `runtimes/language/Dockerfile`
2. Add to `server/src/config.ts`
3. Test execution with sample code
4. Update docs
