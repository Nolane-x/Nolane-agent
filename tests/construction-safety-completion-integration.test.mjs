import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { ConstructionControlPlane } from '../src/construction/construction-control-plane.mjs';
import { VerificationControlPlane } from '../src/verification/verification-control-plane.mjs';
import { WorldDevelopmentPlane } from '../src/runtime/world-development-plane.mjs';
import { CognitiveKernel } from '../src/cognition/cognitive-kernel.mjs';

const execFileAsync = promisify(execFile);
const sha = (value) => canonicalSha256(value);
async function git(cwd, args) { return execFileAsync('git', args, { cwd, windowsHide: true }); }
async function repo(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-safety-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ['init', '-q']); await git(root, ['config', 'user.email', 'test@example.invalid']); await git(root, ['config', 'user.name', 'Forge Test']);
  await mkdir(path.join(root, 'src')); await writeFile(path.join(root, 'src', 'a.mjs'), 'export const a = 1;\n'); await git(root, ['add', '.']); await git(root, ['commit', '-qm', 'baseline']);
  return root;
}

test('construction control plane exposes completion runtimes lazily', async (t) => {
  const root = await repo(t);
  const plane = new ConstructionControlPlane({ workspaceRoot: root, capsuleRoot: path.join(root, '.forge', 'capsules'), safetyStateRoot: path.join(root, '.forge', 'safety') });
  let snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.contractRuntimeLoaded, false);
  assert.equal(snapshot.lifecycle.changeSafetyLoaded, false);
  const contract = plane.compileConstructionContract({ contractId: 'c', types: [], interfaces: [], errors: [], states: [], compatibility: { publicApi: 'internal-only' } });
  assert.match(contract.receiptSha256, /^[a-f0-9]{64}$/);
  const diff = plane.semanticApiDiff({ before: [], after: [{ symbolId: 'x', signature: 'x(): void', citation: { sourceHash: sha('x') } }] });
  assert.equal(diff.breaking, false);
  snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.contractRuntimeLoaded, true);
  assert.equal(snapshot.lifecycle.changeSafetyLoaded, true);
});

test('verification control plane keeps hidden cases behind lazy encrypted runtime', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-verification-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const plane = new VerificationControlPlane({ hiddenVaultRoot: root, hiddenVaultKey: Buffer.alloc(32, 4) });
  assert.equal(plane.snapshot().lifecycle.independentRuntimeLoaded, false);
  const registered = await plane.registerHiddenRegressionCase({ caseId: 'h1', taskKind: 'bug', executorInput: { x: 1 }, expected: { y: 2 } });
  assert.equal(registered.payloadExposed, false);
  const result = await plane.evaluateHiddenRegressionCase('h1', async ({ x }) => ({ y: x + 1 }));
  assert.equal(result.status, 'pass');
  assert.equal(plane.snapshot().lifecycle.independentRuntimeLoaded, true);
});

test('cognitive and world planes expose causal and counterfactual phases lazily', async () => {
  const cognition = new CognitiveKernel();
  assert.equal(cognition.snapshot().claims.causalInterventionLoaded, false);
  const causal = await cognition.runCausalIntervention({ interventionId: 'i', baselineState: { x: 1, y: 2 }, intervention: { variable: 'x', value: 3 }, heldConstantVariables: ['y'], execute: async (state) => ({ observedState: state, outcome: { ok: true }, receiptSha256: sha(state) }) });
  assert.equal(causal.status, 'pass');
  assert.equal(cognition.snapshot().claims.causalInterventionLoaded, true);

  const world = new WorldDevelopmentPlane();
  assert.equal(world.snapshot().lifecycle.counterfactualChangeLoaded, false);
  const imagined = world.imagineChange({ changeId: 'c', baselineCandidateId: 'none', candidates: [
    { candidateId: 'none', reliability: 1, effects: {}, utility: 0, citations: [{ kind: 'baseline', sourceHash: sha('baseline') }] },
    { candidateId: 'patch', reliability: 0.9, effects: { test: 1 }, utility: 1, citations: [{ kind: 'patch', sourceHash: sha('patch') }] },
  ] });
  assert.equal(imagined.phase, 'imagine');
  assert.equal(world.snapshot().lifecycle.counterfactualChangeLoaded, true);
});
