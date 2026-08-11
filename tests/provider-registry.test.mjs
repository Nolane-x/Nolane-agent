import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CliProvider } from '../src/providers/cli-provider.mjs';
import { ProviderRegistry, createBuiltInCliProviders } from '../src/providers/provider-registry.mjs';
import { CodexAppServerClient } from '../src/providers/codex-app-server.mjs';
import { OutcomeAwareProviderRouter } from '../src/providers/outcome-aware-router.mjs';

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

test('CliProvider classifies a non-zero CLI configuration failure without exposing diagnostics', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'config-cli.mjs');
  await writeFile(script, "console.error('Invalid configuration: apiKey=sk-private-test'); process.exit(7);\n");
  const provider = new CliProvider({ id: 'config-cli', label: 'Config CLI', executable: process.execPath, versionArgs: [script, '--version'] });
  const detection = await provider.detect();
  assert.equal(detection.available, false);
  assert.equal(detection.error, 'configuration-error');
  assert.equal(JSON.stringify(detection).includes('sk-private-test'), false);
});

test('CliProvider allows a slow CLI startup to report its version truthfully', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-slow-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'slow-version-cli.mjs');
  await writeFile(script, "setTimeout(() => console.log('slow-cli 1.2.3'), 5500);\n");
  const provider = new CliProvider({ id: 'slow-version', label: 'Slow version CLI', executable: process.execPath, versionArgs: [script], timeoutMs: 7_000 });
  const detection = await provider.detect();
  assert.equal(detection.available, true);
  assert.equal(detection.version, '1.2.3');
});

test('CliProvider discovers model ids through an explicit argv-only command', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-models-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'models-cli.mjs');
  await writeFile(script, `
    if (process.argv.includes('--models')) {
      console.log('provider/alpha');
      console.log('provider/beta');
      process.exit(0);
    }
    process.exit(2);
  `);
  const provider = new CliProvider({
    id: 'model-cli', label: 'Model CLI', executable: process.execPath,
    modelDiscoveryArgs: [script, '--models'], timeoutMs: 1000,
  });

  const result = await provider.discoverModels();
  assert.equal(result.status, 'discovered');
  assert.deepEqual(result.models.map((item) => item.id), ['provider/alpha', 'provider/beta']);
  assert.equal(result.models[0].source.type, 'cli-command');
  assert.equal(result.raw, undefined);
});

test('CliProvider exposes bounded compatibility catalog entries without claiming live discovery', async () => {
  const provider = new CliProvider({ id: 'catalog-cli', label: 'Catalog CLI', executable: process.execPath, modelCatalog: ['alpha', 'beta'] });
  const result = await provider.discoverModels();
  assert.equal(result.status, 'compatibility');
  assert.deepEqual(result.models.map((item) => item.id), ['alpha', 'beta']);
  assert.equal(result.models[0].source.type, 'cli-compatibility-catalog');
  assert.equal(result.models[0].source.live, false);
});

