# Contributing to CodeRunner

Thank you for your interest in contributing to CodeRunner! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Questions?](#questions)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/CodeRunner.git
   cd CodeRunner
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/CodeRunner.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js v18+
- Docker (for runtime containers)
- npm

### Setup Instructions

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```
   This will build all Docker runtime images and install dependencies.

2. **Start the development servers:**
   ```bash
   # Terminal 1 - Backend
   cd server && npm run dev

   # Terminal 2 - Frontend
   cd client && npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
- Check if the issue has already been reported
- Verify the bug exists in the latest version
- Collect information about your environment

When submitting a bug report, include:
- Clear and descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots or error messages
- Environment details (OS, Node version, Docker version)

### Suggesting Features

Feature suggestions are welcome! Please:
- Use a clear and descriptive title
- Provide detailed description of the proposed feature
- Explain why this feature would be useful
- Consider implementation details if possible

### Contributing Code

We welcome code contributions! Here are areas where you can help:

- **Bug fixes**: Check open issues labeled `bug`
- **Features**: Look for issues labeled `enhancement` or `good first issue`
- **Documentation**: Improve README, docs, or code comments
- **Tests**: Add or improve test coverage
- **Performance**: Optimize existing code
- **Infrastructure**: Improve Docker configurations, build scripts

## Pull Request Process

1. **Update your fork** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Make your changes** in your feature branch:
   - Write clean, readable code
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   ./run-tests.sh
   ```

4. **Commit your changes** following the [commit message guidelines](#commit-message-guidelines):
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**:
   - Use a clear and descriptive title
   - Fill out the PR template completely
   - Link related issues
   - Ensure all CI checks pass
   - Request review from maintainers

### PR Review Process

- Maintainers will review your PR within a few days
- Address any requested changes promptly
- Keep the PR focused on a single feature/fix
- Be patient and respectful during the review process

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for type safety
- Follow existing code style (we use ESLint)
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Code Style

```typescript
// ✅ Good
const executeCode = async (code: string, language: string): Promise<ExecutionResult> => {
  // Implementation
};

// ❌ Bad
const exec = async (c: string, l: string) => {
  // Implementation
};
```

### File Organization

- Place components in `client/src/components/`
- Place utilities in respective `lib/` or `utils/` directories
- Add tests next to the files they test with `.test.ts` or `.test.tsx` extension
- Update documentation when adding new features

## Testing

All contributions should include appropriate tests:

### Frontend Tests

```bash
cd client
npm run test:run      # Run tests once
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Backend Tests

```bash
cd server
npm test              # Run all tests
npm test -- --coverage # With coverage
```

### Integration Tests

```bash
./run-tests.sh        # Run all tests including integration
```

### Writing Tests

- Write unit tests for all new functions
- Add integration tests for new endpoints
- Ensure test coverage remains high
- Test edge cases and error scenarios

## Commit Message Guidelines

We follow conventional commits for clear commit history:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Build process or tooling changes
- `style`: Code style changes (formatting, missing semicolons, etc.)

### Examples

```
feat(client): add keyboard shortcuts modal

Added a modal that displays all available keyboard shortcuts.
Users can access it by pressing Ctrl+K or clicking the help icon.

Closes #123
```

```
fix(server): resolve memory leak in container pool

Fixed issue where containers weren't being properly cleaned up
after timeout, causing memory leak during high load.

Fixes #456
```

## Questions?

If you have questions about contributing:

- Open an issue with the `question` label
- Check existing issues for similar questions
- Review the documentation in the `docs/` directory

## Recognition

Contributors will be recognized in:
- GitHub's contributor list
- Project documentation (if making significant contributions)

Thank you for contributing to CodeRunner! 🚀
