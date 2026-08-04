import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

test('progressive UI contains no inline style attributes under the production CSP', () => {
  const files = walk(path.join(root, 'ui-v3')).filter((file) => /\.(?:html|mjs)$/.test(file));
  const findings = files.flatMap((file) => {
    const content = fs.readFileSync(file, 'utf8');
    return /\sstyle\s*=\s*["']/i.test(content) ? [path.relative(root, file)] : [];
  });
  assert.deepEqual(findings, []);
});

test('progressive UI declares a packaged Nolane favicon', () => {
  const html = fs.readFileSync(path.join(root, 'ui-v3', 'index.html'), 'utf8');
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\.\/nolane\.svg">/);
  assert.equal(fs.existsSync(path.join(root, 'ui-v3', 'nolane.svg')), true);
});

test('Agent Kernel surface identifies the current Checkpoint 14 contract', () => {
  const source = fs.readFileSync(path.join(root, 'ui-v3', 'control-plane', 'domains', 'agent-kernel.mjs'), 'utf8');
  assert.match(source, /NOLANE CORE · CHECKPOINT 14/);
  assert.doesNotMatch(source, /CHECKPOINT 12/);
});
