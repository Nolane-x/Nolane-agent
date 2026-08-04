#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { createBuiltInModelProfiles, ModelProfileRegistry } from '../src/model-profiles/index.mjs';
import { ModelManagementService, dossierToMarkdown } from '../src/model-management/index.mjs';

function parse(argv) {
  const [command = 'snapshot', ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    options[key] = rest[index + 1] && !rest[index + 1].startsWith('--') ? rest[++index] : true;
  }
  return { command, options };
}

const { command, options } = parse(process.argv.slice(2));
const registry = new ModelProfileRegistry({ profiles: createBuiltInModelProfiles() });
const manager = new ModelManagementService({ registry });
let output;
if (command === 'snapshot') output = manager.snapshot();
else if (command === 'recommend') output = manager.recommend({
  candidateIds: options.models ? String(options.models).split(',').filter(Boolean) : null,
  request: {
    taskClass: options.task ?? 'medium',
    taskKind: options.kind ?? 'coding',
    requiredCapabilities: String(options.require ?? 'coding').split(',').filter(Boolean),
    localOnly: options.local === true,
    maxRamGB: options['max-ram'] ? Number(options['max-ram']) : undefined,
    maxCostUsd: options['max-cost'] ? Number(options['max-cost']) : undefined,
    minContextWindow: options.context ? Number(options.context) : undefined,
  },
});
else if (command === 'portfolio') output = manager.createPortfolio({ candidateIds: options.models ? String(options.models).split(',').filter(Boolean) : null });
else if (command === 'dossier') {
  if (!options.model) throw new TypeError('Use --model <canonical-id>');
  output = manager.dossier(options.model);
  if (options.format === 'markdown') output = dossierToMarkdown(output);
} else throw new TypeError(`Unknown command: ${command}`);
const serialized = typeof output === 'string' ? output : `${JSON.stringify(output, null, 2)}\n`;
if (options.output) await writeFile(options.output, serialized, 'utf8');
else process.stdout.write(serialized);
