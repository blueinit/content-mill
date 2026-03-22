export interface ContentMillConfig {
  meili: MeiliConfig;
  sources: SourceConfig[];
}

export interface MeiliConfig {
  host: string;
  apiKey: string;
}

export interface SourceConfig {
  name: string;
  type: 'mkdocs' | 'markdown-dir' | 'json' | 'html';
  index: string;
  document: DocumentConfig;
  chunking?: ChunkingConfig;

  // mkdocs-specific
  config?: string;

  // markdown-dir-specific
  path?: string;
}

export interface DocumentConfig {
  primaryKey: string;
  fields: Record<string, string>;
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
  displayedAttributes?: string[];
}

export interface ChunkingConfig {
  strategy: 'page' | 'heading';
  level?: number;
}

/** Variables produced by source adapters and available in field templates. */
export interface TemplateVars {
  slug: string;
  heading: string;
  body: string;
  path: string;
  nav_section: string;
  filename: string;
  frontmatter: Record<string, unknown>;

  // Chunk-level (only when chunking by heading)
  chunk_heading?: string;
  chunk_body?: string;
  chunk_index?: number;

  // Allow arbitrary extra vars from adapters
  [key: string]: unknown;
}

/** A single content item produced by a source adapter before template application. */
export interface ContentItem {
  vars: TemplateVars;
}

/** Interface that all source adapters implement. */
export interface SourceAdapter {
  extract(source: SourceConfig): Promise<ContentItem[]>;
}
