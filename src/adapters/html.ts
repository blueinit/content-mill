import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, extname, relative } from 'node:path';
import type { SourceAdapter, SourceConfig, ContentItem, TemplateVars } from '../core/types.js';

/**
 * HTML source adapter.
 *
 * Reads .html files from a directory, strips tags to produce plain text body,
 * and extracts the <title> and first <h1> as heading.
 */
export class HtmlAdapter implements SourceAdapter {
  async extract(source: SourceConfig): Promise<ContentItem[]> {
    if (!source.path) {
      throw new Error(`html source "${source.name}" must specify path`);
    }

    const dir = resolve(source.path);
    const files = walkDir(dir).filter((f) => extname(f) === '.html' || extname(f) === '.htm');
    const items: ContentItem[] = [];

    for (const filePath of files) {
      const raw = readFileSync(filePath, 'utf-8');
      const rel = relative(dir, filePath);

      const slug = rel
        .replace(extname(rel), '')
        .replace(/\//g, '-')
        .replace(/^-+|-+$/g, '');

      const urlPath = '/' + rel.replace(extname(rel), '').replace(/index$/, '');
      const heading = extractTitle(raw) || extractFirstH1(raw) || '';
      const body = stripHtml(raw);

      items.push({
        vars: {
          slug,
          heading,
          body,
          path: urlPath,
          nav_section: '',
          filename: basename(rel),
          frontmatter: {},
        },
      });
    }

    return items;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractFirstH1(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripHtml(match[1]).trim() : '';
}

function stripHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove nav, header, footer
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
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
