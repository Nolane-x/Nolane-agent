import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { buildVsCodeExtension } from '../scripts/build-vscode-extension.mjs';
const require = createRequire(import.meta.url);

test('VS Code projects bounded security certification state and rejects private fields', async () => {
  await buildVsCodeExtension();
  const modulePath = path.resolve('extensions/vscode/extension/dist/mission-state.js');
  delete require.cache[modulePath];
  const { projectSecurityCertificationState } = require(modulePath);
  const projected = projectSecurityCertificationState({
    schema: 'forge.security-certification-plane-snapshot.v1', receiptSha256: 'f'.repeat(64), auditEntries: 2, benchmarkEvidenceEntries: 3,
    findings: Array.from({ length: 150 }, (_, index) => ({ code: `finding-${index}`, severity: index === 0 ? 'critical' : 'low', receiptSha256: 'a'.repeat(64) })),
    quarantines: [{ kind: 'dependency', subjectId: 'pkg', status: 'quarantine', receiptSha256: 'b'.repeat(64) }],
    certification: { claimAllowed: false, reasons: ['independent-attestation-missing'], commonTaskCount: 0, receiptSha256: 'c'.repeat(64) },
    claims: { comparativeSuperiorityProven: false, rawPromptStored: false },
  });
  assert.equal(projected.schema, 'nolane.agent.vscode-security-certification-state.v1');
  assert.equal(projected.findings.length, 100);
  assert.equal(projected.certification.claimAllowed, false);
  assert.equal(projected.claims.comparativeSuperiorityProven, false);
  assert.throws(() => projectSecurityCertificationState({ rawPrompt: 'secret' }), /private/i);
});
