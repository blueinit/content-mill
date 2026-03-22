#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './core/config.js';
import { indexAll } from './core/indexer.js';

const program = new Command();

program
  .name('content-mill')
  .description('Index static content sources into Meilisearch')
  .version('0.1.0');

program
  .command('index')
  .description('Extract content from sources and push to Meilisearch')
  .requiredOption('-c, --config <path>', 'Path to content-mill config file')
  .option('-s, --source <name>', 'Index only a specific source by name')
  .option('--dry-run', 'Extract and print documents without pushing to Meilisearch')
  .action(async (opts) => {
    try {
      const config = loadConfig(opts.config);
      const results = await indexAll(config, {
        dryRun: opts.dryRun,
        sourceName: opts.source,
      });

      console.log('\nDone:');
      for (const r of results) {
        console.log(`  ${r.source} → ${r.index}: ${r.documentsIndexed} documents`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
