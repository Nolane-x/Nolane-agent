import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  classifyNolaneNativePath,
  generateNolaneNativeCoreInventory,
  validateNolaneNativeCoreInventory,
  NOLANE_NATIVE_CORE_DOMAINS,
} from '../src/native-core/nolane-native-domain-classifier.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-nolane_native-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'agent'), { recursive: true });
  await mkdir(path.join(root, 'gateway', 'platforms'), { recursive: true });
  await mkdir(path.join(root, 'plugins', 'memory'), { recursive: true });
  await mkdir(path.join(root, 'tests', 'agent'), { recursive: true });
  await mkdir(path.join(root, 'website', 'i18n'), { recursive: true });
  await writeFile(path.join(root, 'agent', 'loop.py'), 'def run_turn():\n    return "ok"\n');
  await writeFile(path.join(root, 'gateway', 'platforms', 'discord.py'), 'class DiscordAdapter: pass\n');
  await writeFile(path.join(root, 'plugins', 'memory', 'plugin.yaml'), 'name: memory\n');
  await writeFile(path.join(root, 'tests', 'agent', 'test_loop.py'), 'def test_loop(): pass\n');
  await writeFile(path.join(root, 'website', 'i18n', 'vi.json'), '{"title":"NolaneNative"}\n');
  await writeFile(path.join(root, 'LICENSE'), 'MIT\n');
  return root;
}

test('classifyNolaneNativePath assigns core source and tests to stable behavioral domains', () => {
  assert.deepEqual(classifyNolaneNativePath('agent/loop.py'), {
    domain: 'agent-kernel',
    kind: 'source',
    core: true,
    reason: 'agent-runtime-source',
  });
  assert.deepEqual(classifyNolaneNativePath('gateway/platforms/discord.py'), {
    domain: 'gateway-integrations',
    kind: 'source',
    core: true,
    reason: 'gateway-source',
  });
  assert.deepEqual(classifyNolaneNativePath('tests/agent/test_loop.py'), {
    domain: 'agent-kernel',
    kind: 'test',
    core: true,
    reason: 'behavioral-test',
  });
});

test('classifyNolaneNativePath excludes translations and marketing while retaining license evidence', () => {
  assert.equal(classifyNolaneNativePath('website/i18n/vi.json').core, false);
  assert.equal(classifyNolaneNativePath('website/i18n/vi.json').reason, 'localized-marketing-or-doc');
  assert.equal(classifyNolaneNativePath('website/src/pages/skills/index.tsx').core, false);
  assert.equal(classifyNolaneNativePath('website/scripts/generate-skill-docs.py').reason, 'documentation-or-marketing');
  assert.equal(classifyNolaneNativePath('.hadolint.yaml').reason, 'development-build-infrastructure');
  assert.equal(classifyNolaneNativePath('eslint.config.shared.mjs').reason, 'development-build-infrastructure');
  assert.deepEqual(classifyNolaneNativePath('LICENSE'), {
    domain: 'provenance',
    kind: 'license',
    core: false,
    reason: 'retain-license-attribution',
  });
});



test('classifyNolaneNativePath excludes payload and build implementation that is not NolaneNative core behavior', () => {
  for (const candidate of [
    '.github/workflows/tests.yml',
    'package-lock.json',
    'web/tsconfig.json',
    'apps/desktop/vite.config.ts',
    'ui-tui/packages/nolane_native-ink/src/ink/reconciler.ts',
  ]) {
    const result = classifyNolaneNativePath(candidate);
    assert.equal(result.core, false, candidate);
    assert.equal(result.reason, 'development-build-infrastructure', candidate);
  }
  assert.equal(classifyNolaneNativePath('skills/productivity/pdf/scripts/fill.py').reason, 'bundled-skill-payload');
  assert.equal(classifyNolaneNativePath('web/src/i18n/tr.ts').reason, 'localized-product-copy');
  assert.equal(classifyNolaneNativePath('scripts/release/publish.py').reason, 'development-build-infrastructure');
  assert.equal(classifyNolaneNativePath('scripts/whatsapp-bridge/allowlist.js').domain, 'gateway-integrations');
  assert.equal(classifyNolaneNativePath('apps/desktop/src/main.ts').core, true);
});

