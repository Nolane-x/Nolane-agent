#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';

export async function verifyNolaneEvidenceQuality({
  projectRoot = process.cwd(),
  registryFile = 'requirements/nolane-agent-v5-requirements.json',
  concentrationThreshold = 0.15,
} = {}) {
  const root = path.resolve(projectRoot);
  const threshold = Number(concentrationThreshold);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new TypeError('concentrationThreshold must be between 0 and 1');
  const registry = JSON.parse(await readFile(path.resolve(root, registryFile), 'utf8'));
  const active = (registry.requirements ?? []).filter((item) => item.status !== 'not_implemented');
  const counts = new Map();
  const missingPaths = [];
  for (const requirement of active) {
    for (const [kind, relative] of [['entrypoint', requirement.acceptance?.entrypoint], ['exactTest', requirement.acceptance?.exactTest]]) {
      if (!relative) { missingPaths.push({ requirementId: requirement.id, kind, path: null }); continue; }
      const key = `${kind}:${relative}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      try { await access(path.resolve(root, relative)); }
      catch { missingPaths.push({ requirementId: requirement.id, kind, path: relative }); }
    }
  }
  const overConcentrated = [...counts.entries()].map(([key, count]) => {
    const separator = key.indexOf(':');
    const kind = key.slice(0, separator); const filePath = key.slice(separator + 1);
    return { kind, path: filePath, count, ratio: active.length ? count / active.length : 0 };
  }).filter((item) => item.count >= 5 && item.ratio > threshold).sort((a, b) => b.ratio - a.ratio || a.path.localeCompare(b.path));
  const base = {
    schema: 'nolane.agent.evidence-quality-report.v1',
    status: missingPaths.length || overConcentrated.length ? 'fail' : 'pass',
    checkedRequirements: active.length,
    concentrationThreshold: threshold,
    missingPaths,
    overConcentrated,
    claims: { missingEvidenceAccepted: false, overConcentratedEvidenceAccepted: false, sourceCountIsProof: false },
  };
  return Object.freeze({ ...base, missingPaths: Object.freeze(missingPaths.map(Object.freeze)), overConcentrated: Object.freeze(overConcentrated.map(Object.freeze)), claims: Object.freeze(base.claims), receiptSha256: canonicalSha256(base) });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) verifyNolaneEvidenceQuality().then((report) => { console.log(JSON.stringify(report)); if (report.status !== 'pass') process.exitCode = 1; }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
