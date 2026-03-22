import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { loadConfig } from '../src/core/config.js';

const tmpDir = resolve(import.meta.dirname, '.tmp-config-test');

describe('loadConfig', () => {
  it('loads a valid config file', () => {
    mkdirSync(tmpDir, { recursive: true });
    const configPath = resolve(tmpDir, 'valid.yml');
    writeFileSync(
      configPath,
      `
meili:
  host: http://localhost:7700
  apiKey: test-key

sources:
  - name: docs
    type: mkdocs
    index: docs
    config: ./mkdocs.yml
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
        title: "{{ heading }}"
      searchableAttributes: [title]
`,
    );

    const config = loadConfig(configPath);
    assert.equal(config.meili.host, 'http://localhost:7700');
    assert.equal(config.sources.length, 1);
    assert.equal(config.sources[0].name, 'docs');
    assert.deepEqual(config.sources[0].document.searchableAttributes, ['title']);

    rmSync(tmpDir, { recursive: true });
  });

  it('throws on missing meili.host', () => {
    mkdirSync(tmpDir, { recursive: true });
    const configPath = resolve(tmpDir, 'no-host.yml');
    writeFileSync(configPath, `meili:\n  apiKey: key\nsources: []\n`);

    assert.throws(() => loadConfig(configPath), /meili\.host/);
    rmSync(tmpDir, { recursive: true });
  });

  it('throws on empty sources', () => {
    mkdirSync(tmpDir, { recursive: true });
    const configPath = resolve(tmpDir, 'no-sources.yml');
    writeFileSync(configPath, `meili:\n  host: http://localhost:7700\n  apiKey: key\nsources: []\n`);

    assert.throws(() => loadConfig(configPath), /at least one source/);
    rmSync(tmpDir, { recursive: true });
  });

  it('throws on source missing document fields', () => {
    mkdirSync(tmpDir, { recursive: true });
    const configPath = resolve(tmpDir, 'no-fields.yml');
    writeFileSync(
      configPath,
      `
meili:
  host: http://localhost:7700
  apiKey: key
sources:
  - name: test
    type: mkdocs
    index: idx
    document:
      primaryKey: id
      fields: {}
`,
    );

    assert.throws(() => loadConfig(configPath), /at least one document field/);
    rmSync(tmpDir, { recursive: true });
  });

  it('resolves environment variables in meili config', () => {
    mkdirSync(tmpDir, { recursive: true });
    process.env.TEST_MEILI_KEY = 'secret-key-123';
    const configPath = resolve(tmpDir, 'env.yml');
    writeFileSync(
      configPath,
      `
meili:
  host: http://localhost:7700
  apiKey: \${TEST_MEILI_KEY}
sources:
  - name: test
    type: mkdocs
    index: idx
    config: ./mkdocs.yml
    document:
      primaryKey: id
      fields:
        id: "{{ slug }}"
`,
    );

    const config = loadConfig(configPath);
    assert.equal(config.meili.apiKey, 'secret-key-123');
    delete process.env.TEST_MEILI_KEY;
    rmSync(tmpDir, { recursive: true });
  });
});
