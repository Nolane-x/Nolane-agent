import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze([
  '18.10', '18.18', '18.19', '18.20', '18.21', '18.22', '18.23', '18.28',
  '19.6', '19.11', '19.12', '19.14', '19.15', '19.16', '19.17', '19.18',
  '23.48', '24.15', '24.16', '25.1',
]);

const REQUIRED_FILES = Object.freeze([
  'src/security/shell-command-codec.mjs',
  'src/security/command-risk-classifier.mjs',
  'src/security/approval-bundle-service.mjs',
  'src/security/command-execution-governance-service.mjs',
  'src/security/action-guardrail-pipeline.mjs',
  'src/security/autonomy-policy.mjs',
  'src/security/autonomy-guarded-broker.mjs',
  'src/execution/managed-process-registry.mjs',
  'src/execution/tool-broker.mjs',
  'src/terminal/terminal-service.mjs',
  'src/terminal/terminal-manager.mjs',
  'src/server/terminal-websocket.mjs',
  'src/agent/agent-loop.mjs',
  'src/app.mjs',
  'tests/shell-command-codec.test.mjs',
  'tests/command-risk-classifier.test.mjs',
  'tests/approval-bundle-service.test.mjs',
  'tests/command-execution-governance-service.test.mjs',
  'tests/managed-process-registry.test.mjs',
  'tests/tool-broker-command-governance.test.mjs',
  'tests/managed-process-tool-wiring.test.mjs',
  'tests/terminal-shell-governance.test.mjs',
  'tests/command-execution-governance-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs',
  'src/release/full-release-matrix.mjs',
]);

