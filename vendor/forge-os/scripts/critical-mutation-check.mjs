#!/usr/bin/env node
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(process.env.FORGEOS_MUTATION_ROOT ?? process.cwd());
const OUTPUT = path.resolve(process.env.FORGEOS_MUTATION_OUTPUT ?? 'dist/critical-mutation-report.json');
const MUTATIONS = Object.freeze([
  { id:'acl-gate-read', file:'src/server/tool-registry.mjs', from:"forge_skills_route:'write', forge_next_action:'write', forge_gate_run:'write'", to:"forge_skills_route:'read', forge_next_action:'read', forge_gate_run:'read'", tests:['tests/project-access-v3.test.mjs'] },
  { id:'embedded-mcp-system-fallback', file:'src/server/mcp.mjs', from:"        try { assertPrincipal(context.principal); }\n        catch { return response(id,toolFailure('authenticated_principal_required','An authenticated principal is required to call ForgeOS tools.',requestId)); }", to:'        // mutation: principal boundary removed', tests:['tests/mcp.test.mjs'] },
  { id:'evidence-descendant-leak', file:'src/evidence/providers.mjs', from:'    } finally {\n      await terminateProcessGroup(child);', to:'    } finally {\n      // mutation: descendant cleanup removed', tests:['tests/trusted-evidence.test.mjs'], platforms:['linux','darwin'] },
  { id:'mcp-timeout-no-abort', file:'src/federation/mcp-broker.mjs', from:'      controller.abort(error);', to:'      // mutation: timeout does not abort the underlying request', tests:['tests/mcp-broker.test.mjs'] },
  { id:'artifact-envelope-bypass', file:'src/core/artifacts.mjs', from:'  if (artifact.envelopeHash !== envelope) throw new Error(`Artifact envelope hash mismatch: ${artifact.id}`);', to:'  if (false && artifact.envelopeHash !== envelope) throw new Error(`Artifact envelope hash mismatch: ${artifact.id}`);', tests:['tests/artifact-trust-envelope.test.mjs'] },
  { id:'a2a-principal-drop', file:'src/server/a2a.mjs', from:'const data=await executeAction(action,context.forge,principal);', to:'const data=await executeAction(action,context.forge);', replaceAll:true, tests:['tests/a2a-v1-invariants.test.mjs'] },
  { id:'archive-success-descendant-leak', file:'scripts/archive-acceptance.mjs', from:"if(timedOut)result={code:124,signal:'TIMEOUT'};await terminate(child);closeSync(stdoutFd);", to:"if(timedOut)result={code:124,signal:'TIMEOUT'};closeSync(stdoutFd);", tests:['tests/release-runner-v06.test.mjs'], testNamePattern:'release command matrix reaps a successful command descendant before returning', platforms:['linux','darwin'] },
]);

function processGroupExists(child) {
  if (!child.pid) return false;
  if (process.platform === 'win32') return child.exitCode === null;
  try { process.kill(-child.pid, 0); return true; } catch { return false; }
}
async function terminate(child) {
  if (!processGroupExists(child)) return;
  const send = (signal) => { try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch {} };
  send('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (processGroupExists(child)) send('SIGKILL');
}
function runTests(cwd, tests, timeoutMs = 120_000, testNamePattern = null) {
  return new Promise((resolve) => {
    const args = ['--test', '--test-reporter=spec'];
    if (testNamePattern) args.push('--test-name-pattern', testNamePattern);
    args.push(...tests);
    const child = spawn(process.execPath, args, {
      cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = ''; let timedOut = false;
    const timer = setTimeout(async () => { timedOut = true; await terminate(child); }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('close', async (code, signal) => {
      clearTimeout(timer); await terminate(child);
      resolve({ code: timedOut ? 124 : (code ?? 1), signal: timedOut ? 'TIMEOUT' : signal, stdoutTail: stdout.slice(-4000), stderrTail: stderr.slice(-4000) });
    });
  });
}

const workspace = await mkdtemp(path.join(tmpdir(), 'forgeos-critical-mutations-'));
try {
  await cp(ROOT, workspace, { recursive:true, filter:(source) => !source.includes(`${path.sep}node_modules`) && !source.includes(`${path.sep}dist${path.sep}`) && !source.includes(`${path.sep}.git${path.sep}`) && !source.includes(`${path.sep}.forgeos-data${path.sep}`) });
  const nodeModules = path.join(ROOT, 'node_modules');
  await symlink(nodeModules, path.join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const results = [];
  for (const mutation of MUTATIONS) {
    if (mutation.platforms && !mutation.platforms.includes(process.platform)) {
      results.push({ id:mutation.id, killed:false, skipped:true, reason:`unsupported platform: ${process.platform}` });
      continue;
    }
    const file = path.join(workspace, mutation.file);
    const original = await readFile(file, 'utf8');
    const canonical = original.replace(/\r\n?/g, '\n');
    if (!canonical.includes(mutation.from)) {
      results.push({ id:mutation.id, killed:false, error:'mutation_target_missing' });
      continue;
    }
    const mutated = mutation.replaceAll ? canonical.replaceAll(mutation.from, mutation.to) : canonical.replace(mutation.from, mutation.to);
    await writeFile(file, mutated, 'utf8');
    const result = await runTests(workspace, mutation.tests, 120_000, mutation.testNamePattern ?? null);
    results.push({ id:mutation.id, killed:result.code !== 0, exitCode:result.code, signal:result.signal, tests:mutation.tests, stdoutTail:result.stdoutTail, stderrTail:result.stderrTail });
    await writeFile(file, original, 'utf8');
  }
  const executed=results.filter((item)=>!item.skipped);
  const report = { schemaVersion:1, total:results.length, executed:executed.length, killed:executed.filter((item) => item.killed).length, skipped:results.filter((item)=>item.skipped).map((item)=>({id:item.id,reason:item.reason})), survived:executed.filter((item) => !item.killed).map((item) => item.id), results };
  await mkdir(path.dirname(OUTPUT), { recursive:true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Critical mutation matrix: ${report.killed}/${report.executed} killed; ${report.skipped.length} skipped`);
  console.log(OUTPUT);
  if (report.survived.length) process.exitCode = 1;
} finally {
  await rm(workspace, { recursive:true, force:true });
}
