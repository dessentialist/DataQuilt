# Contributing to DataQuilt

Thank you for your interest in contributing to DataQuilt! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/DataQuilt.git
   cd DataQuilt
   ```
3. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies**
   ```bash
   npm install
   ```
5. **Set up environment**
   ```bash
   cp .env.example .env
   # Configure your .env file
   ```

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Supabase account)
- Supabase project for auth and storage
- At least one LLM provider API key for testing

### Running Locally

```bash
# Development mode (runs API server and worker)
npm run dev

# Type checking
npm run check

# Linting
npm run make_lint

# Fix linting issues
npm run lint:fix
```

## Making Changes

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier (configured in the project)
- Write self-documenting code with clear variable names
- Add comments for complex logic

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for DeepSeek provider
fix: resolve CSV parsing issue with BOM
docs: update deployment guide
refactor: simplify prompt validation logic
```

### Testing

- Write tests for new features
- Ensure existing tests pass
- Test with multiple LLM providers when applicable
- Test error handling and edge cases

### Test API Keys

When writing tests that require API keys:
- Use invalid test keys with pattern: `sk-invalid-key-for-testing-*`
- Never commit real API keys
- Document test key patterns in test files

## Pull Request Process

1. **Update documentation** if needed
2. **Ensure tests pass**
3. **Run linting**: `npm run make_lint`
4. **Update CHANGELOG** if applicable (for public repo, this may be excluded)
5. **Create pull request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots for UI changes

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.logs or debug code
- [ ] No hardcoded secrets or credentials
- [ ] Linting passes

## Areas for Contribution

### High Priority

- Bug fixes
- Performance improvements
- Documentation improvements
- Test coverage
- Security enhancements

### Feature Ideas

- Additional LLM provider support
- Enhanced error handling
- UI/UX improvements
- Performance optimizations
- Developer experience improvements

## Code Structure

- `client/` - React frontend application
- `server/` - Express.js API server
- `worker/` - Background job processor
- `shared/` - Shared utilities and types
- `migrations/` - Database migrations

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues and discussions
- Review the documentation in the repository

Thank you for contributing to DataQuilt! 🎉

