import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import type { ContentMillConfig, SourceConfig } from './types.js';

export function loadConfig(filePath: string): ContentMillConfig {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid config file: ${filePath}`);
  }

  const meili = parsed.meili as ContentMillConfig['meili'] | undefined;
  if (!meili?.host) {
    throw new Error('Config missing meili.host');
  }

  meili.apiKey = resolveEnvVars(meili.apiKey ?? '');
  meili.host = resolveEnvVars(meili.host);

  const sources = parsed.sources as SourceConfig[] | undefined;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('Config must define at least one source');
  }

  for (const source of sources) {
    if (!source.name) throw new Error('Each source must have a name');
    if (!source.type) throw new Error(`Source "${source.name}" must have a type`);
    if (!source.index) throw new Error(`Source "${source.name}" must have an index`);
    if (!source.document?.primaryKey) throw new Error(`Source "${source.name}" must define document.primaryKey`);
    if (!source.document?.fields || Object.keys(source.document.fields).length === 0) {
      throw new Error(`Source "${source.name}" must define at least one document field`);
    }
  }

  return { meili, sources };
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)}/g, (_, name) => {
    const envVal = process.env[name];
    if (envVal === undefined) {
      throw new Error(`Environment variable "${name}" is not set`);
    }
    return envVal;
  });
}
