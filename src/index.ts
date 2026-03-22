export { loadConfig } from './core/config.js';
export { indexAll, extractSource } from './core/indexer.js';
export { buildDocument, resolveTemplate } from './core/template.js';
export { getAdapter } from './adapters/index.js';
export type {
  ContentMillConfig,
  MeiliConfig,
  SourceConfig,
  DocumentConfig,
  ChunkingConfig,
  TemplateVars,
  ContentItem,
  SourceAdapter,
} from './core/types.js';
