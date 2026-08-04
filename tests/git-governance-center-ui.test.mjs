import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');

async function optional(path) {
  try { return await readFile(new URL(path, import.meta.url), 'utf8'); }
  catch { return ''; }
}

const source = await optional('../ui/git-governance-center.js');
const css = await optional('../ui/git-governance-center.css');

test('Git Governance Center is a lazy-loaded application surface', () => {
  assert.match(index, /id="git-governance-button"/);
  assert.match(index, /id="git-governance-center"/);
  assert.match(app, /gitGovernance:\s*\['\/git-governance-center\.js','initGitGovernanceCenter','git-governance-center','git-governance-button'/);
  assert.match(app, /gitGovernance:'Git Governance Center'/);
});

test('Git Governance Center presents completion and collision evidence without raw Git controls', () => {
  assert.match(source, /\/api\/git-governance\/missions\//);
  assert.match(source, /\/api\/git-governance\/tasks\//);
  assert.match(source, /\/api\/git-governance\/collisions/);
  for (const label of ['Remotes', 'Commits & checkpoints', 'Test evidence', 'Residual risks', 'Changed files', 'File overlaps', 'Merge-tree conflicts', 'Diff review readiness']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /receiptSha256/);
  assert.match(source, /reviewCoverage/);
  assert.match(source, /conflictPaths/);
  assert.doesNotMatch(source, /workspaceRoot|projectRoot|raw git|git reset|git checkout|argv|shell/i);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token|secret.*value/i);
});

test('Git Governance Center has bounded responsive styling and reduced-motion support', () => {
  assert.match(css, /\.git-governance-layout/);
  assert.match(css, /\.git-governance-card/);
  assert.match(css, /\.git-governance-conflict/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /prefers-reduced-motion/);
});
