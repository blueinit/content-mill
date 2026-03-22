import matter from 'gray-matter';
import { stripMarkdown } from './template.js';

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  heading: string;
  body: string;
}

export interface MarkdownChunk {
  heading: string;
  body: string;
  index: number;
}

/** Parse a markdown file, extracting frontmatter, first heading, and body. */
export function parseMarkdown(raw: string): ParsedMarkdown {
  const { data: frontmatter, content } = matter(raw);

  // Extract first H1 heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const heading = headingMatch ? headingMatch[1].trim() : '';

  // Body is everything after frontmatter (already handled by gray-matter)
  const body = stripMarkdown(content);

  return { frontmatter, heading, body };
}

/** Split markdown content into chunks by heading level. */
export function chunkByHeading(raw: string, level: number): MarkdownChunk[] {
  const { content } = matter(raw);
  const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`, 'gm');
  const chunks: MarkdownChunk[] = [];

  const lines = content.split('\n');
  let currentHeading = '';
  let currentBody: string[] = [];
  let chunkIndex = 0;

  for (const line of lines) {
    const headingMatch = line.match(new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`));
    if (headingMatch) {
      // Save previous chunk if it has content
      if (currentHeading || currentBody.length > 0) {
        chunks.push({
          heading: currentHeading,
          body: stripMarkdown(currentBody.join('\n')),
          index: chunkIndex++,
        });
      }
      currentHeading = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  // Push the last chunk
  if (currentHeading || currentBody.length > 0) {
    chunks.push({
      heading: currentHeading,
      body: stripMarkdown(currentBody.join('\n')),
      index: chunkIndex,
    });
  }

  return chunks;
}
