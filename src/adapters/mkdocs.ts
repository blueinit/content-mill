import { readFileSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import yaml from 'js-yaml';
import type { SourceAdapter, SourceConfig, ContentItem, TemplateVars } from '../core/types.js';
import { parseMarkdown, chunkByHeading } from '../core/markdown.js';

// mkdocs.yml files often contain Python-specific YAML tags (!!python/name:...)
// that js-yaml can't parse. This schema treats them as plain strings.
const MKDOCS_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type('tag:yaml.org,2002:python/name:', {
    kind: 'scalar',
    multi: true,
    representName: (name: object) => String(name),
    resolve: () => true,
    construct: (data: string) => data,
  }),
]);

interface MkDocsConfig {
  docs_dir?: string;
  nav?: NavEntry[];
}

type NavEntry = string | Record<string, NavEntry[] | string>;

interface FlatNavItem {
  title: string;
  file: string;
  section: string;
}

export class MkDocsAdapter implements SourceAdapter {
  async extract(source: SourceConfig): Promise<ContentItem[]> {
    if (!source.config) {
      throw new Error(`MkDocs source "${source.name}" must specify config (path to mkdocs.yml)`);
    }

    const configPath = resolve(source.config);
    const configDir = dirname(configPath);
    const raw = readFileSync(configPath, 'utf-8');
    const mkdocsConfig = yaml.load(raw, { schema: MKDOCS_SCHEMA }) as MkDocsConfig;

    const docsDir = resolve(configDir, mkdocsConfig.docs_dir ?? 'docs');
    const navItems = flattenNav(mkdocsConfig.nav ?? [], '');

    const items: ContentItem[] = [];

    for (const navItem of navItems) {
      const filePath = resolve(docsDir, navItem.file);

      let fileContent: string;
      try {
        fileContent = readFileSync(filePath, 'utf-8');
      } catch {
        console.warn(`Skipping ${navItem.file}: file not found`);
        continue;
      }

      const slug = navItem.file
        .replace(extname(navItem.file), '')
        .replace(/\//g, '-')
        .replace(/^-+|-+$/g, '');

      const urlPath = '/' + navItem.file.replace(extname(navItem.file), '/').replace(/index\/$/, '');

      const parsed = parseMarkdown(fileContent);

      const baseVars: Omit<TemplateVars, 'chunk_heading' | 'chunk_body' | 'chunk_index'> = {
        slug,
        heading: navItem.title || parsed.heading,
        body: parsed.body,
        path: urlPath,
        nav_section: navItem.section,
        filename: basename(navItem.file),
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
            } as TemplateVars,
          });
        }
      } else {
        items.push({ vars: baseVars as TemplateVars });
      }
    }

    return items;
  }
}

function flattenNav(entries: NavEntry[], parentSection: string): FlatNavItem[] {
  const items: FlatNavItem[] = [];

  for (const entry of entries) {
    if (typeof entry === 'string') {
      items.push({ title: '', file: entry, section: parentSection });
    } else {
      for (const [title, value] of Object.entries(entry)) {
        if (typeof value === 'string') {
          items.push({ title, file: value, section: parentSection || title });
        } else if (Array.isArray(value)) {
          items.push(...flattenNav(value, parentSection || title));
        }
      }
    }
  }

  return items;
}
