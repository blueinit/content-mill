import type { TemplateVars } from './types.js';

const FILTER_MAP: Record<string, (value: string, arg?: string) => string> = {
  truncate: (value, arg) => {
    const len = parseInt(arg ?? '200', 10);
    return value.length > len ? value.slice(0, len) + '...' : value;
  },
  slugify: (value) =>
    value
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  lower: (value) => value.toLowerCase(),
  upper: (value) => value.toUpperCase(),
  strip_md: (value) => stripMarkdown(value),
};

/**
 * Resolve a template string like `{{ body | truncate(200) }}` against vars.
 * If the template has no `{{ }}` expressions, it's treated as a static value.
 */
export function resolveTemplate(template: string, vars: TemplateVars): unknown {
  // Static value (no template expression)
  if (!template.includes('{{')) {
    return template;
  }

  // Full replacement: template is exactly one expression → preserve type
  const fullMatch = template.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (fullMatch) {
    return resolveExpression(fullMatch[1], vars);
  }

  // Inline interpolation: multiple expressions or mixed with text → always string
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
    const result = resolveExpression(expr, vars);
    return String(result ?? '');
  });
}

function resolveExpression(expr: string, vars: TemplateVars): unknown {
  const parts = expr.split('|').map((p) => p.trim());
  const varPath = parts[0];
  let value = resolveVarPath(varPath, vars);

  // Apply filters
  for (let i = 1; i < parts.length; i++) {
    const filterExpr = parts[i];
    const filterMatch = filterExpr.match(/^(\w+)(?:\((.+?)\))?$/);
    if (!filterMatch) continue;

    const [, filterName, filterArg] = filterMatch;
    const filter = FILTER_MAP[filterName];
    if (filter) {
      value = filter(String(value ?? ''), filterArg);
    }
  }

  return value;
}

function resolveVarPath(path: string, vars: TemplateVars): unknown {
  const keys = path.split('.');
  let current: unknown = vars;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export function stripMarkdown(text: string): string {
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove headings markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.+?)_{1,3}/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove blockquotes
    .replace(/^\s*>\s?/gm, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Collapse whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Apply all field templates to produce a final document. */
export function buildDocument(
  fields: Record<string, string>,
  vars: TemplateVars,
): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  for (const [key, template] of Object.entries(fields)) {
    doc[key] = resolveTemplate(template, vars);
  }
  return doc;
}
