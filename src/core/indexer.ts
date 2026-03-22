import { MeiliSearch } from 'meilisearch';
import type { ContentMillConfig, SourceConfig, DocumentConfig } from './types.js';
import { buildDocument } from './template.js';
import { getAdapter } from '../adapters/index.js';

interface IndexResult {
  source: string;
  index: string;
  documentsIndexed: number;
}

interface ExtractedSource {
  source: SourceConfig;
  documents: Record<string, unknown>[];
}

/** Extract documents from a source without pushing to Meilisearch. */
export async function extractSource(source: SourceConfig): Promise<ExtractedSource> {
  const adapter = getAdapter(source.type);
  const items = await adapter.extract(source);
  const documents = items.map((item) =>
    buildDocument(source.document.fields, item.vars),
  );
  console.log(`[${source.name}] Extracted ${documents.length} documents`);
  return { source, documents };
}

/** Merge index settings from multiple sources targeting the same index. */
function mergeIndexSettings(configs: DocumentConfig[]): Record<string, unknown> {
  const merged: Record<string, Set<string>> = {
    searchableAttributes: new Set(),
    filterableAttributes: new Set(),
    sortableAttributes: new Set(),
    displayedAttributes: new Set(),
  };

  for (const config of configs) {
    for (const key of Object.keys(merged)) {
      const values = config[key as keyof DocumentConfig];
      if (Array.isArray(values)) {
        for (const v of values) merged[key].add(v as string);
      }
    }
  }

  const settings: Record<string, unknown> = {};
  for (const [key, values] of Object.entries(merged)) {
    if (values.size > 0) settings[key] = [...values];
  }
  return settings;
}

/** Push a batch of documents to a Meilisearch index with atomic swap. */
async function pushToIndex(
  client: MeiliSearch,
  indexName: string,
  primaryKey: string,
  documents: Record<string, unknown>[],
  settings: Record<string, unknown>,
  sourceNames: string[],
): Promise<void> {
  const tempIndex = `${indexName}_tmp`;

  // Clean up temp index from a previous failed run
  try {
    await client.deleteIndex(tempIndex);
    await waitForDeletion(client, tempIndex);
  } catch {
    // Didn't exist
  }

  // Create temp index
  const createTask = await client.createIndex(tempIndex, { primaryKey });
  await client.waitForTask(createTask.taskUid);

  // Apply settings
  if (Object.keys(settings).length > 0) {
    const settingsTask = await client.index(tempIndex).updateSettings(settings);
    await client.waitForTask(settingsTask.taskUid);
  }

  // Add documents in batches
  const batchSize = 1000;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const addTask = await client.index(tempIndex).addDocuments(batch);
    await client.waitForTask(addTask.taskUid);
    console.log(`[${sourceNames.join('+')}] Indexed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
  }

  // Check if target index already exists
  let targetExists = false;
  try {
    await client.getIndex(indexName);
    targetExists = true;
  } catch {
    // Target doesn't exist yet (first run)
  }

  if (targetExists) {
    // Atomic swap: both indexes exist, swap and delete old
    const swapTask = await client.swapIndexes([
      { indexes: [indexName, tempIndex] },
    ]);
    await client.waitForTask(swapTask.taskUid);

    // Delete the old index (now named tempIndex after swap)
    try {
      const deleteTask = await client.deleteIndex(tempIndex);
      await client.waitForTask(deleteTask.taskUid);
    } catch {
      // Non-critical
    }
  } else {
    // First run: no existing index to swap with, just rename temp to target
    // Meilisearch doesn't have a rename, so swap requires both to exist.
    // Create an empty target, then swap, then delete the empty one.
    const emptyTask = await client.createIndex(indexName, { primaryKey });
    await client.waitForTask(emptyTask.taskUid);

    const swapTask = await client.swapIndexes([
      { indexes: [indexName, tempIndex] },
    ]);
    await client.waitForTask(swapTask.taskUid);

    const deleteTask = await client.deleteIndex(tempIndex);
    await client.waitForTask(deleteTask.taskUid);
  }

  console.log(`[${sourceNames.join('+')}] Successfully indexed ${documents.length} documents into "${indexName}"`);
}

export async function indexAll(
  config: ContentMillConfig,
  options: { dryRun?: boolean; sourceName?: string },
): Promise<IndexResult[]> {
  const client = new MeiliSearch({
    host: config.meili.host,
    apiKey: config.meili.apiKey,
  });

  const sources = options.sourceName
    ? config.sources.filter((s) => s.name === options.sourceName)
    : config.sources;

  if (sources.length === 0) {
    throw new Error(
      options.sourceName
        ? `Source "${options.sourceName}" not found. Available: ${config.sources.map((s) => s.name).join(', ')}`
        : 'No sources configured',
    );
  }

  // Extract all sources
  const extracted: ExtractedSource[] = [];
  for (const source of sources) {
    extracted.push(await extractSource(source));
  }

  // Group by target index
  const byIndex = new Map<string, ExtractedSource[]>();
  for (const ex of extracted) {
    const group = byIndex.get(ex.source.index) ?? [];
    group.push(ex);
    byIndex.set(ex.source.index, group);
  }

  const results: IndexResult[] = [];

  for (const [indexName, group] of byIndex) {
    // Merge all documents from sources targeting this index
    const allDocs = group.flatMap((g) => g.documents);
    const sourceNames = group.map((g) => g.source.name);

    if (options.dryRun) {
      console.log(`\n--- Index: ${indexName} (${sourceNames.join(' + ')}) ---`);
      for (const doc of allDocs.slice(0, 5)) {
        console.log(JSON.stringify(doc, null, 2));
      }
      if (allDocs.length > 5) {
        console.log(`... and ${allDocs.length - 5} more`);
      }
    } else {
      // Use primaryKey from the first source (all sources sharing an index should agree)
      const primaryKey = group[0].source.document.primaryKey;
      const settings = mergeIndexSettings(group.map((g) => g.source.document));
      await pushToIndex(client, indexName, primaryKey, allDocs, settings, sourceNames);
    }

    for (const g of group) {
      results.push({
        source: g.source.name,
        index: indexName,
        documentsIndexed: g.documents.length,
      });
    }
  }

  return results;
}

async function waitForDeletion(client: MeiliSearch, indexName: string): Promise<void> {
  // Give Meilisearch a moment to process the deletion
  for (let i = 0; i < 10; i++) {
    try {
      await client.getIndex(indexName);
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      return; // Index is gone
    }
  }
}
