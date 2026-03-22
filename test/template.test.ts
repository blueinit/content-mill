import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplate, buildDocument, stripMarkdown } from '../src/core/template.js';
import type { TemplateVars } from '../src/core/types.js';

const vars: TemplateVars = {
  slug: 'platform-collections',
  heading: 'Collections Overview',
  body: 'Collections are the core data structure. They store records with flexible schemas.',
  path: '/platform/collections/',
  nav_section: 'Platform',
  filename: 'collections.md',
  frontmatter: { category: 'data', priority: 1 },
  chunk_heading: 'Creating a Collection',
  chunk_body: 'Use the API to create a new collection.',
  chunk_index: 0,
};

describe('resolveTemplate', () => {
  it('returns static values unchanged', () => {
    assert.equal(resolveTemplate('docs', vars), 'docs');
  });

  it('resolves simple variable', () => {
    assert.equal(resolveTemplate('{{ slug }}', vars), 'platform-collections');
  });

  it('resolves nested variable (frontmatter.category)', () => {
    assert.equal(resolveTemplate('{{ frontmatter.category }}', vars), 'data');
  });

  it('preserves type for numeric nested values', () => {
    assert.equal(resolveTemplate('{{ frontmatter.priority }}', vars), 1);
  });

  it('handles inline interpolation', () => {
    assert.equal(
      resolveTemplate('{{ slug }}-{{ chunk_index }}', vars),
      'platform-collections-0',
    );
  });

  it('applies truncate filter', () => {
    const result = resolveTemplate('{{ body | truncate(20) }}', vars);
    assert.equal(result, 'Collections are the ...');
  });

  it('applies slugify filter', () => {
    assert.equal(
      resolveTemplate('{{ heading | slugify }}', vars),
      'collections-overview',
    );
  });

  it('applies lower filter', () => {
    assert.equal(resolveTemplate('{{ nav_section | lower }}', vars), 'platform');
  });

  it('applies upper filter', () => {
    assert.equal(resolveTemplate('{{ nav_section | upper }}', vars), 'PLATFORM');
  });

  it('chains multiple filters', () => {
    assert.equal(
      resolveTemplate('{{ heading | lower | slugify }}', vars),
      'collections-overview',
    );
  });

  it('returns undefined for missing variables', () => {
    assert.equal(resolveTemplate('{{ nonexistent }}', vars), undefined);
  });
});

describe('buildDocument', () => {
  it('builds a document from field templates', () => {
    const fields = {
      id: '{{ slug }}',
      title: '{{ heading }}',
      excerpt: '{{ body | truncate(30) }}',
      type: 'docs',
      section: '{{ nav_section }}',
    };

    const doc = buildDocument(fields, vars);
    assert.equal(doc.id, 'platform-collections');
    assert.equal(doc.title, 'Collections Overview');
    assert.equal(doc.type, 'docs');
    assert.equal(doc.section, 'Platform');
    assert.ok((doc.excerpt as string).endsWith('...'));
  });
});

describe('stripMarkdown', () => {
  it('removes headings', () => {
    assert.equal(stripMarkdown('## Hello'), 'Hello');
  });

  it('removes bold and italic', () => {
    assert.equal(stripMarkdown('**bold** and *italic*'), 'bold and italic');
  });

  it('removes links, keeps text', () => {
    assert.equal(stripMarkdown('[click here](https://example.com)'), 'click here');
  });

  it('removes code blocks', () => {
    assert.equal(stripMarkdown('before\n```js\ncode\n```\nafter'), 'before\n\nafter');
  });

  it('removes inline code backticks', () => {
    assert.equal(stripMarkdown('use `npm install`'), 'use npm install');
  });
});