test('CliProvider resolves a Windows npm wrapper to its Node bundle without a shell', async (t) => {
  if (process.platform !== 'win32') return t.skip('Windows wrapper resolution is platform-specific');
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-cli-wrapper-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'node_modules', 'fake-cli', 'bundle.js');
  const wrapper = path.join(root, 'fake-cli.cmd');
  await mkdir(path.dirname(script), { recursive: true });
  await writeFile(script, "if (process.argv.includes('--models')) console.log('fake/provider-model');\n");
  await writeFile(wrapper, '@ECHO off\r\n"%dp0%\\node_modules\\fake-cli\\bundle.js" %*\r\n');
  const provider = new CliProvider({ id: 'wrapped-cli', label: 'Wrapped CLI', executable: wrapper, modelDiscoveryArgs: ['--models'] });
  const result = await provider.discoverModels();
  assert.equal(result.status, 'discovered');
  assert.deepEqual(result.models.map((item) => item.id), ['fake/provider-model']);
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
  assert.deepEqual([...builtIns].map((item) => item.id), ['codex', 'claude', 'gemini', 'opencode', 'github-copilot', 'qwen-code', 'continue-cli', 'cline', 'mistral-vibe-code', 'aider', 'goose']);
  assert.ok([...builtIns].every((item) => item.credentialOwner === 'official-cli'));
  assert.ok(builtIns.filter((item) => ['codex', 'claude', 'gemini'].includes(item.id)).every((item) => item.profile.capabilities.includes('governed-actions')));
  assert.ok(builtIns.find((item) => item.id === 'codex').baseArgs.includes('read-only'));
  assert.ok(builtIns.find((item) => item.id === 'codex').baseArgs.includes('--skip-git-repo-check'));
  assert.ok(builtIns.find((item) => item.id === 'gemini').baseArgs.includes('plan'));
  // Codex gets its live account catalogue from the authenticated App Server.
  // Claude and Gemini accept --model but do not expose a documented headless
  // account-model listing command, so no static list may masquerade as one.
  assert.ok(builtIns.filter((item) => ['codex', 'claude', 'gemini'].includes(item.id)).every((item) => item.modelCatalog.length === 0));
  assert.equal(builtIns.find((item) => item.id === 'codex').publicView().modelDiscovery.mode, 'unsupported');
  assert.equal(builtIns.find((item) => item.id === 'opencode').publicView().modelDiscovery.mode, 'command');
  assert.equal(builtIns.find((item) => item.id === 'opencode').publicView().modelDiscovery.live, true);
  assert.deepEqual(builtIns.find((item) => item.id === 'opencode').modelDiscoveryArgs, ['models', '--refresh']);
  const copilot = builtIns.find((item) => item.id === 'github-copilot');
  assert.equal(copilot.publicView().modelDiscovery.mode, 'unsupported');
  assert.ok(copilot.baseArgs.includes('plan'));
  assert.ok(copilot.baseArgs.includes('--sandbox'));
  assert.ok(copilot.baseArgs.includes('--no-remote'));
  const qwen = builtIns.find((item) => item.id === 'qwen-code');
  assert.equal(qwen.publicView().modelDiscovery.mode, 'unsupported');
  assert.ok(qwen.baseArgs.includes('json'));
  assert.equal(qwen.baseArgs.includes('--approval-mode'), false);
  assert.equal(qwen.publicView().executionSafety, 'external-plan-config-required');
  assert.equal(qwen.profile.capabilities.includes('governed-actions'), false);
  const continueCli = builtIns.find((item) => item.id === 'continue-cli');
  assert.equal(continueCli.modelFlag, null);
  assert.equal(continueCli.publicView().modelSelection.mode, 'cli-config');
  assert.ok(continueCli.baseArgs.includes('--exclude'));
  assert.ok(continueCli.baseArgs.includes('Write'));
  assert.ok(continueCli.baseArgs.includes('Edit'));
  assert.ok(continueCli.baseArgs.includes('Bash'));
  const cline = builtIns.find((item) => item.id === 'cline');
  assert.equal(cline.publicView().executionSafety, 'verified');
  assert.equal(cline.modelFlag, '-m');
  assert.ok(cline.baseArgs.includes('--plan'));
  assert.ok(cline.baseArgs.includes('--auto-approve'));
  assert.ok(cline.baseArgs.includes('false'));
  assert.ok(cline.profile.capabilities.includes('governed-actions'));
  const vibe = builtIns.find((item) => item.id === 'mistral-vibe-code');
  assert.equal(vibe.publicView().executionSafety, 'verified');
  assert.equal(vibe.modelFlag, null);
  assert.equal(vibe.publicView().modelSelection.mode, 'cli-config');
  assert.ok(vibe.baseArgs.includes('plan'));
  assert.equal(vibe.promptFlag, '--prompt');
  const aider = builtIns.find((item) => item.id === 'aider');
  assert.equal(aider.publicView().executionSafety, 'external-plan-config-required');
  assert.equal(aider.modelFlag, '--model');
  assert.ok(aider.baseArgs.includes('--no-auto-commits'));
  assert.equal(aider.profile.capabilities.includes('governed-actions'), false);
  const goose = builtIns.find((item) => item.id === 'goose');
  assert.equal(goose.publicView().executionSafety, 'external-plan-config-required');
  assert.equal(goose.modelFlag, null);
  assert.equal(goose.publicView().modelSelection.mode, 'cli-config');
  assert.ok(goose.baseArgs.includes('--no-session'));
  assert.ok(goose.baseArgs.includes('json'));
  assert.equal(goose.profile.capabilities.includes('governed-actions'), false);
});

test('CliProvider forwards an explicitly selected model before the prompt sentinel', async (t) => {
  const fake = await fakeCli(t);
  const provider = new CliProvider({
    id: 'model-cli',
    label: 'Model CLI',
    executable: fake.executable,
    baseArgs: [fake.script, '--json', '-'],
    promptMode: 'stdin',
    modelFlag: '--model',
  });
  const result = await provider.invoke({ prompt: 'hello', model: 'gpt-test' });
  const args = JSON.parse(result.stdout).args;
  assert.deepEqual(args.slice(0, 4), ['--json', '--model', 'gpt-test', '-']);
  assert.equal(args.at(-1), '-');
  const completion = await provider.complete({ messages: [{ role: 'user', content: 'hello' }], model: 'gpt-test' });
  assert.equal(completion.model, 'gpt-test');
});

test('Codex CLI and App Server keep distinct harness families and routing capabilities', async (t) => {
  const registry = new ProviderRegistry();
  const cli = createBuiltInCliProviders().find((item) => item.id === 'codex');
  registry.register(cli);
  const appServer = registry.register(new CodexAppServerClient({ executable: process.execPath, args: ['-e', ''] }));
  t.after(() => appServer.close());

  assert.equal(registry.get('codex').harnessFamily, 'codex-cli');
  assert.equal(registry.get('codex-app-server').harnessFamily, 'codex-app-server');

  // A shared account detection must not overwrite the CLI profile with the
  // App Server's structured-events/threads capability set.
  registry.setDetection('codex-app-server', { ...appServer.publicView(), available: true, authenticated: true, healthy: true });
  registry.setDetection('codex', { ...registry.get('codex').publicView(), available: true, authenticated: true, healthy: true });
  const router = new OutcomeAwareProviderRouter({ registry });
  const cliRank = router.rank({ providerId: 'codex', requiredCapabilities: ['coding', 'structured-output', 'governed-actions'] });
  assert.equal(cliRank[0].eligible, true);
  assert.ok(cliRank[0].profile.capabilities.has('structured-output'));
  assert.equal(router.select({ providerId: 'codex', requiredCapabilities: ['coding', 'structured-output', 'governed-actions'] }).id, 'codex');
  assert.equal(router.select({ providerId: 'codex-app-server', requiredCapabilities: ['coding', 'structured-events', 'threads'] }).id, 'codex-app-server');
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
  const script = fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url));
  const provider = new CliProvider({ id: 'estimated-cli', label: 'Estimated CLI', executable: process.execPath, baseArgs: [script, '--echo'], promptMode: 'stdin' });
  const result = await provider.complete({ messages: [{ role: 'user', content: 'Explain this repository and propose a safe patch.' }] });
  assert.equal(result.usage.estimated, true);
  assert.equal(result.usage.totalTokens > 0, true);
  assert.equal(result.usage.promptTokens > 0, true);
});
