#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function bytesOrFailure(root, relative, requirementId, kind, failures) {
  if (!relative || typeof relative !== 'string') {
    failures.push({ requirementId, code: `${kind.toUpperCase()}_MISSING`, path: relative ?? null });
    return null;
  }
  const absolute = path.resolve(root, relative);
  const rel = path.relative(root, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    failures.push({ requirementId, code: `${kind.toUpperCase()}_OUTSIDE_ROOT`, path: relative });
    return null;
  }
  try { return await readFile(absolute); }
  catch { failures.push({ requirementId, code: `${kind.toUpperCase()}_NOT_FOUND`, path: relative }); return null; }
}

export async function verifyNolaneEvidenceFreshness({
  projectRoot = process.cwd(),
  registryFile = 'requirements/nolane-agent-v5-requirements.json',
} = {}) {
  const root = path.resolve(projectRoot);
  const registry = JSON.parse(await readFile(path.resolve(root, registryFile), 'utf8'));
  const failures = [];
  let checked = 0;
  for (const requirement of registry.requirements ?? []) {
    if (requirement.status === 'not_implemented') continue;
    checked += 1;
    const acceptance = requirement.acceptance ?? {};
    const entrypoint = await bytesOrFailure(root, acceptance.entrypoint, requirement.id, 'entrypoint', failures);
    const exactTest = await bytesOrFailure(root, acceptance.exactTest, requirement.id, 'exact_test', failures);
    if (!entrypoint || !exactTest) continue;
    const actualEvidence = {
      environment: acceptance.evidence?.environment ?? 'node>=22.12',
      entrypointSha256: sha256(entrypoint),
      exactTestSha256: sha256(exactTest),
    };
    if (actualEvidence.entrypointSha256 !== acceptance.evidence?.entrypointSha256) failures.push({ requirementId: requirement.id, code: 'ENTRYPOINT_SHA_MISMATCH', path: acceptance.entrypoint });
    if (actualEvidence.exactTestSha256 !== acceptance.evidence?.exactTestSha256) failures.push({ requirementId: requirement.id, code: 'EXACT_TEST_SHA_MISMATCH', path: acceptance.exactTest });
    const expectedReplay = sha256(JSON.stringify({ id: requirement.id, ...actualEvidence }));
    if (expectedReplay !== acceptance.replayReceiptSha256) failures.push({ requirementId: requirement.id, code: 'REPLAY_RECEIPT_MISMATCH' });
  }
  const base = {
    schema: 'nolane.agent.evidence-freshness-report.v1',
    product: registry.product ?? 'Nolane Agent',
    version: registry.version ?? null,
    status: failures.length === 0 ? 'pass' : 'fail',
    checked,
    failures,
    claims: { missingEvidenceAccepted: false, staleEvidenceAccepted: false, sourceAndTestHashesRequired: true },
  };
  return Object.freeze({ ...base, failures: Object.freeze(failures.map(Object.freeze)), claims: Object.freeze(base.claims), receiptSha256: canonicalSha256(base) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  verifyNolaneEvidenceFreshness().then((report) => {
    console.log(JSON.stringify(report));
    if (report.status !== 'pass') process.exitCode = 1;
  }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
}
