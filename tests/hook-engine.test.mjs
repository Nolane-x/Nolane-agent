import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HookEngine } from '../src/hooks/hook-engine.mjs';
import { loadHookConfiguration } from '../src/hooks/hook-config-loader.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-hooks-'));
  t.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true })); });
  await mkdir(path.join(root, '.forge', 'hooks'), { recursive: true });
  const makeHook = async (name, source) => {
    const file = path.join(root, '.forge', 'hooks', `${name}.mjs`);
    await writeFile(file, source);
    return file;
  };
  return { root, makeHook };
}

function hook(id, script, overrides = {}) {
  return {
    id,
    events: ['BeforeTool'],
    command: process.execPath,
    args: [script],
    timeoutMs: 5_000,
    failureMode: 'closed',
    matcher: { toolNames: ['process.run'] },
    ...overrides,
  };
}

test('HookEngine applies safe rewrites, context, tool filtering, and immutable audit receipts', async (t) => {
  const { root, makeHook } = await fixture(t);
  const script = await makeHook('rewrite', `
    let input=''; for await (const chunk of process.stdin) input += chunk;
    const body = JSON.parse(input);
    process.stdout.write(JSON.stringify({
      decision: 'allow',
      rewrite: { arguments: { ...body.payload.arguments, timeoutMs: 5000 } },
      additionalContext: ['Run the focused test before the full suite.'],
      allowedTools: ['process.run', 'fs.read'],
      audit: { rule: 'bounded-test-command' }
    }));
  `);
  const engine = new HookEngine({
    projectRoot: root,
    hooks: [hook('rewrite', script)],
    allowedExecutables: [process.execPath],
  });
  const result = await engine.run('BeforeTool', {
    toolName: 'process.run',
    arguments: { command: 'node', argv: ['--test'], timeoutMs: 60_000 },
  }, { availableTools: ['process.run', 'fs.read', 'fs.write'] });

  assert.equal(result.decision, 'allow');
  assert.equal(result.payload.arguments.timeoutMs, 5_000);
  assert.deepEqual(result.additionalContext, ['Run the focused test before the full suite.']);
  assert.deepEqual(result.allowedTools, ['process.run', 'fs.read']);
  assert.equal(result.audit.length, 1);
  assert.equal(result.audit[0].hookId, 'rewrite');
  assert.match(result.audit[0].inputSha256, /^[a-f0-9]{64}$/);
  assert.match(result.audit[0].outputSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(result), true);
});

test('HookEngine is deny-first even when a later hook allows', async (t) => {
  const { root, makeHook } = await fixture(t);
  const deny = await makeHook('deny', `process.stdin.resume(); process.stdout.write(JSON.stringify({decision:'deny',reason:'secret egress blocked'}));`);
  const allow = await makeHook('allow', `process.stdin.resume(); process.stdout.write(JSON.stringify({decision:'allow'}));`);
  const engine = new HookEngine({ projectRoot: root, hooks: [hook('deny', deny), hook('allow', allow)], allowedExecutables: [process.execPath] });
  const result = await engine.run('BeforeTool', { toolName: 'process.run', arguments: {} }, { availableTools: ['process.run'] });
  assert.equal(result.decision, 'deny');
  assert.equal(result.reason, 'secret egress blocked');
  assert.equal(result.audit.length, 2);
});

test('HookEngine fails closed on timeout, oversized output, and executable escape', async (t) => {
  const { root, makeHook } = await fixture(t);
  const slow = await makeHook('slow', `setTimeout(() => process.stdout.write('{"decision":"allow"}'), 500);`);
  const huge = await makeHook('huge', `process.stdout.write(JSON.stringify({decision:'allow',additionalContext:'x'.repeat(10000)}));`);

  await assert.rejects(
    () => new HookEngine({ projectRoot: root, hooks: [hook('slow', slow, { timeoutMs: 20 })], allowedExecutables: [process.execPath] })
      .run('BeforeTool', { toolName: 'process.run', arguments: {} }),
    /HOOK_TIMEOUT/,
  );
  await assert.rejects(
    () => new HookEngine({ projectRoot: root, hooks: [hook('huge', huge)], allowedExecutables: [process.execPath], maxOutputBytes: 256 })
      .run('BeforeTool', { toolName: 'process.run', arguments: {} }),
    /HOOK_OUTPUT_LIMIT/,
  );
  assert.throws(
    () => new HookEngine({ projectRoot: root, hooks: [hook('escape', path.join(os.tmpdir(), 'outside.mjs'))], allowedExecutables: [process.execPath] }),
    /HOOK_PATH_OUTSIDE_PROJECT/,
  );
});

test('hook configuration loader merges layers deterministically and rejects duplicate ids', async (t) => {
  const { root, makeHook } = await fixture(t);
  const one = await makeHook('one', `process.stdin.resume(); process.stdout.write('{"decision":"allow"}');`);
  const two = await makeHook('two', `process.stdin.resume(); process.stdout.write('{"decision":"allow"}');`);
  const globalFile = path.join(root, 'global-hooks.json');
  const projectFile = path.join(root, '.forge', 'hooks.json');
  await writeFile(globalFile, JSON.stringify({ schema: 'forge.hooks.v1', hooks: [hook('global', one)] }));
  await writeFile(projectFile, JSON.stringify({ schema: 'forge.hooks.v1', hooks: [hook('project', two)] }));
  const loaded = await loadHookConfiguration({ projectRoot: root, files: [globalFile, projectFile] });
  assert.deepEqual(loaded.hooks.map((entry) => entry.id), ['global', 'project']);
  await writeFile(projectFile, JSON.stringify({ schema: 'forge.hooks.v1', hooks: [hook('global', two)] }));
  await assert.rejects(() => loadHookConfiguration({ projectRoot: root, files: [globalFile, projectFile] }), /HOOK_ID_DUPLICATE/);
});
