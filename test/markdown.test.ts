import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, chunkByHeading } from '../src/core/markdown.js';

const sampleMd = `---
title: Test Page
category: platform
---

# Main Heading

Introduction paragraph.

## Section One

Content for section one.

## Section Two

Content for section two.

### Subsection

Nested content.
`;

describe('parseMarkdown', () => {
  it('extracts frontmatter', () => {
    const result = parseMarkdown(sampleMd);
    assert.equal(result.frontmatter.title, 'Test Page');
    assert.equal(result.frontmatter.category, 'platform');
  });

  it('extracts first H1 heading', () => {
    const result = parseMarkdown(sampleMd);
    assert.equal(result.heading, 'Main Heading');
  });

  it('strips markdown from body', () => {
    const result = parseMarkdown(sampleMd);
    assert.ok(result.body.includes('Introduction paragraph'));
    assert.ok(result.body.includes('Content for section one'));
    // Headings markers should be stripped
    assert.ok(!result.body.includes('# '));
  });
});

describe('chunkByHeading', () => {
  it('chunks by h2 headings', () => {
    const chunks = chunkByHeading(sampleMd, 2);
    // Chunk 0: content before first h2 (intro)
    // Chunk 1: Section One
    // Chunk 2: Section Two
    assert.equal(chunks.length, 3);
  });

  it('first chunk captures content before first heading', () => {
    const chunks = chunkByHeading(sampleMd, 2);
    assert.equal(chunks[0].heading, '');
    assert.ok(chunks[0].body.includes('Main Heading'));
    assert.ok(chunks[0].body.includes('Introduction paragraph'));
  });

  it('subsequent chunks have correct headings', () => {
    const chunks = chunkByHeading(sampleMd, 2);
    assert.equal(chunks[1].heading, 'Section One');
    assert.equal(chunks[2].heading, 'Section Two');
  });

  it('assigns sequential indexes', () => {
    const chunks = chunkByHeading(sampleMd, 2);
    assert.equal(chunks[0].index, 0);
    assert.equal(chunks[1].index, 1);
    assert.equal(chunks[2].index, 2);
  });

  it('chunks by h3 headings', () => {
    const chunks = chunkByHeading(sampleMd, 3);
    // Only one h3 in the sample
    assert.equal(chunks.length, 2);
    assert.equal(chunks[1].heading, 'Subsection');
  });
});
