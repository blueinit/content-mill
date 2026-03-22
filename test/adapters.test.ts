import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { MkDocsAdapter } from '../src/adapters/mkdocs.js';
import { MarkdownDirAdapter } from '../src/adapters/markdown-dir.js';
import { JsonAdapter } from '../src/adapters/json.js';
import { HtmlAdapter } from '../src/adapters/html.js';
import type { SourceConfig } from '../src/core/types.js';

const fixturesDir = resolve(import.meta.dirname, 'fixtures');

const baseDoc = {
  primaryKey: 'id',
  fields: { id: '{{ slug }}' },
};

describe('MkDocsAdapter', () => {
  const adapter = new MkDocsAdapter();

  it('extracts all pages from nav', async () => {
    const source: SourceConfig = {
      name: 'test-mkdocs',
      type: 'mkdocs',
      index: 'docs',
      config: resolve(fixturesDir, 'mkdocs-site/mkdocs.yml'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items.length, 3); // index, collections, compute
  });

  it('extracts correct nav_section', async () => {
    const source: SourceConfig = {
      name: 'test-mkdocs',
      type: 'mkdocs',
      index: 'docs',
      config: resolve(fixturesDir, 'mkdocs-site/mkdocs.yml'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    const collections = items.find((i) => i.vars.slug === 'platform-collections');
    assert.ok(collections);
    assert.equal(collections.vars.nav_section, 'Platform');
  });

  it('extracts frontmatter', async () => {
    const source: SourceConfig = {
      name: 'test-mkdocs',
      type: 'mkdocs',
      index: 'docs',
      config: resolve(fixturesDir, 'mkdocs-site/mkdocs.yml'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    const collections = items.find((i) => i.vars.slug === 'platform-collections');
    assert.ok(collections);
    assert.equal(collections.vars.frontmatter.category, 'data');
  });

  it('supports chunking by heading', async () => {
    const source: SourceConfig = {
      name: 'test-mkdocs-chunked',
      type: 'mkdocs',
      index: 'docs',
      config: resolve(fixturesDir, 'mkdocs-site/mkdocs.yml'),
      document: baseDoc,
      chunking: { strategy: 'heading', level: 2 },
    };

    const items = await adapter.extract(source);
    // index.md has 2 h2s + intro = 3 chunks
    // collections.md has 2 h2s + intro = 3 chunks
    // compute.md has 1 h2 + intro = 2 chunks
    assert.ok(items.length > 3); // More items than pages
    const chunked = items.find((i) => i.vars.chunk_heading === 'Creating a Collection');
    assert.ok(chunked);
  });

  it('uses nav title as heading when available', async () => {
    const source: SourceConfig = {
      name: 'test-mkdocs',
      type: 'mkdocs',
      index: 'docs',
      config: resolve(fixturesDir, 'mkdocs-site/mkdocs.yml'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    const home = items.find((i) => i.vars.slug === 'index');
    assert.ok(home);
    assert.equal(home.vars.heading, 'Home');
  });
});

describe('MarkdownDirAdapter', () => {
  const adapter = new MarkdownDirAdapter();

  it('reads all markdown files from directory', async () => {
    const source: SourceConfig = {
      name: 'test-md-dir',
      type: 'markdown-dir',
      index: 'changelog',
      path: resolve(fixturesDir, 'markdown-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items.length, 1);
    assert.equal(items[0].vars.heading, 'Release 4.3.0');
  });

  it('extracts frontmatter from markdown files', async () => {
    const source: SourceConfig = {
      name: 'test-md-dir',
      type: 'markdown-dir',
      index: 'changelog',
      path: resolve(fixturesDir, 'markdown-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items[0].vars.frontmatter.version, '4.3.0');
  });
});

describe('JsonAdapter', () => {
  const adapter = new JsonAdapter();

  it('reads array of objects from a JSON file', async () => {
    const source: SourceConfig = {
      name: 'test-json',
      type: 'json',
      index: 'features',
      path: resolve(fixturesDir, 'json-dir/features.json'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items.length, 2);
  });

  it('maps JSON fields to template vars', async () => {
    const source: SourceConfig = {
      name: 'test-json',
      type: 'json',
      index: 'features',
      path: resolve(fixturesDir, 'json-dir/features.json'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    const collections = items.find((i) => i.vars.slug === 'collections');
    assert.ok(collections);
    assert.equal(collections.vars.heading, 'Collections');
    assert.equal(collections.vars.body, 'Flexible data structures for any content type');
  });

  it('exposes original JSON keys as template vars', async () => {
    const source: SourceConfig = {
      name: 'test-json',
      type: 'json',
      index: 'features',
      path: resolve(fixturesDir, 'json-dir/features.json'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items[0].vars.category, 'data');
  });

  it('reads directory of JSON files', async () => {
    const source: SourceConfig = {
      name: 'test-json-dir',
      type: 'json',
      index: 'features',
      path: resolve(fixturesDir, 'json-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items.length, 2);
  });
});

describe('HtmlAdapter', () => {
  const adapter = new HtmlAdapter();

  it('extracts title from HTML', async () => {
    const source: SourceConfig = {
      name: 'test-html',
      type: 'html',
      index: 'pages',
      path: resolve(fixturesDir, 'html-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.equal(items.length, 1);
    assert.equal(items[0].vars.heading, 'About Us');
  });

  it('strips HTML tags from body', async () => {
    const source: SourceConfig = {
      name: 'test-html',
      type: 'html',
      index: 'pages',
      path: resolve(fixturesDir, 'html-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.ok(items[0].vars.body.includes('We build tools for developers'));
    assert.ok(!items[0].vars.body.includes('<p>'));
  });

  it('strips nav and footer from body', async () => {
    const source: SourceConfig = {
      name: 'test-html',
      type: 'html',
      index: 'pages',
      path: resolve(fixturesDir, 'html-dir'),
      document: baseDoc,
    };

    const items = await adapter.extract(source);
    assert.ok(!items[0].vars.body.includes('Copyright'));
    assert.ok(!items[0].vars.body.includes('Home'));
  });
});
