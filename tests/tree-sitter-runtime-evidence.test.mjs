import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TreeSitterRuntimeService } from '../src/repository/tree-sitter-runtime-service.mjs';

const enabled = process.env.NOLANE_RUNTIME_TREE_SITTER_GATE === '1';

if (!enabled) {
  test('real Tree-sitter grammar proof is opt-in for provisioned CI runners', { skip: 'set NOLANE_RUNTIME_TREE_SITTER_GATE=1 on a runner with the pinned grammar checkout' }, () => {});
} else {
  test('real Tree-sitter parses JavaScript through the project-bound production runtime', async (t) => {
    const grammarRoot = path.resolve(String(process.env.NOLANE_TREE_SITTER_JAVASCRIPT_DIR ?? ''));
    assert.notEqual(grammarRoot, path.resolve('.'));
    const fixtureDirectory = await mkdtemp(path.join(grammarRoot, '.nolane-tree-sitter-'));
    t.after(() => rm(fixtureDirectory, { recursive: true, force: true }));
    const relativeFile = `${path.basename(fixtureDirectory)}/sample.js`;
    await writeFile(path.join(fixtureDirectory, 'sample.js'), 'export const add = (left, right) => left + right;\n', 'utf8');

    const service = new TreeSitterRuntimeService({
      projectResolver: (projectId) => projectId === 'tree-sitter-javascript' ? { id: projectId, workspaceRoot: grammarRoot } : null,
      expectedVersion: '0.25.10',
    });
    const capabilities = await service.capabilities();
    assert.equal(capabilities.available, true, `Tree-sitter capability probe failed: ${JSON.stringify(capabilities)}`);
    assert.equal(capabilities.version, '0.25.10');

    const parsed = await service.parse({ projectId: 'tree-sitter-javascript', principalId: 'github-actions', file: relativeFile });
    assert.equal(parsed.file, relativeFile);
    assert.equal(parsed.runtime.version, '0.25.10');
    assert.equal(parsed.tree.parse_summaries?.length, 1, `Expected one parse summary, received: ${JSON.stringify(parsed.tree)}`);
    assert.equal(parsed.tree.parse_summaries[0].successful, true, `Tree-sitter parse did not succeed: ${JSON.stringify(parsed.tree)}`);
    assert.match(parsed.receiptSha256, /^[a-f0-9]{64}$/);
  });
}
