#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ModelProfileRegistry } from '../src/model-profiles/model-profile-registry.mjs';
import { createBuiltInModelProfiles } from '../src/model-profiles/model-profile-seeds.mjs';
import { deepFreeze, sha256Receipt } from '../src/model-profiles/model-profile-schema.mjs';

export function buildBundledModelProfileCatalog({ clock = () => new Date().toISOString() } = {}) {
  const registry = new ModelProfileRegistry({ profiles: createBuiltInModelProfiles(), clock });
  const base = registry.exportCatalog();
  const profiles = base.profiles;
  const payload = {
    schemaVersion: base.schemaVersion,
    generatedAt: base.generatedAt,
    catalogKind: 'nolane-model-profile-registry',
    completenessModel: 'curated-exact-plus-live-import-plus-family-inference',
    profiles,
    families: base.families,
    catalogSources: [
      { id: 'bundled-curated', mode: 'bundled', authoritativeFor: ['identity-overrides', 'lifecycle-overrides'] },
      { id: 'provider-model-list', mode: 'live-discovery', authoritativeFor: ['availability', 'provider-model-id'] },
      { id: 'models.dev', mode: 'live-import', authoritativeFor: ['provider-deployments', 'limits', 'pricing'] },
      { id: 'openrouter', mode: 'live-import', authoritativeFor: ['openrouter-deployments', 'supported-parameters', 'pricing'] },
      { id: 'litellm', mode: 'live-import', authoritativeFor: ['cross-provider-capabilities', 'pricing'] },
      { id: 'portkey', mode: 'live-import', authoritativeFor: ['cross-provider-deployments', 'pricing'] },
      { id: 'ollama', mode: 'local-discovery', authoritativeFor: ['installed-models', 'quantization', 'artifact-size'] },
      { id: 'lm-studio', mode: 'local-discovery', authoritativeFor: ['installed-models', 'runtime', 'quantization'] },
    ],
    coverage: {
      exactProfiles: profiles.length,
      publishers: new Set(profiles.map((profile) => profile.identity.publisher).filter(Boolean)).size,
      identityFamilies: new Set(profiles.map((profile) => profile.identity.family).filter(Boolean)).size,
      familyAndSizeTemplates: base.families.length,
      localProfiles: profiles.filter((profile) => profile.deployment.local === true).length,
      remoteProfiles: profiles.filter((profile) => profile.deployment.remote === true).length,
      codingProfiles: profiles.filter((profile) => profile.capabilities.coding === true).length,
      reasoningProfiles: profiles.filter((profile) => profile.capabilities.reasoning === true).length,
      parameterScales: [...new Set(profiles.map((profile) => profile.architecture.parameterScale).filter(Boolean))].sort((a, b) => {
        const parse = (value) => {
          const number = Number.parseFloat(value);
          return value.toUpperCase().includes('T') ? number * 1000 : number;
        };
        return parse(a) - parse(b) || a.localeCompare(b);
      }),
      deploymentFormats: ['api', 'gguf', 'safetensors', 'awq', 'gptq', 'exl2', 'exl3', 'mlx', 'ollama', 'lm-studio', 'vllm'],
      quantizationClasses: ['fp32', 'fp16', 'bf16', 'fp8', 'int8', 'q8', 'q6', 'q5', 'q4', 'int4', 'nf4', 'q3', 'q2'],
    },
  };
  return deepFreeze({ ...payload, receiptSha256: sha256Receipt(payload) });
}

export async function writeModelProfileCatalog(outputPath, options = {}) {
  const catalog = buildBundledModelProfileCatalog(options);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return deepFreeze({
    outputPath,
    receiptSha256: catalog.receiptSha256,
    profileCount: catalog.profiles.length,
    familyCount: catalog.families.length,
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const output = path.resolve(process.argv[2] ?? 'config/model-profiles/nolane-model-profiles.v1.json');
  writeModelProfileCatalog(output).then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}
