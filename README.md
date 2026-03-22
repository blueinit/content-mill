# content-mill

[![npm version](https://img.shields.io/npm/v/@centrali-io/content-mill.svg)](https://www.npmjs.com/package/@centrali-io/content-mill)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Index static content sources into [Meilisearch](https://www.meilisearch.com/) with a configurable document shape. You define what goes in — content-mill handles extraction, transformation, and atomic indexing.

## Why?

Meilisearch is great for search, but there's no lightweight way to index static content (docs sites, changelogs, blog posts) without writing custom scrapers. content-mill bridges that gap:

- **You define the document shape** — map source content to any Meilisearch schema using templates
- **Multiple source types** — MkDocs, markdown directories, JSON files, HTML pages
- **Atomic index swap** — zero-downtime re-indexing on every release
- **Pluggable** — use as a CLI or import as a library

## Install

```bash
npm install @centrali-io/content-mill
# or globally
npm install -g @centrali-io/content-mill
```

## Quick Start

### 1. Create a config file

Create `content-mill.yml` in your project root:

```yaml
meili:
  host: http://localhost:7700
  apiKey: ${MEILI_MASTER_KEY}    # resolved from environment variable

sources:
  - name: docs
    type: mkdocs
    config: ./mkdocs.yml
    index: docs
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
        title: "{{ heading }}"
        content: "{{ body }}"
        excerpt: "{{ body | truncate(200) }}"
        section: "{{ nav_section }}"
        url: "{{ path }}"
        type: "docs"
      searchableAttributes: [title, content]
      filterableAttributes: [section, type]
      sortableAttributes: [title]
```

### 2. Run it

```bash
# Preview what documents would be indexed
MEILI_MASTER_KEY=your-key npx @centrali-io/content-mill index --config content-mill.yml --dry-run

# Index for real
MEILI_MASTER_KEY=your-key npx @centrali-io/content-mill index --config content-mill.yml
```

## CLI Usage

```
content-mill index --config <path> [--source <name>] [--dry-run]
```

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Path to config file (required) |
| `-s, --source <name>` | Index only a specific source by name |
| `--dry-run` | Extract and print documents without pushing to Meilisearch |

## Programmatic Usage

```ts
import { loadConfig, indexAll } from 'content-mill';

// From a config file
const config = loadConfig('./content-mill.yml');
await indexAll(config, { dryRun: false });

// Or build config in code
await indexAll({
  meili: {
    host: 'https://search.example.com',
    apiKey: process.env.MEILI_MASTER_KEY!,
  },
  sources: [{
    name: 'docs',
    type: 'mkdocs',
    index: 'docs',
    config: './mkdocs.yml',
    document: {
      primaryKey: 'id',
      fields: {
        id: '{{ slug }}',
        title: '{{ heading }}',
        content: '{{ body }}',
      },
      searchableAttributes: ['title', 'content'],
    },
  }],
}, { dryRun: false });
```

## Source Types

### `mkdocs`

Reads a `mkdocs.yml` config, extracts the nav structure, and parses each referenced markdown file. The nav tree provides `nav_section` context so you know which section each page belongs to.

```yaml
sources:
  - name: docs
    type: mkdocs
    config: ./mkdocs.yml
    index: docs
    chunking:
      strategy: heading
      level: 2
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}-{{ chunk_index }}"
        title: "{{ chunk_heading }}"
        content: "{{ chunk_body }}"
        page_title: "{{ heading }}"
        section: "{{ nav_section }}"
        url: "{{ path }}#{{ chunk_heading | slugify }}"
        type: "docs"
      searchableAttributes: [title, content, page_title]
      filterableAttributes: [section, type]
      sortableAttributes: [title]
      displayedAttributes: [title, page_title, url, section, type]
```

**Example output document:**

```json
{
  "id": "platform-collections-1",
  "title": "Creating a Collection",
  "content": "Use the API to create a new collection with a name and schema...",
  "page_title": "Collections",
  "section": "Platform",
  "url": "/platform/collections/#creating-a-collection",
  "type": "docs"
}
```

### `markdown-dir`

Reads all `.md` files recursively from a directory. Good for changelogs, blog posts, or any flat collection of markdown. Supports YAML frontmatter — access fields via `{{ frontmatter.fieldname }}`.

```yaml
sources:
  - name: changelog
    type: markdown-dir
    path: ./changelog/
    index: changelog
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
        title: "{{ heading }}"
        content: "{{ body }}"
        excerpt: "{{ body | truncate(150) }}"
        version: "{{ frontmatter.version }}"
        date: "{{ frontmatter.date }}"
        url: "/changelog{{ path }}"
        type: "changelog"
      searchableAttributes: [title, content]
      filterableAttributes: [version, type]
      sortableAttributes: [date]
```

**Example input file** (`changelog/v4.3.0.md`):

```markdown
---
version: "4.3.0"
date: "2026-03-21"
---

# Release 4.3.0

## New Features

- AI-powered page assembly
- Declarative modal system
```

**Example output document:**

```json
{
  "id": "v4-3-0",
  "title": "Release 4.3.0",
  "content": "Release 4.3.0\n\nNew Features\n\nAI-powered page assembly\nDeclarative modal system",
  "excerpt": "Release 4.3.0\n\nNew Features\n\nAI-powered page assembly\nDeclarative modal system...",
  "version": "4.3.0",
  "date": "2026-03-21",
  "url": "/changelog/v4-3-0/",
  "type": "changelog"
}
```

### `json`

Reads a single JSON file (containing an array of objects) or a directory of `.json` files. Each object becomes a content item. All top-level keys from the JSON are available as template variables, so you can reference any field directly.

```yaml
sources:
  - name: features
    type: json
    path: ./data/features.json
    index: features
    document:
      primaryKey: id
      fields:
        id: "{{ id }}"
        title: "{{ title }}"
        content: "{{ description }}"
        category: "{{ category }}"
        url: "/features/{{ id }}"
        type: "feature"
      searchableAttributes: [title, content]
      filterableAttributes: [category, type]
```

**Example input file** (`data/features.json`):

```json
[
  {
    "id": "collections",
    "title": "Collections",
    "description": "Flexible data structures for any content type",
    "category": "data"
  },
  {
    "id": "compute",
    "title": "Compute",
    "description": "Serverless functions in sandboxed environments",
    "category": "platform"
  }
]
```

**Example output document:**

```json
{
  "id": "collections",
  "title": "Collections",
  "content": "Flexible data structures for any content type",
  "category": "data",
  "url": "/features/collections",
  "type": "feature"
}
```

### `html`

Reads `.html` and `.htm` files recursively from a directory. Strips `<script>`, `<style>`, `<nav>`, `<header>`, and `<footer>` blocks, then removes all remaining tags to produce clean text. Extracts `<title>` and first `<h1>` as heading.

```yaml
sources:
  - name: site
    type: html
    path: ./public/
    index: site_pages
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
        title: "{{ heading }}"
        content: "{{ body }}"
        excerpt: "{{ body | truncate(200) }}"
        url: "{{ path }}"
        type: "page"
      searchableAttributes: [title, content]
      filterableAttributes: [type]
```

**Example input file** (`public/about.html`):

```html
<!DOCTYPE html>
<html>
<head><title>About Us</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <h1>About Our Platform</h1>
  <p>We build tools for developers to manage content at scale.</p>
  <footer>Copyright 2026</footer>
</body>
</html>
```

**Example output document:**

```json
{
  "id": "about",
  "title": "About Us",
  "content": "About Our Platform We build tools for developers to manage content at scale.",
  "excerpt": "About Our Platform We build tools for developers to manage content at scale.",
  "url": "/about",
  "type": "page"
}
```

## Multi-Source Example

Index multiple content types in a single config:

```yaml
meili:
  host: http://localhost:7700
  apiKey: ${MEILI_MASTER_KEY}

sources:
  - name: docs
    type: mkdocs
    config: ./mkdocs.yml
    index: docs
    chunking:
      strategy: heading
      level: 2
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}-{{ chunk_index }}"
        title: "{{ chunk_heading }}"
        content: "{{ chunk_body }}"
        section: "{{ nav_section }}"
        url: "{{ path }}"
        type: "docs"
      searchableAttributes: [title, content]
      filterableAttributes: [section, type]

  - name: changelog
    type: markdown-dir
    path: ./changelog/
    index: changelog
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
        title: "{{ heading }}"
        content: "{{ body }}"
        version: "{{ frontmatter.version }}"
        type: "changelog"
      searchableAttributes: [title, content]
      filterableAttributes: [version, type]

  - name: features
    type: json
    path: ./data/features.json
    index: features
    document:
      primaryKey: id
      fields:
        id: "{{ id }}"
        title: "{{ title }}"
        content: "{{ description }}"
        category: "{{ category }}"
        type: "feature"
      searchableAttributes: [title, content]
      filterableAttributes: [category, type]
```

```bash
# Index everything
npx @centrali-io/content-mill index --config content-mill.yml

# Index only docs
npx @centrali-io/content-mill index --config content-mill.yml --source docs
```

## Template Variables

Source adapters extract these variables, which you reference in your `document.fields` using `{{ variable }}` syntax:

| Variable | Description |
|----------|-------------|
| `slug` | URL-safe ID derived from file path |
| `heading` | First H1 heading, nav title, or JSON title |
| `body` | Full content with markdown/HTML stripped |
| `path` | URL path derived from file path |
| `nav_section` | Parent section from mkdocs.yml nav (mkdocs only) |
| `filename` | Original filename |
| `frontmatter.*` | Any YAML frontmatter fields (markdown sources) |

When using `chunking`, additional variables are available per chunk:

| Variable | Description |
|----------|-------------|
| `chunk_heading` | The heading text for this chunk |
| `chunk_body` | Content under that heading |
| `chunk_index` | Position within the page (0-based) |

For `json` sources, all top-level keys from each JSON object are also available as template variables.

## Template Filters

Apply filters with the pipe syntax: `{{ variable | filter }}`.

| Filter | Description | Example |
|--------|-------------|---------|
| `truncate(n)` | Truncate to n characters | `{{ body \| truncate(200) }}` |
| `slugify` | URL-safe slug | `{{ heading \| slugify }}` |
| `lower` | Lowercase | `{{ heading \| lower }}` |
| `upper` | Uppercase | `{{ nav_section \| upper }}` |
| `strip_md` | Strip markdown formatting | `{{ body \| strip_md }}` |

Filters can be chained: `{{ heading | lower | slugify }}`.

## Chunking

Split pages into smaller documents by heading level for more granular search results.

```yaml
sources:
  - name: docs
    type: mkdocs
    config: ./mkdocs.yml
    index: docs
    chunking:
      strategy: heading    # split by heading
      level: 2             # split on ## headings
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}-{{ chunk_index }}"
        title: "{{ chunk_heading }}"
        content: "{{ chunk_body }}"
        page_title: "{{ heading }}"
        anchor: "{{ chunk_heading | slugify }}"
```

Without chunking (or with `strategy: page`), each file produces one document.

## Index Settings

Configure Meilisearch index settings per source:

```yaml
document:
  primaryKey: id
  fields: { ... }
  searchableAttributes: [title, content]
  filterableAttributes: [section, type]
  sortableAttributes: [title]
  displayedAttributes: [title, url, section, excerpt, type]
```

These map directly to [Meilisearch index settings](https://www.meilisearch.com/docs/reference/api/settings).

## Atomic Index Swap

content-mill uses Meilisearch's index swap feature to ensure zero-downtime re-indexing:

1. Creates a temporary index (`docs_tmp`)
2. Pushes all documents to the temp index
3. Atomically swaps `docs_tmp` with `docs`
4. Deletes the old index

This means your search is never down during re-indexing, and if something fails mid-way, your existing index is untouched.

## CI/CD Integration

Add to your release pipeline:

```yaml
# GitHub Actions example
- name: Index docs in Meilisearch
  env:
    MEILI_MASTER_KEY: ${{ secrets.MEILI_MASTER_KEY }}
  run: npx @centrali-io/content-mill index --config content-mill.yml
```

## Config Reference

```yaml
meili:
  host: string              # Meilisearch URL (required)
  apiKey: string             # API key, supports ${ENV_VAR} syntax (required)

sources:
  - name: string             # Source name (required)
    type: string             # mkdocs | markdown-dir | json | html (required)
    index: string            # Target Meilisearch index name (required)

    # Source-specific
    config: string           # Path to mkdocs.yml (mkdocs type)
    path: string             # Path to directory or file (other types)

    # Chunking (optional, markdown sources only)
    chunking:
      strategy: string       # "page" (default) or "heading"
      level: number          # Heading level to split on (default: 2)

    # Document shape (required)
    document:
      primaryKey: string                  # Meilisearch primary key field (required)
      fields:                             # Field templates (required, at least one)
        fieldName: "{{ template }}"
      searchableAttributes: [string]      # Optional
      filterableAttributes: [string]      # Optional
      sortableAttributes: [string]        # Optional
      displayedAttributes: [string]       # Optional
```

## License

MIT
