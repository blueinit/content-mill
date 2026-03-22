# Contributing to content-mill

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork the repo and clone your fork
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run tests: `npm test`

## Development

```bash
# Watch mode (rebuilds on file changes)
npm run dev

# Run tests
npm test

# Dry run against a local config
MEILI_MASTER_KEY=your-key node dist/cli.js index --config your-config.yml --dry-run
```

## Project Structure

```
src/
  adapters/          # Source type adapters (mkdocs, markdown-dir, json, html)
  core/
    config.ts        # Config file loading and validation
    indexer.ts       # Meilisearch indexing with atomic swap
    markdown.ts      # Markdown parsing and chunking
    template.ts      # Template engine for field mapping
    types.ts         # TypeScript type definitions
  cli.ts             # CLI entry point
  index.ts           # Library entry point (programmatic API)
test/
  fixtures/          # Test fixture files
  *.test.ts          # Tests (Node.js built-in test runner)
examples/            # Example config files
```

## How to Contribute

### Adding a New Source Adapter

This is the most common contribution. To add a new source type (e.g., OpenAPI, RSS, CSV):

1. Create `src/adapters/your-adapter.ts` implementing the `SourceAdapter` interface:

```typescript
import type { SourceAdapter, SourceConfig, ContentItem } from '../core/types.js';

export class YourAdapter implements SourceAdapter {
  async extract(source: SourceConfig): Promise<ContentItem[]> {
    // Read your source, produce ContentItem[] with template variables
  }
}
```

2. Register it in `src/adapters/index.ts`
3. Add the type to `SourceConfig.type` in `src/core/types.ts`
4. Add tests in `test/adapters.test.ts` with fixture files in `test/fixtures/`
5. Add an example config in `examples/`
6. Update `README.md` with documentation for the new source type

### Adding a New Template Filter

Filters are defined in `src/core/template.ts` in the `FILTER_MAP` object:

```typescript
const FILTER_MAP = {
  your_filter: (value, arg) => {
    // transform and return value
  },
};
```

Add tests in `test/template.test.ts`.

### Bug Fixes and Improvements

- Check existing issues first
- For non-trivial changes, open an issue to discuss before submitting a PR
- Keep changes focused — one fix or feature per PR

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure the build succeeds: `npm run build`
5. Write clear commit messages
6. Open a PR with:
   - What you changed and why
   - How to test it
   - Example config if adding a new adapter

## Code Style

- TypeScript strict mode
- No unnecessary dependencies — the tool should stay lightweight
- Match existing patterns in the codebase
- Tests for all new functionality

## Reporting Issues

When reporting bugs, include:
- Your content-mill version (`npx content-mill --version`)
- Your config file (redact API keys)
- The error output
- Your Node.js version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
