#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ModelCatalogSyncService } from '../src/model-profiles/model-catalog-sync.mjs';

function parseArgs(argv) {
  const args = { sources: ['models.dev', 'openrouter'], output: 'config/model-profiles/nolane-live-catalog.snapshot.json', sourceUrls: {} };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sources') args.sources = String(argv[++i]).split(',').map((x) => x.trim()).filter(Boolean);
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--portkey-url') args.sourceUrls.portkey = argv[++i];
    else if (argv[i] === '--litellm-url') args.sourceUrls.litellm = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const service = new ModelCatalogSyncService();
const result = await service.sync({ sources: args.sources, sourceUrls: args.sourceUrls });
const output = path.resolve(args.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ output, records: result.records.length, sources: result.sources, failures: result.failures, receiptSha256: result.receiptSha256 }, null, 2)}\n`);
