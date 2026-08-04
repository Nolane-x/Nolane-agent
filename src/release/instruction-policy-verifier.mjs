import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { InstructionDiscovery } from '../repository/instruction-discovery.mjs';
import { InstructionPolicyService } from '../repository/instruction-policy-service.mjs';

function assertVersion(value) { const version = String(value ?? '').trim(); if (!/^\d+\.\d+\.\d+$/.test(version)) throw new TypeError('Instruction policy verification requires a stable semantic version'); return version; }
async function put(root, relative, content) { const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content); }
async function exists(file) { try { await access(file); return true; } catch { return false; } }

export async function verifyInstructionPolicy({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = assertVersion(version);
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-policy-conformance-'));
  const globalRoot = await mkdtemp(path.join(os.tmpdir(), 'forge-instruction-global-conformance-'));
  try {
    await put(globalRoot, 'AGENTS.md', `---\nscope: global\nrules:\n  verify.required: true\n---\nGlobal\n`);
    await put(fixture, 'AGENTS.md', `---\nscope: repository\nimports: [docs/common.md]\nrules:\n  tests.required: true\n---\nRepository\n`);
    await put(fixture, 'docs/common.md', `---\nrules:\n  docs.required: true\n---\nImported\n`);
    await put(fixture, 'src/AGENTS.md', `---\nscope: directory\nrules:\n  tests.command: node --test\n---\nDirectory\n`);
    await put(fixture, '.cursor/rules/language.mdc', `---\nscope: language\nlanguages: [javascript]\nrules:\n  compiler.strict: true\n---\nLanguage\n`);
    await put(fixture, '.cursor/rules/a.mdc', `---\nscope: task\ntasks: [review]\npriority: 5\nrules:\n  edits.allowed: false\n---\nA\n`);
    await put(fixture, '.cursor/rules/b.mdc', `---\nscope: task\ntasks: [review]\npriority: 5\nrules:\n  edits.allowed: true\n---\nB\n`);
    await put(fixture, '.cursor/rules/invalid.mdc', `---\nscope: invalid-scope\npriority: 9999\n---\nInvalid\n`);
    await put(fixture, '.cursor/rules/cycle-a.mdc', `---\nimports: [cycle-b.md]\n---\nA\n`);
    await put(fixture, '.cursor/rules/cycle-b.md', `---\nimports: [cycle-a.mdc]\n---\nB\n`);
    const project = { id: 'instruction-policy-conformance', workspaceRoot: fixture };
    const service = new InstructionPolicyService({ discovery: new InstructionDiscovery(), store: { getProject: (id) => id === project.id ? project : null }, globalRoots: [globalRoot], version: releaseVersion });
    const snapshot = await service.resolve({ projectId: project.id, principalId: 'release-matrix', paths: ['src/app.mjs'], language: 'javascript', taskType: 'review', refresh: true });
    const failures = [];
    for (const scope of ['global', 'repository', 'directory', 'language', 'task']) if (!snapshot.selected.some((item) => item.scope === scope)) failures.push(`missing scope evidence: ${scope}`);
    if (snapshot.effectiveRules['docs.required']?.value !== true) failures.push('safe import did not contribute a rule');
    if (!snapshot.precedence?.edges?.some((item) => item.relation === 'imports')) failures.push('import precedence edge is missing');
    if (snapshot.conflicts.filter((item) => !item.resolved).length !== 1) failures.push('typed conflict was not detected');
    if (!snapshot.invalidRecords.some((item) => item.issues.some((problem) => problem.code === 'INSTRUCTION_SCOPE_INVALID'))) failures.push('invalid schema record is missing');
    if (!snapshot.omissions.some((item) => item.reason === 'import-cycle')) failures.push('import cycle was not rejected');
    if (!/^[a-f0-9]{64}$/.test(String(snapshot.receiptSha256 ?? ''))) failures.push('policy receipt is invalid');
    let sourceEvidence = [];
    const packageFile = path.join(root, 'package.json');
    if (await exists(packageFile)) {
      const packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
      if (String(packageJson.name ?? '').includes('forge-studio')) {
        sourceEvidence = ['src/repository/instruction-discovery.mjs', 'src/repository/instruction-policy-service.mjs', 'src/security/workspace-trust-gates.mjs', 'ui/instruction-governance-center.js', 'tests/instruction-policy-service.test.mjs'];
        for (const relative of sourceEvidence) if (!(await exists(path.join(root, relative)))) failures.push(`missing source evidence: ${relative}`);
      }
    }
    const reportBase = Object.freeze({
      schema: 'forge.studio.instruction-policy-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass',
      capabilities: Object.freeze(['global-scope', 'repository-scope', 'directory-scope', 'language-scope', 'task-scope', 'inheritance', 'deterministic-precedence', 'typed-conflict-detection', 'schema-validation', 'invalid-record-reporting', 'safe-imports']),
      failures: Object.freeze(failures), sourceEvidence: Object.freeze(sourceEvidence), snapshot,
    });
    const report = Object.freeze({ ...reportBase, receiptSha256: canonicalSha256(reportBase) });
    if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
    if (failures.length) { const error = new Error(`Instruction policy verification failed: ${failures.join('; ')}`); error.code = 'INSTRUCTION_POLICY_VERIFICATION_FAILED'; error.report = report; throw error; }
    return report;
  } finally { await Promise.all([rm(fixture, { recursive: true, force: true }), rm(globalRoot, { recursive: true, force: true })]); }
}
