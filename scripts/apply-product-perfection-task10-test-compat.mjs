#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const target = 'tests/ui-runtime-visual-workflow.test.mjs';
const expected = '2811da315d0f4545ac13cf0223147ad241ca2605';
const current = execFileSync('git', ['hash-object', target], { encoding: 'utf8' }).trim();
if (current !== expected) throw new Error(`refusing Task 10 test migration: ${target} blob drifted`);
let source = readFileSync(target, 'utf8');
const replacements = [
  [
    "  assert.match(capturer, /browser\\.newContext\\(\\{ viewport, deviceScaleFactor: 1 \\}\\)/);",
    "  assert.match(capturer, /browser\\.newContext\\(\\{ viewport, deviceScaleFactor: 1, \\.\\.\\.\\(state\\.contextOptions \\?\\? \\{\\}\\) \\}\\)/);",
  ],
  [
    "  assert.match(capturer, /UI state did not render: \\$\\{state\\.id\\}/);",
    "  assert.match(capturer, /UI state did not render: ' \\+ state\\.id/);",
  ],
];
for (const [from, to] of replacements) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(`legacy visual contract migration expected one match, got ${count}`);
  source = source.replace(from, to);
}
writeFileSync(target, source);
console.log(JSON.stringify({ target, before: expected, after: execFileSync('git', ['hash-object', target], { encoding: 'utf8' }).trim(), replacements: replacements.length }));
