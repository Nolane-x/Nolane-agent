import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { AgentModeRegistry, AGENT_MODE_IDS } from '../agents/agent-mode-registry.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'canonical-mode-registry','narrowing-only-resolution','mission-and-task-propagation','broker-boundary-enforcement',
  'offline-local-provider','receipt-mode-binding','authenticated-api','lazy-control-center','full-release-matrix-gate',
]);
const REQUIRED_FILES = Object.freeze([
  'src/agents/agent-mode-registry.mjs',
  'src/agents/agent-mode-service.mjs',
  'src/orchestration/run-coordinator.mjs',
  'src/security/autonomy-guarded-broker.mjs',
  'src/security/autonomy-policy.mjs',
  'src/server/routes.mjs',
  'src/app.mjs',
  'ui/agent-modes-center.js',
  'ui/agent-modes-center.css',
  'tests/agent-mode-service.test.mjs',
  'tests/agent-mode-runtime.test.mjs',
  'tests/agent-modes-http-api.test.mjs',
  'tests/agent-modes-app-wiring.test.mjs',
  'tests/agent-modes-center-ui.test.mjs',
  'tests/agent-modes-release-gate.test.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyAgentModes({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const registry = new AgentModeRegistry(); const modes = registry.list();
  if (modes.length !== 20 || AGENT_MODE_IDS.length !== 20) failures.push(`expected 20 canonical modes, found ${modes.length}`);
  if (new Set(modes.map((mode) => mode.id)).size !== 20) failures.push('mode ids must be unique');
  for (const id of AGENT_MODE_IDS) {
    const mode = modes.find((item) => item.id === id);
    if (!mode) { failures.push(`missing canonical mode: ${id}`); continue; }
    for (const field of ['approvalPolicy','networkPolicy','commitPolicy','toolGroups','requiredCapabilities','maxTurns','maxTasks','budgetTokens','contextBudget','verificationDepth']) if (mode[field] === undefined) failures.push(`mode ${id} missing ${field}`);
    if (!Object.isFrozen(mode)) failures.push(`mode ${id} is not immutable`);
  }
  const contents = new Map(); for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const service = contents.get('src/agents/agent-mode-service.mjs') ?? '';
  const coordinator = contents.get('src/orchestration/run-coordinator.mjs') ?? '';
  const broker = contents.get('src/security/autonomy-guarded-broker.mjs') ?? '';
  const policy = contents.get('src/security/autonomy-policy.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/agent-modes-center.js') ?? '';
  const css = contents.get('ui/agent-modes-center.css') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';
  requirePattern(service, /may only remove entries[\s\S]*may only lower the built-in limit[\s\S]*cannot be broadened/, 'narrowing-only override enforcement', failures);
  requirePattern(service, /Offline mode requires an available local provider/, 'offline local-provider enforcement', failures);
  requirePattern(coordinator, /providerInventory[\s\S]*modeResolution[\s\S]*modeId:[\s\S]*modePolicy:[\s\S]*modeReceiptSha256:/, 'mission and task mode propagation', failures);
  requirePattern(broker, /modeId:[\s\S]*modePolicy:[\s\S]*AGENT_MODE_ACTION_DENIED/, 'broker-boundary mode enforcement', failures);
  requirePattern(policy, /mode-read-only[\s\S]*mode-tool-group[\s\S]*mode-network/, 'read-only, tool, and offline policy decisions', failures);
  requirePattern(routes, /\/api\/agent-modes[\s\S]*\/api\/agent-modes\/resolve[\s\S]*modeOverrides/, 'authenticated Agent Modes API', failures);
  requirePattern(app, /new AgentModeService[\s\S]*agentModes[\s\S]*providerInventory/, 'application Agent Mode wiring', failures);
  for (const label of ['Ask','Read only','Plan','Edit with approval','Auto edit','Review','Debug','Test writer','Refactor','Migration','Architecture','Create project','CI repair','Issue resolution','Background','Learn codebase','Explain step by step','Fast','Deep','Offline local']) requirePattern(ui, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `UI mode ${label}`, failures);
  requirePattern(ui, /\/api\/agent-modes\/resolve[\s\S]*\/api\/agent\/runs/, 'UI canonical resolution and run creation', failures);
  requirePattern(css, /mode-neural-orbit[\s\S]*mode-policy-matrix[\s\S]*prefers-reduced-motion/, 'future Agent Modes UI and reduced motion', failures);
  requirePattern(matrix, /id:\s*'agent-modes-governance'/, 'full release matrix gate', failures);
  const fileDigests = {}; for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = { schema: 'forge.studio.agent-modes-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', modeCount: modes.length, modeIds: Object.freeze([...AGENT_MODE_IDS]), requiredCapabilities: REQUIRED_CAPABILITIES, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Agent modes verification failed: ${failures.join('; ')}`); error.code = 'AGENT_MODES_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
