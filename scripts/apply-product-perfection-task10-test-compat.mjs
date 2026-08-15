#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const target = 'tests/ui-runtime-visual-workflow.test.mjs';
const expected = '2811da315d0f4545ac13cf0223147ad241ca2605';
const current = execFileSync('git', ['hash-object', target], { encoding: 'utf8' }).trim();
if (current !== expected) throw new Error(`refusing Task 10 test migration: ${target} blob drifted`);
let source = readFileSync(target, 'utf8');
const from = "  assert.match(capturer, /browser\\.newContext\\(\\{ viewport, deviceScaleFactor: 1 \\}\\)/);";
const to = "  assert.match(capturer, /browser\\.newContext\\(\\{ viewport, deviceScaleFactor: 1, \\.\\.\\.\\(state\\.contextOptions \\?\\? \\{\\}\\) \\}\\)/);";
if (!source.includes(from)) throw new Error('missing legacy newContext assertion');
source = source.replace(from, to);
writeFileSync(target, source);
console.log(JSON.stringify({ target, before: expected, after: execFileSync('git', ['hash-object', target], { encoding: 'utf8' }).trim() }));
