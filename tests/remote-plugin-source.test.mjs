import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { RemotePluginSourceResolver } from '../src/plugins/remote-plugin-source-resolver.mjs';
import { PluginScanner } from '../src/plugins/plugin-scanner.mjs';
import { PluginService } from '../src/plugins/plugin-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-remote-plugin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marketRepo = path.join(root, 'market-repo');
  const pluginRepo = path.join(root, 'plugin-repo');
  await mkdir(path.join(marketRepo, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(pluginRepo, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(pluginRepo, 'skills', 'remote-skill'), { recursive: true });
  await writeFile(path.join(marketRepo, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: 'remote-market',
    plugins: [{ name: 'remote-plugin', version: '1.0.0', source: { source: 'github', repo: 'owner/plugin-repo', ref: 'v1.0.0' } }],
  }));
  await writeFile(path.join(pluginRepo, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'remote-plugin', version: '1.0.0' }));
  await writeFile(path.join(pluginRepo, 'skills', 'remote-skill', 'SKILL.md'), '---\nname: remote-skill\ndescription: Remote skill\n---\n# Remote');

  const repositories = new Map([
    ['https://github.com/owner/market-repo.git', marketRepo],
    ['https://github.com/owner/plugin-repo.git', pluginRepo],
  ]);
  const calls = [];
  const runProcess = async ({ executable, args }) => {
    calls.push({ executable, args: [...args] });
    if (args[0] === 'clone') {
      const url = args.at(-2); const destination = args.at(-1);
      const source = repositories.get(url);
      if (!source) return { exitCode: 1, stdout: '', stderr: `unknown repo ${url}` };
      await cp(source, destination, { recursive: true });
      await mkdir(path.join(destination, '.git'), { recursive: true });
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    if (args.includes('rev-parse')) return { exitCode: 0, stdout: '0123456789abcdef0123456789abcdef01234567\n', stderr: '' };
    return { exitCode: 1, stdout: '', stderr: 'unexpected git command' };
  };
  const resolver = new RemotePluginSourceResolver({ cacheRoot: path.join(root, 'remote-cache'), runProcess });
  return { root, resolver, calls };
}

test('remote source resolver clones HTTPS Git sources into immutable commit-addressed cache without Git metadata', async (t) => {
  const f = await fixture(t);
  const resolved = await f.resolver.resolve({ source: 'github', repo: 'owner/plugin-repo', ref: 'v1.0.0' }, { kind: 'plugin' });
  assert.match(resolved, /objects[\\/][a-f0-9]{64}$/);
  assert.match(await readFile(path.join(resolved, 'skills', 'remote-skill', 'SKILL.md'), 'utf8'), /Remote skill/);
  await assert.rejects(() => readFile(path.join(resolved, '.git', 'HEAD')), /ENOENT/);
  const clone = f.calls.find((call) => call.args[0] === 'clone');
  assert.equal(clone.executable, 'git');
  assert.equal(clone.args.includes('--recurse-submodules'), false);
  assert.equal(clone.args.includes('--depth'), true);
});

test('PluginService accepts a remote marketplace and installs its remote plugin through the governed resolver', async (t) => {
  const f = await fixture(t);
  const service = new PluginService({
    cacheRoot: path.join(f.root, 'plugins'),
    scanner: new PluginScanner(),
    sourceResolver: (spec, context) => f.resolver.resolve(spec, context),
  });
  const market = await service.addMarketplace({ source: 'https://github.com/owner/market-repo' });
  const plugin = await service.install({ marketplaceId: market.id, pluginName: 'remote-plugin' });
  assert.equal(plugin.name, 'remote-plugin');
  assert.deepEqual(plugin.capabilities, ['skills']);
  assert.equal(plugin.immutable, true);
  assert.match(plugin.contentSha256, /^[a-f0-9]{64}$/);
});

test('remote source resolver rejects insecure URLs, embedded credentials, traversal subpaths, and unsafe refs before Git runs', async (t) => {
  const f = await fixture(t);
  await assert.rejects(() => f.resolver.resolve({ source: 'git', url: 'http://example.com/a.git' }), /HTTPS/i);
  await assert.rejects(() => f.resolver.resolve({ source: 'git', url: 'https://user:pass@example.com/a.git' }), /credentials/i);
  await assert.rejects(() => f.resolver.resolve({ source: 'github', repo: 'owner/plugin-repo', path: '../escape' }), /path/i);
  await assert.rejects(() => f.resolver.resolve({ source: 'github', repo: 'owner/plugin-repo', ref: '--upload-pack=evil' }), /ref/i);
  assert.equal(f.calls.length, 0);
});
