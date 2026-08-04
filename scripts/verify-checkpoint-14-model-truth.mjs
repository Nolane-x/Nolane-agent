import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODEL_TRUTH_SCHEMAS } from '../src/model-profiles/model-truth-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const receipt = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function verifyCheckpoint14ModelTruth() {
  const contract = JSON.parse(read('requirements/checkpoint-14-model-truth-contract.json'));
  const packageJson = JSON.parse(read('package.json'));
  const routes = read('src/server/routes.mjs');
  const schemaSource = read('src/model-profiles/model-truth-schema.mjs');
  const storeSource = read('src/model-profiles/model-truth-store.mjs');
  const planeSource = read('src/model-profiles/model-truth-plane.mjs');
  const compatibilitySource = read('src/providers/model-profile-registry.mjs');
  const managementSource = read('src/model-management/model-management-service.mjs');
  const agentSource = read('src/agent/agent-loop.mjs');
  const uiSource = read('ui-v3/views/settings/model-profiles-panel.mjs');
  const appSource = read('src/app.mjs');
  const findings = [];

  const requiredFiles = [
    'docs/adr/ADR-014-model-truth-schema-and-compatibility.md',
    'requirements/checkpoint-14-model-truth-contract.json',
    'src/model-profiles/model-truth-schema.mjs',
    'src/model-profiles/model-truth-store.mjs',
    'src/model-profiles/model-truth-plane.mjs',
    'tests/model-truth-schema.test.mjs',
    'tests/model-truth-store.test.mjs',
    'tests/model-truth-plane.test.mjs',
    'tests/model-management-truth.test.mjs',
    'tests/model-intelligence-http-api.test.mjs',
    'tests/agent-loop-model-observation.test.mjs',
    'tests/ui-v3-model-truth.test.mjs'
  ];
  const missingFiles = requiredFiles.filter((relative) => !exists(relative));
  if (missingFiles.length) findings.push({ code: 'missing-model-truth-files', files: missingFiles });

  const actualSchemas = Object.values(MODEL_TRUTH_SCHEMAS);
  for (const schema of contract.requiredSchemas) {
    if (!actualSchemas.includes(schema) || !schemaSource.includes(schema)) findings.push({ code: 'required-schema-missing', schema });
  }

  for (const route of contract.requiredRoutes) {
    const [method, pathname] = route.split(' ');
    if (!routes.includes(`method === '${method}'`) || !routes.includes(`pathname === '${pathname}'`)) findings.push({ code: 'required-route-missing', route });
  }

  if (!schemaSource.includes('legacyProfile: deepClone(profile)') || !schemaSource.includes('truthBundleToLegacyProfile')) findings.push({ code: 'legacy-round-trip-contract-missing' });
  if (!storeSource.includes("mode: 0o600") || !storeSource.includes('SOURCE_WEIGHT') || !storeSource.includes('conflicted') || !storeSource.includes('expiresAt')) findings.push({ code: 'truth-ledger-integrity-contract' });
  if (!storeSource.includes('recordDiscovery') || !storeSource.includes('recordEvaluation') || !storeSource.includes('recordRuntimeObservation')) findings.push({ code: 'truth-observation-ledgers-missing' });
  if (!planeSource.includes('legacyProfileToTruthBundle') || !planeSource.includes('recordDiscoveryBatch') || !planeSource.includes('compare(modelIds')) findings.push({ code: 'truth-plane-convergence-contract' });
  if (!compatibilitySource.includes("schema: 'nolane.model-profiles.v2'") || !compatibilitySource.includes('attachTruthPlane') || !compatibilitySource.includes('canonicalTruthSchema') && compatibilitySource.includes('truth }')) findings.push({ code: 'compatibility-projection-contract' });
  if (!managementSource.includes('runtimeObservations') || !managementSource.includes('model-routing-explanation.v1') || !managementSource.includes('truthPlane.compare')) findings.push({ code: 'management-plane-truth-contract' });
  if (!agentSource.includes('modelObservationSink') || !agentSource.includes('agent.model.observation-failed')) findings.push({ code: 'agent-observation-contract' });
  if (!appSource.includes('modelObservationSink') || !appSource.includes('modelManager.recordExecution')) findings.push({ code: 'agent-observation-wiring' });
  if (!uiSource.includes('Compared model deployments') || !uiSource.includes('conflicts') || !uiSource.includes('Canonical dossier')) findings.push({ code: 'model-truth-ui-contract' });
  if (packageJson.scripts?.['verify:checkpoint-14-model-truth'] !== 'node scripts/verify-checkpoint-14-model-truth.mjs --write') findings.push({ code: 'model-truth-verifier-script-missing' });

  const report = {
    schema: 'nolane.checkpoint-14.model-truth.verification.v1',
    generatedAt: new Date().toISOString(),
    baselineCommit: contract.baselineCommit,
    deliverySlice: contract.deliverySlice,
    pass: findings.length === 0,
    schemas: actualSchemas,
    implemented: contract.implemented,
    compatibilityContracts: contract.compatibilityContracts,
    externalOrLaterGates: contract.externalOrLaterGates,
    missingFiles,
    findings
  };
  report.receiptSha256 = receipt(report);
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = verifyCheckpoint14ModelTruth();
  if (process.argv.includes('--write')) {
    const target = path.join(root, 'docs/checkpoints/checkpoint-14/MODEL-TRUTH-VERIFICATION.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}
