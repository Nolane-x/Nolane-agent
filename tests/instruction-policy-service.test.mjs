import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';

import { InstructionDiscovery } from '../src/repository/instruction-discovery.mjs';
import { InstructionPolicyService } from '../src/repository/instruction-policy-service.mjs';
import { TrustAwareInstructionPolicy } from '../src/security/workspace-trust-gates.mjs';

async function put(root, relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-policy-'));
  const globalRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-global-policy-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(globalRoot, { recursive: true, force: true })]));
  await put(globalRoot, 'AGENTS.md', `---\nscope: global\npriority: 0\nrules:\n  verification.required: true\n  formatting.tool: biome\n---\nGlobal operator guidance.\n`);
  await put(root, 'AGENTS.md', `---\nscope: repository\npriority: 10\nimports: [docs/common.md]\nrules:\n  formatting.tool: prettier\n  tests.command: npm test\n---\nRepository guidance.\n`);
  await put(root, 'docs/common.md', `---\nrules:\n  documentation.required: true\n---\nImported documentation guidance.\n`);
  await put(root, 'src/AGENTS.md', `---\nscope: directory\npriority: 20\nrules:\n  tests.command: node --test\n---\nSource directory guidance.\n`);
  await put(root, '.cursor/rules/typescript.mdc', `---\nscope: language\nlanguages: [typescript]\npriority: 30\nrules:\n  compiler.strict: true\n---\nUse strict TypeScript.\n`);
  await put(root, '.cursor/rules/refactor-a.mdc', `---\nscope: task\ntasks: [refactor]\npriority: 40\nrules:\n  edits.atomic: true\n---\nRefactor A.\n`);
  await put(root, '.cursor/rules/refactor-b.mdc', `---\nscope: task\ntasks: [refactor]\npriority: 40\nrules:\n  edits.atomic: false\n---\nRefactor B.\n`);
  await put(root, '.cursor/rules/invalid.mdc', `---\nscope: universe\npriority: 5000\nlanguages: 123\nrules:\n  okay: [not-supported]\n---\nInvalid typed metadata remains visible.\n`);
  await put(root, '.cursor/rules/cycle-a.mdc', `---\nimports: [cycle-b.md]\n---\nA\n`);
  await put(root, '.cursor/rules/cycle-b.md', `---\nimports: [cycle-a.mdc]\n---\nB\n`);
  await put(root, '.cursor/rules/traversal.mdc', `---\nimports: [../../../outside.md]\n---\nTraversal\n`);
  await put(root, 'outside-target.md', 'outside');
  await symlink(path.join(root, 'outside-target.md'), path.join(root, '.cursor/rules/link.md'));
  const project = { id: 'p1', workspaceRoot: root };
  const store = { getProject: (id) => id === 'p1' ? project : null };
  const discovery = new InstructionDiscovery({ maxFileBytes: 64_000, maxRecords: 128 });
  const service = new InstructionPolicyService({ discovery, store, globalRoots: [globalRoot], version: '1.8.0' });
  return { root, globalRoot, project, discovery, service };
}

test('instruction discovery produces typed records, nested folder rules, and visible invalid metadata', async (t) => {
  const f = await fixture(t);
  const records = await f.discovery.discover(f.root);
  assert.ok(records.some((item) => item.sourcePath === 'src/AGENTS.md' && item.scope === 'directory'));
  const repo = records.find((item) => item.sourcePath === 'AGENTS.md');
  assert.equal(repo.scope, 'repository');
  assert.equal(repo.priority, 10);
  assert.deepEqual(repo.imports, ['docs/common.md']);
  assert.deepEqual(repo.rules, { 'formatting.tool': 'prettier', 'tests.command': 'npm test' });
  const invalid = records.find((item) => item.sourcePath.endsWith('invalid.mdc'));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some((issue) => issue.code === 'INSTRUCTION_SCOPE_INVALID'));
  assert.ok(invalid.issues.some((issue) => issue.code === 'INSTRUCTION_PRIORITY_INVALID'));
  assert.ok(records.every((item) => !path.isAbsolute(item.sourcePath)));
});

