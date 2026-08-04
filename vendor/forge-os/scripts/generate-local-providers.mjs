import { mkdir, writeFile } from 'node:fs/promises';
import { buildBuiltInProviders } from '../src/federation/local-provider-seed.mjs';
const providers = await buildBuiltInProviders();
await mkdir(new URL('../providers/', import.meta.url), { recursive: true });
await writeFile(new URL('../providers/built-in-providers.json', import.meta.url), `${JSON.stringify(providers, null, 2)}\n`);
console.log(`Generated ${providers.length} built-in provider mappings.`);
