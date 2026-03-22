import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, extname, relative } from 'node:path';
import type { SourceAdapter, SourceConfig, ContentItem, TemplateVars } from '../core/types.js';
import { parseMarkdown, chunkByHeading } from '../core/markdown.js';

export class MarkdownDirAdapter implements SourceAdapter {
  async extract(source: SourceConfig): Promise<ContentItem[]> {
    if (!source.path) {
      throw new Error(`markdown-dir source "${source.name}" must specify path`);
    }

    const dir = resolve(source.path);
    const files = walkDir(dir).filter((f) => extname(f) === '.md');
    const items: ContentItem[] = [];

    for (const filePath of files) {
      const fileContent = readFileSync(filePath, 'utf-8');
      const rel = relative(dir, filePath);

      const slug = rel
        .replace(extname(rel), '')
        .replace(/\//g, '-')
        .replace(/^-+|-+$/g, '');

      const urlPath = '/' + rel.replace(extname(rel), '/').replace(/index\/$/, '');
      const parsed = parseMarkdown(fileContent);

      const baseVars: TemplateVars = {
        slug,
        heading: parsed.heading,
        body: parsed.body,
        path: urlPath,
        nav_section: '',
        filename: basename(rel),
        frontmatter: parsed.frontmatter,
      };

      if (source.chunking?.strategy === 'heading') {
        const level = source.chunking.level ?? 2;
        const chunks = chunkByHeading(fileContent, level);

        for (const chunk of chunks) {
          items.push({
            vars: {
              ...baseVars,
              chunk_heading: chunk.heading,
              chunk_body: chunk.body,
              chunk_index: chunk.index,
            },
          });
        }
      } else {
        items.push({ vars: baseVars });
      }
    }

    return items;
  }
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
