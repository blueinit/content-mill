import type { SourceAdapter } from '../core/types.js';
import { MkDocsAdapter } from './mkdocs.js';
import { MarkdownDirAdapter } from './markdown-dir.js';
import { JsonAdapter } from './json.js';
import { HtmlAdapter } from './html.js';

const adapters: Record<string, SourceAdapter> = {
  mkdocs: new MkDocsAdapter(),
  'markdown-dir': new MarkdownDirAdapter(),
  json: new JsonAdapter(),
  html: new HtmlAdapter(),
};

export function getAdapter(type: string): SourceAdapter {
  const adapter = adapters[type];
  if (!adapter) {
    throw new Error(`Unknown source type: "${type}". Available: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}