test('classifyNolaneNativePath distinguishes runtime agent capabilities from product and development payload', () => {
  assert.equal(classifyNolaneNativePath('agent/lsp/client.py').domain, 'repository-files');
  assert.equal(classifyNolaneNativePath('agent/moa_loop.py').domain, 'multi-agent');
  assert.equal(classifyNolaneNativePath('agent/copilot_acp_client.py').domain, 'acp-api');
  assert.equal(classifyNolaneNativePath('agent/web_search_registry.py').domain, 'browser-computer-use');
  assert.equal(classifyNolaneNativePath('agent/secret_sources/onepassword.py').domain, 'security');
  assert.equal(classifyNolaneNativePath('agent/pet/render.py').domain, 'product-surfaces');
  for (const candidate of [
    'ui-tui/scripts/build.ts',
    'plugins/kanban/dashboard/dist/index.js',
    'native/fts5_cjk/vendor/sqlite3ext.h',
    'native/fts5_cjk/build.sh',
    'nix/packages.nix',
    'docker/entrypoint.sh',
    'pyproject.toml',
    'package.json',
    '.env.example',
  ]) {
    assert.equal(classifyNolaneNativePath(candidate).core, false, candidate);
  }
});

test('classifyNolaneNativePath routes agent submodules to their actual behavioral domains', () => {
  for (const candidate of [
    'agent/anthropic_adapter.py',
    'agent/codex_runtime.py',
    'agent/credential_pool.py',
    'agent/rate_limit_tracker.py',
  ]) assert.equal(classifyNolaneNativePath(candidate).domain, 'provider-fabric', candidate);
  for (const candidate of [
    'agent/image_routing.py',
    'agent/transcription_registry.py',
    'agent/tts_registry.py',
    'agent/video_gen_registry.py',
  ]) assert.equal(classifyNolaneNativePath(candidate).domain, 'media-voice', candidate);
  for (const candidate of [
    'agent/account_usage.py',
    'agent/billing_usage.py',
    'agent/credits_tracker.py',
    'agent/trace_upload.py',
  ]) assert.equal(classifyNolaneNativePath(candidate).domain, 'observability-operations', candidate);
  for (const candidate of [
    'agent/tool_executor.py',
    'agent/tool_dispatch_helpers.py',
    'agent/tool_result_classification.py',
  ]) assert.equal(classifyNolaneNativePath(candidate).domain, 'tool-execution', candidate);
  assert.equal(classifyNolaneNativePath('agent/file_safety.py').domain, 'repository-files');
  assert.equal(classifyNolaneNativePath('agent/credential_persistence.py').domain, 'security');
});

test('generateNolaneNativeCoreInventory is deterministic and leaves no source module unmapped', async (t) => {
  const upstreamRoot = await fixture(t);
  const firstPath = path.join(upstreamRoot, 'inventory-1.json');
  const secondPath = path.join(upstreamRoot, 'inventory-2.json');
  const first = await generateNolaneNativeCoreInventory({
    upstreamRoot,
    outputPath: firstPath,
    sourceLabel: 'synthetic-nolane_native',
  });
  const second = await generateNolaneNativeCoreInventory({
    upstreamRoot,
    outputPath: secondPath,
    sourceLabel: 'synthetic-nolane_native',
    excludeRelativePaths: ['inventory-1.json'],
  });
  assert.equal(first.unmappedCorePaths.length, 0);
  assert.equal(first.summary.coreEntries, 4);
  assert.equal(first.summary.excludedEntries, 2);
  assert.equal(first.sourceSnapshot.fileCount, 6);
  assert.match(first.sourceSnapshot.treeSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.receiptSha256, second.receiptSha256);
  assert.deepEqual(first.domains, second.domains);
  assert.equal(validateNolaneNativeCoreInventory(first).status, 'pass');
  assert.equal(await readFile(firstPath, 'utf8'), await readFile(secondPath, 'utf8'));
});

test('inventory validation rejects an unknown executable source path instead of guessing parity', () => {
  assert.throws(
    () => validateNolaneNativeCoreInventory({
      schemaVersion: 'nolane.nolane_native.core.inventory.v1',
      sourceSnapshot: { label: 'x', treeSha256: 'a'.repeat(64), fileCount: 1, bytes: 1 },
      entries: [{ path: 'unknown/runtime.py', core: true, domain: null, kind: 'source', reason: 'unmapped' }],
      domains: [],
      contracts: [],
      unmappedCorePaths: ['unknown/runtime.py'],
      excludedPaths: [],
      summary: { entries: 1, coreEntries: 1, excludedEntries: 0, unmappedCorePaths: 1 },
      receiptSha256: 'b'.repeat(64),
    }),
    /unmapped core paths/i,
  );
});


test('classification rules document every runtime domain used by the generator', async () => {
  const rules = JSON.parse(await readFile('requirements/nolane-native-core-classification-rules.json', 'utf8'));
  assert.equal(rules.schema, 'nolane.nolane_native.core.classification-rules.v1');
  assert.deepEqual(rules.domains.map((entry) => entry.id), NOLANE_NATIVE_CORE_DOMAINS);
  assert.equal(rules.claimPolicy.fileExistenceIsProof, false);
});
