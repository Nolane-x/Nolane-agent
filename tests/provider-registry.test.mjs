import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { CliProvider } from '../src/providers/cli-provider.mjs';
import { ProviderRegistry, createBuiltInCliProviders } from '../src/providers/provider-registry.mjs';

async function fakeCli(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'fake-cli.mjs');
  await writeFile(script, `
    if (process.argv.includes('--version')) { console.log('fake-code 1.2.3'); process.exit(0); }
    if (process.argv.includes('--sleep')) await new Promise(r => setTimeout(r, 2000));
    let input=''; for await (const chunk of process.stdin) input += chunk;
    console.log(JSON.stringify({ok:true,input,args:process.argv.slice(2)}));
  `);
  return { executable: process.execPath, script };
}

test('CliProvider detects versions and invokes through argv/stdin without a shell', async (t) => {
  const fake = await fakeCli(t);
  const provider = new CliProvider({
    id: 'fake',
    label: 'Fake CLI',
    executable: fake.executable,
    versionArgs: [fake.script, '--version'],
    baseArgs: [fake.script],
    promptMode: 'stdin',
    timeoutMs: 1000,
  });
  const detection = await provider.detect();
  assert.equal(detection.available, true);
  assert.equal(detection.version, '1.2.3');
  const response = await provider.invoke({ prompt: 'hello', args: ['--json'] });
  assert.equal(response.exitCode, 0);
  assert.equal(JSON.parse(response.stdout).input, 'hello');
  assert.deepEqual(JSON.parse(response.stdout).args.slice(-1), ['--json']);
  const completion = await provider.complete({ messages: [{ role: 'system', content: 'Follow ForgeOS.' }, { role: 'user', content: 'hello' }] });
  assert.match(completion.text, /hello/);
  assert.deepEqual(completion.toolCalls, []);
});

test('CliProvider enforces timeout and cancellation', async (t) => {
  const fake = await fakeCli(t);
  const provider = new CliProvider({ id: 'slow', label: 'Slow', executable: fake.executable, baseArgs: [fake.script, '--sleep'], timeoutMs: 30 });
  const timed = await provider.invoke({ prompt: '' });
  assert.equal(timed.timedOut, true);

  const controller = new AbortController();
  const aborting = provider.invoke({ prompt: '', timeoutMs: 1000, signal: controller.signal });
  controller.abort();
  const aborted = await aborting;
  assert.equal(aborted.aborted, true);
});

test('ProviderRegistry exposes secret-free public views and built-in official CLI definitions', async (t) => {
  const fake = await fakeCli(t);
  const registry = new ProviderRegistry();
  registry.register(new CliProvider({
    id: 'private-provider', label: 'Private', executable: fake.executable,
    versionArgs: [fake.script, '--version'], baseArgs: [fake.script],
    env: { API_KEY: 'super-secret' }, secretEnvKeys: ['API_KEY'],
  }));
  const detected = await registry.detectAll();
  assert.equal(detected[0].available, true);
  const publicJson = JSON.stringify(registry.publicView());
  assert.doesNotMatch(publicJson, /super-secret|API_KEY/);

  const builtIns = createBuiltInCliProviders();
  assert.deepEqual([...builtIns].map((item) => item.id), ['codex', 'claude', 'gemini', 'opencode']);
  assert.ok([...builtIns].every((item) => item.credentialOwner === 'official-cli'));
  assert.ok(builtIns.filter((item) => ['codex', 'claude', 'gemini'].includes(item.id)).every((item) => item.profile.capabilities.includes('governed-actions')));
  assert.ok(builtIns.find((item) => item.id === 'codex').baseArgs.includes('read-only'));
  assert.ok(builtIns.find((item) => item.id === 'gemini').baseArgs.includes('plan'));
});

test('CliProvider converts a read-only Forge action envelope into normalized governed tool calls', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-actions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'action-cli.mjs');
  await writeFile(script, `
    let input=''; for await (const chunk of process.stdin) input += chunk;
    if (!input.includes('FORGE_ACTION_PROTOCOL')) process.exit(4);
    console.log(JSON.stringify({result: JSON.stringify({text:'Need the file.',toolCalls:[{id:'read_1',name:'fs.read',arguments:{path:'README.md'}}]})}));
  `);
  const provider = new CliProvider({ id: 'action-cli', label: 'Action CLI', executable: process.execPath, baseArgs: [script], promptMode: 'stdin' });
  const completion = await provider.complete({
    messages: [{ role: 'user', content: 'Inspect README.' }],
    tools: [{ type: 'function', function: { name: 'fs.read', description: 'Read file', parameters: { type: 'object' } } }],
    cwd: root,
  });
  assert.equal(completion.text, 'Need the file.');
  assert.deepEqual(completion.toolCalls, [{ id: 'read_1', name: 'fs.read', arguments: { path: 'README.md' }, rawArguments: '{"path":"README.md"}' }]);
  assert.equal(completion.raw.args.at(-1), script);
});

test('ProviderRegistry supports safe replacement, removal, and explicit auth detection', async () => {
  const registry = new ProviderRegistry();
  registry.register({ id: 'dynamic', publicView: () => ({ id: 'dynamic', kind: 'test', capabilities: ['coding'] }), detect: async () => ({ id: 'dynamic', available: true }) });
  registry.setDetection('dynamic', { id: 'dynamic', available: true, authenticated: false, healthy: false, error: 'login-required' });
  assert.equal(registry.publicView()[0].authenticated, false);
  registry.upsert({ id: 'dynamic', publicView: () => ({ id: 'dynamic', kind: 'replacement', capabilities: ['coding'] }), detect: async () => ({ id: 'dynamic', available: true, authenticated: true, healthy: true }) });
  assert.equal(registry.get('dynamic').publicView().kind, 'replacement');
  const detections = await registry.detectAll();
  assert.equal(detections[0].authenticated, true);
  assert.equal(registry.remove('dynamic'), true);
  assert.equal(registry.remove('dynamic'), false);
  assert.throws(() => registry.get('dynamic'), /Unknown provider/);
});

test('CliProvider reports bounded estimated token usage instead of misleading zero tokens', async (t) => {
  const script = new URL('./fixtures/fake-cli.mjs', import.meta.url).pathname;
  const provider = new CliProvider({ id: 'estimated-cli', label: 'Estimated CLI', executable: process.execPath, baseArgs: [script, '--echo'], promptMode: 'stdin' });
  const result = await provider.complete({ messages: [{ role: 'user', content: 'Explain this repository and propose a safe patch.' }] });
  assert.equal(result.usage.estimated, true);
  assert.equal(result.usage.totalTokens > 0, true);
  assert.equal(result.usage.promptTokens > 0, true);
});
