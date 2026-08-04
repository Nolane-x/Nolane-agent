import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TIME_TRAVEL_SCHEMAS } from '../src/time-travel/time-travel-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const receipt = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function sourceHasAll(source, needles) { return needles.every((needle) => source.includes(needle)); }

export function verifyCheckpoint14TimeTravel() {
  const contract = JSON.parse(read('requirements/checkpoint-14-time-travel-contract.json'));
  const packageJson = JSON.parse(read('package.json'));
  const schemaSource = read('src/time-travel/time-travel-schema.mjs');
  const indexSource = read('src/time-travel/checkpoint-index.mjs');
  const comparatorSource = read('src/time-travel/state-comparator.mjs');
  const restoreSource = read('src/time-travel/restore-planner.mjs');
  const replaySource = read('src/time-travel/replay-service.mjs');
  const serviceSource = read('src/time-travel/time-travel-service.mjs');
  const routeSource = read('src/server/routes.mjs');
  const appSource = read('src/app.mjs');
  const subsystemSource = read('src/adoption/trust-adoption-foundation.mjs');
  const uiSource = read('ui-v3/views/activity/activity-view.mjs');
  const appUiSource = read('ui-v3/app.mjs');
  const findings = [];
  const requiredFiles = [
    'src/time-travel/time-travel-schema.mjs',
    'src/time-travel/checkpoint-index.mjs',
    'src/time-travel/state-comparator.mjs',
    'src/time-travel/restore-planner.mjs',
    'src/time-travel/replay-service.mjs',
    'src/time-travel/time-travel-service.mjs',
    'requirements/checkpoint-14-time-travel-contract.json',
    'tests/time-travel-service.test.mjs',
    'tests/time-travel-http-api.test.mjs',
    'tests/ui-v3-time-travel.test.mjs'
  ];
  const missingFiles = requiredFiles.filter((relative) => !exists(relative));
  if (missingFiles.length) findings.push({ code: 'missing-time-travel-files', files: missingFiles });

  const actualSchemas = Object.values(TIME_TRAVEL_SCHEMAS);
  for (const schema of contract.requiredSchemas) {
    if (!actualSchemas.includes(schema) || !`${schemaSource}\n${serviceSource}`.includes(schema)) findings.push({ code: 'required-schema-missing', schema });
  }

  const literalRoutes = [
    "pathname === '/api/time-travel/checkpoints'",
    'const timeTravelCheckpoint = pathname.match',
    'compare|restore-file|branch|replay|export'
  ];
  if (!sourceHasAll(routeSource, literalRoutes)) findings.push({ code: 'required-route-family-missing' });
  for (const action of ["action === 'compare' && method === 'GET'", "action === 'restore-file' && method === 'POST'", "action === 'branch' && method === 'POST'", "action === 'replay' && method === 'POST'", "action === 'export' && method === 'GET'"]) {
    if (!routeSource.includes(action)) findings.push({ code: 'required-route-action-missing', action });
  }
  if (!routeSource.includes("method === 'GET'") || !routeSource.includes("method === 'POST'")) findings.push({ code: 'checkpoint-list-create-route-contract' });
  if (!routeSource.includes("workspaceTrust.requireTrusted(mission.projectId, 'background')") || !routeSource.includes("workspaceTrust.requireTrusted(checkpoint.projectId, action ? 'background' : 'read')")) findings.push({ code: 'workspace-trust-route-contract' });

  if (!sourceHasAll(indexSource, ["mode: 0o600", "path.join(this.root, 'blobs')", "createHash('sha256')", 'maxFiles', 'maxFileBytes', 'maxTotalBytes'])) findings.push({ code: 'durable-content-addressed-bounded-index-contract' });
  if (!sourceHasAll(indexSource, ['SENSITIVE', "reason: 'sensitive-path'", "reason: 'symlink'", 'completeWorkingTreeCapture'])) findings.push({ code: 'sensitive-and-symlink-exclusion-contract' });
  if (!sourceHasAll(indexSource, ["runGit(repositoryRoot, ['rev-parse', 'HEAD']", "runGit(repositoryRoot, ['diff', '--name-only'", "runGit(repositoryRoot, ['ls-files', '-o'", 'eventCursor'])) findings.push({ code: 'git-and-event-checkpoint-contract' });
  if (!sourceHasAll(comparatorSource, ["git(root, ['diff', '--name-status'", "git(root, ['ls-files', '-o'", 'sameCommit', 'completeCheckpoint'])) findings.push({ code: 'state-comparison-contract' });

  if (!sourceHasAll(restoreSource, ['safeRelativePath', 'TIME_TRAVEL_SYMLINK_ESCAPE', 'requiresConfirmation', 'confirmOverwrite !== true', 'storeBlob(resolved.current.bytes)', '.nolane-restore-', 'rename(temporary, resolved.absolute)', "action: 'restore-file'"])) findings.push({ code: 'safe-atomic-restore-contract' });
  if (!sourceHasAll(replaySource, ['new WorktreeManager', 'baseRef: checkpoint.git.commit', "action: 'create-branch'", 'this.store.createMission', "status: 'planned'", "status: 'todo'", 'dependencies: (task.dependencies', "action: 'replay-mission'"])) findings.push({ code: 'new-worktree-and-mission-replay-contract' });
  if (!sourceHasAll(serviceSource, ['time-travel.checkpoint.created', 'time-travel.file.restored', 'time-travel.branch.created', 'time-travel.mission.replayed', 'exportEvidence', 'executionStory'])) findings.push({ code: 'immutable-events-and-export-contract' });

  if (!subsystemSource.includes('createTimeTravelFoundation') || !appSource.includes('const timeTravel = createTimeTravelFoundation') || !appSource.includes('executionStory, timeTravel')) findings.push({ code: 'time-travel-runtime-wiring' });
  if (!sourceHasAll(uiSource, ['data-time-travel-action="create"', "const advanced=['studio','expert'].includes", 'data-time-travel-action="restore"', 'Replay as new mission', 'receiptSha256'])) findings.push({ code: 'progressive-time-travel-ui-contract' });
  if (!sourceHasAll(appUiSource, ["action==='create'", "action==='branch'", "action==='replay'", "action==='restore'", 'confirmOverwrite:true'])) findings.push({ code: 'time-travel-ui-action-wiring' });
  if (packageJson.scripts?.['verify:checkpoint-14-time-travel'] !== 'node scripts/verify-checkpoint-14-time-travel.mjs --write') findings.push({ code: 'time-travel-verifier-script-missing' });

  const report = {
    schema: 'nolane.checkpoint-14.time-travel.verification.v1',
    generatedAt: new Date().toISOString(),
    baselineCommit: contract.baselineCommit,
    deliverySlice: contract.deliverySlice,
    pass: findings.length === 0,
    schemas: actualSchemas,
    implemented: contract.implemented,
    externalOrLaterGates: contract.externalOrLaterGates,
    missingFiles,
    findings,
  };
  report.receiptSha256 = receipt(report);
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = verifyCheckpoint14TimeTravel();
  if (process.argv.includes('--write')) {
    const target = path.join(root, 'docs/checkpoints/checkpoint-14/TIME-TRAVEL-VERIFICATION.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}
