#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const target = 'scripts/apply-product-perfection-task10.mjs';
const expected = '06eb267a2972382f505012feeab04ac9648010be';
const hash = (path) => execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();
if (hash(target) !== expected) throw new Error(`refusing helper repair: ${target} blob drifted`);

let source = readFileSync(target, 'utf8');
const replacements = [
  ["throw new Error(`Home primary action focus evidence failed: ${JSON.stringify(result)}`);", "throw new Error('Home primary action focus evidence failed: ' + JSON.stringify(result));"],
  ["throw new Error(`Vietnamese responsive state did not project Vietnamese UI truth: ${JSON.stringify(result)}`);", "throw new Error('Vietnamese responsive state did not project Vietnamese UI truth: ' + JSON.stringify(result));"],
  ["throw new Error(`Activity polling lost keyboard focus: ${key} -> ${focusedKey}`);", "throw new Error('Activity polling lost keyboard focus: ' + key + ' -> ' + focusedKey);"],
  ["throw new Error(`${method} ${pathname} failed with ${response.status}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);", "throw new Error(method + ' ' + pathname + ' failed with ' + response.status + ': ' + (typeof payload === 'string' ? payload : JSON.stringify(payload)));"],
  ["await request(`/api/agent/runs/${encodeURIComponent(mission.id)}/diff-review`);", "await request('/api/agent/runs/' + encodeURIComponent(mission.id) + '/diff-review');"],
  ["location.hash = `/review/${encodeURIComponent(missionId)}`;", "location.hash = '/review/' + encodeURIComponent(missionId);"],
  ["throw new Error(`Review UI did not expose the current review SHA prefix: ${prefix}`);", "throw new Error('Review UI did not expose the current review SHA prefix: ' + prefix);"],
  ["`${violation.id} (${violation.impact}) at ${node.target.join(' ')}`", "violation.id + ' (' + violation.impact + ') at ' + node.target.join(' ')"],
  ["throw new Error(`${state.id} reported serious or critical accessibility violations: ${summary}`);", "throw new Error(state.id + ' reported serious or critical accessibility violations: ' + summary);"],
  ["throw new Error(`UI state did not render: ${state.id}; diagnostic=${JSON.stringify(diagnostic)}`, { cause: error });", "throw new Error('UI state did not render: ' + state.id + '; diagnostic=' + JSON.stringify(diagnostic), { cause: error });"],
  ["throw new Error(`${state.id} emitted page errors: ${pageErrors.join(' | ')}`);", "throw new Error(state.id + ' emitted page errors: ' + pageErrors.join(' | '));"],
  ["const filename = `${state.id}.png`;", "const filename = state.id + '.png';"],
  ["await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify({ ...report, receiptSha256 }, null, 2)}\\n`);", "await writeFile(path.join(output, 'receipt.json'), JSON.stringify({ ...report, receiptSha256 }, null, 2) + String.fromCharCode(10));"],
  ["async function applyStatePreferences(page, state) {", "async function applyStatePreferences(page, state, credential) {"],
  ["const outcome = await page.evaluate(async (value) => {", "const outcome = await page.evaluate(async ({ patch, credential }) => {"],
  ["headers: { 'content-type': 'application/json' },", "headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' },"],
  ["body: JSON.stringify({ layer: 'user', patch: value }),", "body: JSON.stringify({ layer: 'user', patch }),"],
  ["}, patch);", "}, { patch, credential });"],
  ["await applyStatePreferences(page, state);", "await applyStatePreferences(page, state, credential);"],
];

for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`helper repair expected one match, got ${count}: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

writeFileSync(target, source);
execFileSync(process.execPath, ['--check', target], { stdio: 'inherit' });
console.log(JSON.stringify({ target, before: expected, after: hash(target), replacements: replacements.length }));