test('instruction policy resolves inheritance, precedence, imports, conflicts, and deterministic evidence', async (t) => {
  const f = await fixture(t);
  const result = await f.service.resolve({ projectId: 'p1', principalId: 'owner', paths: ['src/app.ts'], language: 'typescript', taskType: 'refactor' });
  assert.equal(result.schema, 'forge.instruction-policy.v1');
  assert.equal(result.version, '1.8.0');
  const scopes = result.selected.map((item) => item.scope);
  assert.equal(scopes[0], 'global');
  assert.ok(scopes.filter((item) => item === 'repository').length >= 2);
  assert.deepEqual(scopes.slice(-4), ['directory', 'language', 'task', 'task']);
  assert.equal(result.effectiveRules['verification.required'].value, true);
  assert.equal(result.effectiveRules['formatting.tool'].value, 'prettier');
  assert.equal(result.effectiveRules['tests.command'].value, 'node --test');
  assert.equal(result.effectiveRules['compiler.strict'].value, true);
  assert.equal(result.effectiveRules['documentation.required'].value, true);
  assert.equal(result.effectiveRules['edits.atomic'], undefined);
  const conflict = result.conflicts.find((item) => item.rule === 'edits.atomic');
  assert.equal(conflict.resolved, false);
  assert.equal(conflict.sources.length, 2);
  assert.ok(result.invalidRecords.some((item) => item.sourcePath.endsWith('invalid.mdc')));
  assert.ok(result.omissions.some((item) => item.reason === 'import-cycle'));
  assert.ok(result.omissions.some((item) => item.reason === 'import-path-outside-root'));
  assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const again = await f.service.resolve({ projectId: 'p1', principalId: 'owner', paths: ['src/app.ts'], language: 'typescript', taskType: 'refactor' });
  assert.equal(again.receiptSha256, result.receiptSha256);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(f.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('higher precedence unambiguous rule resolves a lower-level conflict', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-resolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'AGENTS.md', `---\nscope: repository\npriority: 0\nrules:\n  test.mode: unit\n---\nA\n`);
  await put(root, '.cursor/rules/other.mdc', `---\nscope: repository\npriority: 0\nrules:\n  test.mode: integration\n---\nB\n`);
  await put(root, '.cursor/rules/task.mdc', `---\nscope: task\ntasks: [release]\nrules:\n  test.mode: full\n---\nC\n`);
  const service = new InstructionPolicyService({ discovery: new InstructionDiscovery(), store: { getProject: () => ({ id: 'p', workspaceRoot: root }) }, version: '1.8.0' });
  const result = await service.resolve({ projectId: 'p', principalId: 'owner', taskType: 'release' });
  assert.equal(result.effectiveRules['test.mode'].value, 'full');
  assert.equal(result.conflicts.find((item) => item.rule === 'test.mode').resolved, true);
});


test('trust-aware instruction policy blocks project reads until the workspace is trusted', async () => {
  let calls = 0;
  const base = { version: '1.8.0', resolve: async (input) => { calls += 1; return { projectId: input.projectId }; }, clear() {} };
  let state = 'untrusted';
  const policy = new TrustAwareInstructionPolicy({ base, trust: { status: async () => ({ state, reason: state === 'trusted' ? 'trusted' : 'not-approved' }) } });
  const blocked = await policy.resolve({ projectId: 'p1', principalId: 'owner' });
  assert.equal(blocked.selected.length, 0);
  assert.equal(blocked.omissions[0].reason, 'workspace-untrusted');
  assert.equal(calls, 0);
  state = 'trusted';
  assert.deepEqual(await policy.resolve({ projectId: 'p1', principalId: 'owner' }), { projectId: 'p1' });
  assert.equal(calls, 1);
});
