#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ModelDiscoveryService } from '../src/model-profiles/model-discovery-service.mjs';

function parseArgs(argv) {
  const result = { providerFamily: null, baseUrl: null, output: 'config/model-profiles/nolane-provider-discovery.snapshot.json', apiKeyEnv: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--provider') result.providerFamily = argv[++i];
    else if (flag === '--base-url') result.baseUrl = argv[++i];
    else if (flag === '--output') result.output = argv[++i];
    else if (flag === '--api-key-env') result.apiKeyEnv = argv[++i];
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!result.providerFamily || !result.baseUrl) throw new Error('--provider and --base-url are required');
  return result;
}

const args = parseArgs(process.argv.slice(2));
const apiKey = args.apiKeyEnv ? process.env[args.apiKeyEnv] : null;
const discovery = await new ModelDiscoveryService().discover({
  providerFamily: args.providerFamily,
  baseUrl: args.baseUrl,
  apiKey,
});
const output = path.resolve(args.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(discovery, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ output, models: discovery.models.length, receiptSha256: discovery.receiptSha256 }, null, 2)}\n`);
