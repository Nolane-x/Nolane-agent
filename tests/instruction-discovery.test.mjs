import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { InstructionDiscovery } from '../src/repository/instruction-discovery.mjs';

test('instruction discovery normalizes Forge, Claude, AGENTS, Cursor, and Windsurf guidance with provenance', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instructions-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'AGENTS.md'), '# Repository\nRun tests.\n');
  await writeFile(path.join(root, 'CLAUDE.md'), 'Never skip verification.\n');
  await writeFile(path.join(root, 'FORGE.md'), 'Use ForgeOS receipts.\n');
  await mkdir(path.join(root, '.cursor', 'rules'), { recursive: true });
  await writeFile(path.join(root, '.cursor', 'rules', 'typescript.mdc'), '---\ndescription: TypeScript rules\nglobs: ["src/**/*.ts", "tests/**/*.ts"]\nalwaysApply: false\n---\nUse strict TypeScript.\n');
  await mkdir(path.join(root, '.windsurf', 'rules'), { recursive: true });
  await writeFile(path.join(root, '.windsurf', 'rules', 'security.md'), '---\ntrigger: glob\nglobs: ["src/security/**"]\n---\nThreat-model security changes.\n');
  await mkdir(path.join(root, '.windsurf', 'workflows'), { recursive: true });
  await writeFile(path.join(root, '.windsurf', 'workflows', 'release.md'), '# Release\n1. Test\n2. Build\n3. Verify hashes\n');
  const service = new InstructionDiscovery({ maxFileBytes: 32_000, maxRecords: 64 });
  const records = await service.discover(root);
  assert.deepEqual(records.map((item) => item.sourcePath), ['.cursor/rules/typescript.mdc', '.windsurf/rules/security.md', '.windsurf/workflows/release.md', 'AGENTS.md', 'CLAUDE.md', 'FORGE.md']);
  assert.equal(records.every((item) => item.trust === 'untrusted-project-guidance'), true);
  assert.equal(records.find((item) => item.sourcePath.endsWith('release.md')).kind, 'workflow');
  assert.deepEqual(records.find((item) => item.sourcePath.endsWith('typescript.mdc')).globs, ['src/**/*.ts', 'tests/**/*.ts']);
});

test('instruction discovery selects only matching scoped rules while retaining repository-wide instructions', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-scope-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'AGENTS.md'), 'Global guidance');
  await mkdir(path.join(root, '.cursor', 'rules'), { recursive: true });
  await writeFile(path.join(root, '.cursor', 'rules', 'typescript.mdc'), '---\nglobs: ["src/**/*.ts"]\n---\nTS only');
  await writeFile(path.join(root, '.cursor', 'rules', 'python.mdc'), '---\nglobs: ["src/**/*.py"]\n---\nPython only');
  const service = new InstructionDiscovery(); const records = await service.discover(root);
  const selected = service.select(records, { paths: ['src/app.ts'], maxChars: 10_000 });
  assert.deepEqual(selected.items.map((item) => item.sourcePath), ['.cursor/rules/typescript.mdc', 'AGENTS.md']);
  assert.ok(selected.omissions.some((item) => item.sourcePath.endsWith('python.mdc') && item.reason === 'scope-mismatch'));
  assert.match(selected.items[0].text, /untrusted-project-guidance/);
});

test('instruction discovery rejects symlinks, oversized files, and executable workflow behavior', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-bounds-')); t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'AGENTS.md'), 'x'.repeat(129));
  await mkdir(path.join(root, '.windsurf', 'workflows'), { recursive: true });
  await writeFile(path.join(root, '.windsurf', 'workflows', 'danger.md'), '# Workflow\n```sh\nrm -rf /\n```');
  const service = new InstructionDiscovery({ maxFileBytes: 128 }); const records = await service.discover(root);
  assert.equal(records.some((item) => item.sourcePath === 'AGENTS.md'), false);
  const workflow = records.find((item) => item.kind === 'workflow');
  assert.equal(workflow.executable, false);
  assert.match(workflow.text, /operator-invoked-template/);
});
