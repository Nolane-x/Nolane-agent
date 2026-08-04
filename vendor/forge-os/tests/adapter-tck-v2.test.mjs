import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadAdapterTckManifest, runAdapterTck } from '../scripts/run-adapter-tck.mjs';

const executableIds = new Set(['codex','claude-code','cursor','opencode','cline','roo-code','windsurf','continue','generic']);

test('executable adapter configs launch the stdio MCP transport rather than an HTTP server command', async () => {
  const manifest = await loadAdapterTckManifest();
  for (const adapter of manifest.adapters.filter((item) => executableIds.has(item.id))) {
    assert.equal(adapter.verification, 'executable');
    assert.ok(adapter.config, `${adapter.id} must declare a config`);
    const config = JSON.parse(await readFile(adapter.config, 'utf8'));
    const serialized = JSON.stringify(config);
    assert.match(serialized, /src\/server\/stdio\.mjs/);
    assert.doesNotMatch(serialized, /src\/server\/http-server\.mjs/);
  }
});

test('adapter TCK executes every declared executable adapter and records protocol evidence', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'forgeos-adapter-tck-'));
  try {
    const report = await runAdapterTck({ outputFile:path.join(outputDir,'adapter-tck.json'), timeoutMs:8_000 });
    const tested = report.adapters.filter((item) => item.verification === 'executable');
    assert.equal(tested.length, executableIds.size);
    assert.ok(tested.every((item) => item.status === 'pass'));
    assert.ok(tested.every((item) => item.checks.initialize && item.checks.readyNotification && item.checks.toolsList));
    assert.ok(tested.every((item) => item.protocolVersion === '2025-11-25'));
    assert.ok(tested.every((item) => item.toolCount > 0));
    const documented = report.adapters.filter((item) => item.verification === 'documentation');
    assert.ok(documented.length > 0);
    assert.ok(documented.every((item) => item.status === 'documented'));
    assert.equal(report.summary.failed, 0);
    assert.equal(report.summary.executed, executableIds.size);
  } finally {
    await rm(outputDir,{recursive:true,force:true});
  }
});