function auditItem(audit, id) { return audit?.sections?.flatMap((section) => section.items ?? []).find((item) => item.id === id) ?? null; }
async function source(root, relative, failures) { try { return await readFile(path.join(root, relative), 'utf8'); } catch { failures.push(`missing required source: ${relative}`); return ''; } }
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyCommandExecutionGovernance({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));

  const codec = contents.get('src/security/shell-command-codec.mjs') ?? '';
  const classifier = contents.get('src/security/command-risk-classifier.mjs') ?? '';
  const approval = contents.get('src/security/approval-bundle-service.mjs') ?? '';
  const governance = contents.get('src/security/command-execution-governance-service.mjs') ?? '';
  const processes = contents.get('src/execution/managed-process-registry.mjs') ?? '';
  const broker = contents.get('src/execution/tool-broker.mjs') ?? '';
  const terminal = `${contents.get('src/terminal/terminal-service.mjs') ?? ''}\n${contents.get('src/terminal/terminal-manager.mjs') ?? ''}\n${contents.get('src/server/terminal-websocket.mjs') ?? ''}`;
  const agent = contents.get('src/agent/agent-loop.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(codec, /(?=[\s\S]*validateArgv)(?=[\s\S]*contains a NUL byte)(?=[\s\S]*contains a newline)(?=[\s\S]*maxArgs)(?=[\s\S]*maxArgBytes)/, 'bounded argument filtering', failures);
  requirePattern(codec, /(?=[\s\S]*prepareInteractive)(?=[\s\S]*powershell)(?=[\s\S]*cmd)(?=[\s\S]*bash)(?=[\s\S]*wsl)(?=[\s\S]*--distribution)(?=[\s\S]*--exec)/i, 'Bash, PowerShell, CMD, and WSL contracts', failures);
  requirePattern(codec, /(?=[\s\S]*quoteBash)(?=[\s\S]*quotePowerShell)(?=[\s\S]*quoteCmd)(?=[\s\S]*preview)/, 'shell-specific audit escaping', failures);
  requirePattern(classifier, /(?=[\s\S]*system-change)(?=[\s\S]*permission-change)(?=[\s\S]*download-and-execute)(?=[\s\S]*administrator)(?=[\s\S]*firewall-change)(?=[\s\S]*service-start)(?=[\s\S]*service-stop)(?=[\s\S]*outbound-transfer)/, 'dangerous command categories', failures);
  requirePattern(`${classifier}\n${governance}`, /(?=[\s\S]*COMMAND_SECRET_IN_CHAT)(?=[\s\S]*COMMAND_SENSITIVE_UPLOAD)(?=[\s\S]*dangerous-sql)(?=[\s\S]*database\.mutate)(?=[\s\S]*secretFindings)(?=[\s\S]*fingerprint)/, 'secret-safe SQL and upload governance', failures);
  requirePattern(approval, /(?=[\s\S]*approvalMode !== 'always')(?=[\s\S]*risk !== 'critical')(?=[\s\S]*fingerprint)(?=[\s\S]*maxTasks)/, 'bounded anti-fatigue approval grouping', failures);
  requirePattern(processes, /(?=[\s\S]*positive PID)(?=[\s\S]*process\.kill\(-record\.pid)(?=[\s\S]*SIGTERM)(?=[\s\S]*SIGKILL)(?=[\s\S]*close\(\))/, 'PID-managed server lifecycle', failures);
  requirePattern(broker, /(?=[\s\S]*process\.startManaged)(?=[\s\S]*process\.stopManaged)(?=[\s\S]*process\.listManaged)(?=[\s\S]*Development servers must use process\.startManaged)(?=[\s\S]*shell:\s*false)(?=[\s\S]*governanceReceiptSha256)/, 'ToolBroker governance and managed-server wiring', failures);
  requirePattern(terminal, /(?=[\s\S]*ShellCommandCodec)(?=[\s\S]*shellKind)(?=[\s\S]*commandGovernance)(?=[\s\S]*governanceReceiptSha256)(?=[\s\S]*taskId)(?=[\s\S]*distribution)/, 'PTY shell and principal-bound governance', failures);
  requirePattern(agent, /(?=[\s\S]*name:\s*'process\.startManaged')(?=[\s\S]*name:\s*'process\.stopManaged')(?=[\s\S]*name:\s*'process\.listManaged')(?=[\s\S]*principalId:\s*`agent:\$\{task\.id\}`)(?=[\s\S]*sessionId:\s*run\.id)/, 'agent schemas and identity-bound context', failures);
  requirePattern(app, /(?=[\s\S]*ApprovalBundleService)(?=[\s\S]*CommandExecutionGovernanceService)(?=[\s\S]*commandGovernance:\s*commandExecutionGovernance)(?=[\s\S]*terminalManager\.commandGovernance)/, 'application governance wiring', failures);
  requirePattern(auditSource, /commandExecutionGovernance[\s\S]*Hỗ trợ pseudo-terminal[\s\S]*Không lưu API key trong chat/, 'item-level command execution audit rules', failures);
  requirePattern(matrix, /id:\s*'command-execution-governance'[\s\S]*scripts\/verify-command-execution-governance\.mjs/, 'full release matrix command execution gate', failures);
  if (/shell\s*:\s*true|execSync\s*\(|execFileSync\s*\(|child_process\.exec\s*\(/i.test(`${broker}\n${processes}`)) failures.push('non-interactive command execution must not use free-form shell strings');

  let audit = null;
  try { audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8')); }
  catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }
  for (const id of VERIFIED_ITEMS) if (auditItem(audit, id)?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);

  const limitationsText = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  const windowsBoundary = /(?=[\s\S]*Windows)(?=[\s\S]*source contracts?)(?=[\s\S]*(?:not Windows production certification|không.*chứng nhận.*Windows))/i.test(limitationsText);
  const shellBoundary = /non-interactive.*shell:\s*false|không.*free-form shell|không.*chuỗi shell tự do/i.test(limitationsText);
  const approvalBoundary = /critical.*never.*bundled|critical.*không.*gộp|không gộp.*critical/i.test(limitationsText);
  const limitations = Object.freeze({
    windowsProductionCertified: !windowsBoundary,
    freeFormShellExecutionClaimed: !shellBoundary,
    criticalApprovalBundlingClaimed: !approvalBoundary,
  });
  for (const [name, claimed] of Object.entries(limitations)) if (claimed) failures.push(`unsafe or unsupported claim remains: ${name}`);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = Object.freeze({
    schema: 'forge.studio.command-execution-governance-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    verifiedItems: VERIFIED_ITEMS,
    limitations,
    failures: Object.freeze(failures),
    fileDigests: Object.freeze(fileDigests),
  });
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    const target = path.resolve(outputFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Command execution governance verification failed: ${failures.join('; ')}`);
    error.code = 'COMMAND_EXECUTION_GOVERNANCE_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
