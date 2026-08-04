import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXECUTION_STORY_EVENT_SCHEMA, EXECUTION_STORY_PHASE_SCHEMA, EXECUTION_STORY_SCHEMA } from '../src/activity/execution-story-schema.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const receipt = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function verifyCheckpoint14ExecutionStory() {
  const contract = JSON.parse(read('requirements/checkpoint-14-execution-story-contract.json'));
  const packageJson = JSON.parse(read('package.json'));
  const schemaSource = read('src/activity/execution-story-schema.mjs');
  const serviceSource = read('src/activity/execution-story-service.mjs');
  const routeSource = read('src/server/routes.mjs');
  const appSource = read('src/app.mjs');
  const subsystemSource = read('src/adoption/trust-adoption-foundation.mjs');
  const uiSource = read('ui-v3/views/activity/activity-view.mjs');
  const findings = [];
  const requiredFiles = [
    'src/activity/execution-story-schema.mjs',
    'src/activity/execution-story-service.mjs',
    'requirements/checkpoint-14-execution-story-contract.json',
    'tests/execution-story-service.test.mjs',
    'tests/execution-story-http-api.test.mjs',
    'tests/ui-v3-execution-story.test.mjs'
  ];
  const missingFiles = requiredFiles.filter((relative) => !exists(relative));
  if (missingFiles.length) findings.push({ code: 'missing-execution-story-files', files: missingFiles });

  const actualSchemas = [EXECUTION_STORY_SCHEMA, EXECUTION_STORY_EVENT_SCHEMA, EXECUTION_STORY_PHASE_SCHEMA, 'nolane.execution-story-export.v1'];
  for (const schema of contract.requiredSchemas) if (!actualSchemas.includes(schema) || !`${schemaSource}\n${serviceSource}`.includes(schema)) findings.push({ code: 'required-schema-missing', schema });
  for (const route of contract.requiredRoutes) {
    const [method, pathname] = route.split(' ');
    if (!routeSource.includes(`method !== '${method}'`) || !routeSource.includes(`pathname === '${pathname}'`)) findings.push({ code: 'required-route-missing', route });
  }
  if (!serviceSource.includes('this.store.listEvents') || /new\s+(?:Map|Set).*eventLedger/i.test(serviceSource)) findings.push({ code: 'parallel-event-ledger-created' });
  if (!schemaSource.includes('redactSecrets') || !schemaSource.includes('SECRET') || !schemaSource.includes("metadata = normalizedLevel === 'expert'")) findings.push({ code: 'story-redaction-contract' });
  if (!schemaSource.includes("normalizedLevel === 'workspace'") || !schemaSource.includes('LEVEL_RANK.studio')) findings.push({ code: 'level-detail-projection-contract' });
  for (const key of ['missionId', 'taskId', 'threadId', 'planId', 'laneId', 'runId']) if (!schemaSource.includes(`${key}:`)) findings.push({ code: 'correlation-key-missing', key });
  if (!serviceSource.includes('aggregate(storyEvents') || !serviceSource.includes('afterSeq') || !serviceSource.includes('exportBundle')) findings.push({ code: 'story-phase-replay-export-contract' });
  if (!subsystemSource.includes('createExecutionStoryFoundation') || !appSource.includes('const executionStory = createExecutionStoryFoundation') || !appSource.includes('executionStory, timeTravel, sovereignKernel')) findings.push({ code: 'execution-story-runtime-wiring' });
  if (!uiSource.includes('/api/execution-story?missionId=') || !uiSource.includes('Execution Story') || !uiSource.includes('execution-story__phases')) findings.push({ code: 'progressive-story-ui-contract' });
  if (packageJson.scripts?.['verify:checkpoint-14-execution-story'] !== 'node scripts/verify-checkpoint-14-execution-story.mjs --write') findings.push({ code: 'execution-story-verifier-script-missing' });

  const report = {
    schema: 'nolane.checkpoint-14.execution-story.verification.v1',
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
  const report = verifyCheckpoint14ExecutionStory();
  if (process.argv.includes('--write')) {
    const target = path.join(root, 'docs/checkpoints/checkpoint-14/EXECUTION-STORY-VERIFICATION.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}
