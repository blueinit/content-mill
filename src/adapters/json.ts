import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, extname, relative } from 'node:path';
import type { SourceAdapter, SourceConfig, ContentItem, TemplateVars } from '../core/types.js';

/**
 * JSON source adapter.
 *
 * Handles two shapes:
 * 1. A single JSON file containing an array of objects → each object becomes a content item
 * 2. A directory of JSON files → each file becomes a content item
 *
 * All top-level keys in each JSON object are available as template variables.
 * Standard vars (slug, heading, body, etc.) default to empty if not present in the JSON.
 */
export class JsonAdapter implements SourceAdapter {
  async extract(source: SourceConfig): Promise<ContentItem[]> {
    if (!source.path) {
      throw new Error(`json source "${source.name}" must specify path`);
    }

    const target = resolve(source.path);
    const stat = statSync(target);

    if (stat.isFile()) {
      return this.extractFromFile(target);
    }

    if (stat.isDirectory()) {
      return this.extractFromDir(target);
    }

    throw new Error(`json source "${source.name}": path is neither a file nor directory`);
  }

  private extractFromFile(filePath: string): ContentItem[] {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((entry, i) => ({
      vars: jsonToVars(entry, basename(filePath, extname(filePath)), i),
    }));
  }

  private extractFromDir(dir: string): ContentItem[] {
    const items: ContentItem[] = [];

    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isFile() && extname(full) === '.json') {
        const raw = readFileSync(full, 'utf-8');
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed) ? parsed : [parsed];
        for (let i = 0; i < entries.length; i++) {
          items.push({
            vars: jsonToVars(entries[i], basename(full, '.json'), i),
          });
        }
      }
    }

    return items;
  }
}

function jsonToVars(
  obj: Record<string, unknown>,
  fileSlug: string,
  index: number,
): TemplateVars {
  return {
    slug: String(obj.slug ?? obj.id ?? `${fileSlug}-${index}`),
    heading: String(obj.title ?? obj.name ?? obj.heading ?? ''),
    body: String(obj.body ?? obj.content ?? obj.description ?? ''),
    path: String(obj.path ?? obj.url ?? ''),
    nav_section: String(obj.section ?? obj.category ?? ''),
    filename: `${fileSlug}.json`,
    frontmatter: {},
    // Spread all original keys so users can reference any field
    ...obj,
  };
}
