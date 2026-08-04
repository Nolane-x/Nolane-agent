import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SecurityCertificationPlane } from '../src/security/security-certification-plane.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

const sha = (c) => c.repeat(64);

test('security certification plane is lazy bounded and closes all loaded services', () => {
  const plane = new SecurityCertificationPlane({ clock: () => 1000 });
  const initial = plane.snapshot();
  assert.deepEqual(initial.lifecycle, {
    closed: false, taintLoaded: false, injectionLoaded: false, quarantineLoaded: false,
    dependencyLoaded: false, sbomLoaded: false, integrityLoaded: false, exfiltrationLoaded: false,
    missionTokensLoaded: false, auditLoaded: false, boundaryLoaded: false, sandboxLoaded: false,
    failureLoaded: false, comparabilityLoaded: false, contaminationLoaded: false,
    evidenceJournalLoaded: false, certificationLoaded: false,
  });
  const taint = plane.analyzeTaint({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }], sources: [{ nodeId: 'a', label: 'input', provenance: 'test' }], sinks: [{ nodeId: 'b', kind: 'shell', impact: 'critical' }] });
  assert.equal(taint.status, 'block');
  const snapshot = plane.snapshot();
  assert.equal(snapshot.lifecycle.taintLoaded, true);
  assert.equal(snapshot.lifecycle.auditLoaded, false);
  assert.equal(snapshot.claims.rawPayloadStored, false);
  assert.equal(snapshot.claims.rawPromptStored, false);
  assert.equal(snapshot.claims.secretMaterialStored, false);
  assert.equal(Object.hasOwn(snapshot, 'payload'), false);
  const closed = plane.close();
  assert.equal(closed.lifecycle.closed, true);
  assert.throws(() => plane.analyzeTaint({}), /closed/i);
});

test('DecisionPlane exposes security certification lazily without app composition imports', async () => {
  const plane = new DecisionPlane({ securityCertification: { clock: () => 1000 } });
  assert.equal(plane.snapshot().lifecycle.securityCertificationLoaded, false);
  const report = plane.assessDependencySecurity({
    dependency: { name: 'pkg', currentVersion: '1', candidateVersion: '2' },
    evidence: {}, compatibility: { status: 'verified', apiReceiptSha256: sha('a'), testReceiptSha256: sha('b') },
  });
  assert.equal(report.status, 'pass');
  assert.equal(plane.snapshot().lifecycle.securityCertificationLoaded, true);
  assert.equal(plane.securityCertificationSnapshot().lifecycle.dependencyLoaded, true);
  plane.close();
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.equal(app.includes('security-certification-plane'), false);
  assert.equal(app.includes('taint-analysis-engine'), false);
});
