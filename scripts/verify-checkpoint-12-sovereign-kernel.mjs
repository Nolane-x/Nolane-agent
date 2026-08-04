import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { checkpoint12SourceFingerprint } from './checkpoint-12-source-fingerprint.mjs';

const root = path.resolve('.');
const outputDir = path.join(root, 'release/checkpoint-12');
const results = [];
const startedAt = new Date().toISOString();

async function gate(id, label, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    results.push({ id, label, status: 'pass', durationMs: Date.now() - started, evidence });
  } catch (error) {
    results.push({ id, label, status: 'fail', durationMs: Date.now() - started, error: String(error?.stack ?? error) });
  }
}
function command(file, args) {
  return execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 240_000 });
}
function assert(value, message) { if (!value) throw new Error(message); }
async function json(relative) { return JSON.parse(await readFile(path.join(root, relative), 'utf8')); }
function pngDimensions(buffer) {
  assert(buffer.subarray(1, 4).toString('ascii') === 'PNG', 'not a PNG file');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

await gate('CP12-001', 'Kernel source surface exists', async () => {
  const files = ['kernel-utils.mjs','thread-ledger.mjs','context-compiler.mjs','reviewer-boundary.mjs','capability-lease-authority.mjs','speculative-execution-fabric.mjs','sovereign-agent-kernel.mjs','index.mjs'];
  for (const name of files) assert((await stat(path.join(root, 'src/kernel', name))).isFile(), `missing src/kernel/${name}`);
  return { files: files.length };
});

await gate('CP12-002', 'Kernel and runtime syntax', async () => {
  for (const file of ['src/app.mjs','src/server/routes.mjs','src/kernel/thread-ledger.mjs','src/kernel/context-compiler.mjs','src/kernel/reviewer-boundary.mjs','src/kernel/capability-lease-authority.mjs','src/kernel/speculative-execution-fabric.mjs','src/kernel/sovereign-agent-kernel.mjs']) command(process.execPath, ['--check', file]);
  return { checked: 8 };
});

await gate('CP12-003', 'Core kernel tests', async () => {
  const files = ['tests/sovereign-thread-ledger.test.mjs','tests/sovereign-context-compiler.test.mjs','tests/sovereign-capability-leases.test.mjs','tests/sovereign-execution-fabric.test.mjs','tests/sovereign-agent-kernel.test.mjs'];
  command(process.execPath, ['--test', ...files]); return { files: files.length };
});

await gate('CP12-004', 'Restart durability', async () => {
  command(process.execPath, ['--test', 'tests/sovereign-kernel-restart-durability.test.mjs']);
  const before = await json('release/checkpoint-12/LIVE-SNAPSHOT-BEFORE-RESTART.json');
  const after = await json('release/checkpoint-12/LIVE-SNAPSHOT-AFTER-RESTART.json');
  assert(JSON.stringify(before.metrics) === JSON.stringify(after.metrics), 'live restart metrics differ');
  assert(after.architecture.durableKernelArtifacts === true && after.architecture.restartResumablePlans === true, 'restart architecture flags missing');
  return { metrics: after.metrics, beforeReceipt: before.receiptSha256, afterReceipt: after.receiptSha256 };
});

await gate('CP12-005', 'Authenticated kernel HTTP API', async () => {
  command(process.execPath, ['--test', 'tests/sovereign-kernel-http-api.test.mjs']); return { routes: 15 };
});

await gate('CP12-006', 'App composition budget', async () => {
  command(process.execPath, ['--test', 'tests/decision-plane-app-wiring.test.mjs','tests/mission-resource-fabric-app-wiring.test.mjs','tests/repository-intelligence-fabric-app-wiring.test.mjs']);
  const source = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
  const imports = (source.match(/^import\s/gm) ?? []).length;
  const constructors = (source.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length;
  assert(imports <= 160, `static imports exceed budget: ${imports}`); assert(constructors <= 180, `constructors exceed budget: ${constructors}`);
  return { staticImports: imports, constructors };
});

await gate('CP12-007', 'Production Control Plane build', async () => {
  command(process.execPath, ['scripts/build-ui-v3.mjs']);
  command(process.execPath, ['--test', 'tests/ui-v3-sovereign-agent-kernel.test.mjs']);
  const manifest = await json('ui-dist/manifest.json');
  assert(manifest.modules['control-plane/domains/agent-kernel.mjs'], 'agent-kernel module missing from UI manifest');
  return { files: Object.keys(manifest.files).length, module: manifest.modules['control-plane/domains/agent-kernel.mjs'] };
});

await gate('CP12-008', 'Live UI screenshots', async () => {
  const names = ['01-sovereign-kernel-live-desktop.png','02-sovereign-kernel-live-deep-view.png','03-sovereign-kernel-live-responsive.png'];
  const evidence = [];
  for (const name of names) {
    const bytes = await readFile(path.join(outputDir, 'screenshots', name)); const dimensions = pngDimensions(bytes);
    assert(dimensions.width >= 1100 && dimensions.height >= 900, `${name} is below evidence resolution`);
    evidence.push({ name, bytes: bytes.length, ...dimensions, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return evidence;
});

await gate('CP12-009', 'Research capability matrix', async () => {
  const matrix = await json('release/checkpoint-12/RESEARCH-CAPABILITY-MATRIX.json');
  assert(matrix.entries.length >= 12, 'research matrix is incomplete');
  const products = [...new Set(matrix.entries.map((item) => item.product))];
  assert(products.includes('Cursor') && products.includes('Claude Code') && products.includes('OpenAI Codex'), 'required product research is missing');
  return { entries: matrix.entries.length, products };
});

await gate('CP12-010', 'Full Node suite receipt', async () => {
  const receipt = await json('release/checkpoint-12/FULL-NODE-SUITE-RECEIPT.json');
  const source = await checkpoint12SourceFingerprint(root);
  assert(receipt.status === 'pass', 'full Node suite is not pass');
  assert(receipt.passedFiles === receipt.totalFiles, 'not every test file passed');
  assert(receipt.sourceFingerprintSha256 === source.sha256, 'full suite receipt does not match current source fingerprint');
  const log = await readFile(path.join(root, receipt.log));
  assert(createHash('sha256').update(log).digest('hex') === receipt.logSha256, 'full suite log hash mismatch');
  return { tests: receipt.tests, files: receipt.totalFiles, sourceFingerprintSha256: source.sha256, receiptSha256: receipt.receiptSha256 };
});

await gate('CP12-011', 'Receipt primitives self-verify', async () => {
  command(process.execPath, ['--test', 'tests/sovereign-kernel-restart-durability.test.mjs','tests/sovereign-capability-leases.test.mjs']);
  const source = await readFile(path.join(root, 'src/kernel/kernel-utils.mjs'), 'utf8');
  assert(source.includes('delete unsigned.receiptSha256'), 'receipt re-signing does not remove the previous receipt');
  assert(source.includes('verifySigned'), 'receipt verifier is missing');
  return { resigningSafe: true, verifierPresent: true };
});

await gate('CP12-012', 'Documentation and delivery evidence', async () => {
  const files = ['docs/SOVEREIGN-AGENT-KERNEL-2026-08-03.md','docs/CHECKPOINT-12-SOVEREIGN-AGENT-KERNEL.md','docs/SOVEREIGN-KERNEL-API.md','release/checkpoint-12/RESEARCH-CAPABILITY-MATRIX.md','release/checkpoint-12/UI-RUNTIME-EVIDENCE-SHA256.txt'];
  for (const file of files) assert((await stat(path.join(root, file))).size > 200, `${file} is missing or empty`);
  return { files: files.length };
});

const requiredPassed = results.filter((item) => item.status === 'pass').length;
const reportBase = { schema: 'nolane.checkpoint-12.release-matrix.v1', checkpoint: 12, name: 'Sovereign Agent Kernel', startedAt, finishedAt: new Date().toISOString(), status: requiredPassed === results.length ? 'pass' : 'fail', requiredPassed, requiredTotal: results.length, source: await checkpoint12SourceFingerprint(root), gates: results };
const receiptSha256 = createHash('sha256').update(JSON.stringify(reportBase)).digest('hex');
const report = { ...reportBase, receiptSha256 };
await writeFile(path.join(outputDir, 'FULL-RELEASE-MATRIX.json'), `${JSON.stringify(report, null, 2)}\n`);
const markdown = [`# Checkpoint 12 Full Release Matrix`, '', `Status: **${report.status.toUpperCase()}**`, '', `Required gates: **${requiredPassed}/${results.length}**`, '', `Source fingerprint: \`${report.source.sha256}\``, '', `Matrix receipt: \`${receiptSha256}\``, '', '| Gate | Result | Duration | Evidence |', '|---|---:|---:|---|', ...results.map((item) => `| ${item.id} — ${item.label} | **${item.status.toUpperCase()}** | ${item.durationMs} ms | ${item.status === 'pass' ? `\`${JSON.stringify(item.evidence).slice(0, 180)}\`` : `\`${String(item.error).split('\n')[0]}\``} |`), ''];
await writeFile(path.join(outputDir, 'FULL-RELEASE-MATRIX.md'), markdown.join('\n'));
process.stdout.write(`${JSON.stringify({ status: report.status, required: `${requiredPassed}/${results.length}`, receiptSha256, output: 'release/checkpoint-12/FULL-RELEASE-MATRIX.json' })}\n`);
if (report.status !== 'pass') process.exitCode = 1;
