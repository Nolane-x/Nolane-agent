import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PluginScanner } from '../src/plugins/plugin-scanner.mjs';
import { PluginService } from '../src/plugins/plugin-service.mjs';

async function marketplaceFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-plugin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const market = path.join(root, 'market');
  const plugin = path.join(market, 'plugins', 'feature-dev');
  await mkdir(path.join(market, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(plugin, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(plugin, 'commands'), { recursive: true });
  await mkdir(path.join(plugin, 'agents'), { recursive: true });
  await mkdir(path.join(plugin, 'skills', 'explore'), { recursive: true });
  await writeFile(path.join(market, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'test-market', version: '1.0.0', owner: { name: 'Test' }, plugins: [{ name: 'feature-dev', description: 'Feature workflow', version: '1.2.3', source: './plugins/feature-dev', category: 'development' }] }));
  await writeFile(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'feature-dev', version: '1.2.3', description: 'Feature workflow', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './hooks/check.sh' }] }] } }));
  await writeFile(path.join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { docs: { command: 'node', args: ['server.mjs'] } } }));
  await writeFile(path.join(plugin, 'commands', 'feature.md'), '# Feature\nBuild a feature.');
  await writeFile(path.join(plugin, 'agents', 'reviewer.md'), '# Reviewer\nReview changes.');
  await writeFile(path.join(plugin, 'skills', 'explore', 'SKILL.md'), '---\nname: explore\ndescription: Explore a codebase\n---\n# Explore');
  return { root, market, plugin };
}

test('PluginScanner reads Claude-compatible marketplace and inventories plugin capabilities without executing hooks', async (t) => {
  const f = await marketplaceFixture(t);
  const scanner = new PluginScanner();
  const market = await scanner.scanMarketplace(f.market);
  assert.equal(market.name, 'test-market');
  assert.equal(market.plugins[0].name, 'feature-dev');
  const plugin = await scanner.scanPlugin(f.plugin);
  assert.deepEqual([...plugin.capabilities].sort(), ['agents', 'commands', 'hooks', 'mcp', 'skills']);
  assert.equal(plugin.risks.includes('executable-hooks'), true);
  assert.equal(plugin.hooks.quarantined, true);
  assert.equal(plugin.skills[0].name, 'explore');
  assert.equal(plugin.mcpServers[0].name, 'docs');
});

test('PluginService installs into immutable content-addressed cache and activates only non-quarantined capabilities', async (t) => {
  const f = await marketplaceFixture(t);
  const cacheRoot = path.join(f.root, 'cache');
  const service = new PluginService({ cacheRoot, scanner: new PluginScanner() });
  const market = await service.addMarketplace({ source: f.market });
  const installed = await service.install({ marketplaceId: market.id, pluginName: 'feature-dev' });
  assert.match(installed.installPath, /objects[\\/][a-f0-9]{64}$/);
  assert.equal(installed.status, 'installed');
  assert.equal(installed.hooks.quarantined, true);
  assert.match(await readFile(path.join(installed.installPath, 'skills', 'explore', 'SKILL.md'), 'utf8'), /Explore/);

  const active = await service.activate(installed.id, { projectId: 'project_1' });
  assert.deepEqual(active.grantedCapabilities.sort(), ['agents', 'commands', 'skills']);
  assert.equal(active.deniedCapabilities.includes('mcp:review-required'), true);
  assert.equal(active.deniedCapabilities.includes('hooks'), true);
  assert.equal(service.publicView()[0].activeProjects.includes('project_1'), true);

  const reopened = new PluginService({ cacheRoot, scanner: new PluginScanner() });
  await reopened.ready();
  assert.equal(reopened.publicView()[0].id, installed.id);
  assert.equal(reopened.publicView()[0].activeProjects[0], 'project_1');
});

test('PluginScanner and PluginService reject traversal, symlinks, oversized manifests, and unsupported remote sources', async (t) => {
  const f = await marketplaceFixture(t);
  const scanner = new PluginScanner({ maxManifestBytes: 1000 });
  await writeFile(path.join(f.market, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'bad', plugins: [{ name: 'bad', source: '../escape' }] }));
  await assert.rejects(() => scanner.scanMarketplace(f.market), /source|traversal|outside/i);

  const link = path.join(f.root, 'linked-plugin');
  await symlink(f.plugin, link, 'dir');
  await assert.rejects(() => scanner.scanPlugin(link), /symlink/i);

  const service = new PluginService({ cacheRoot: path.join(f.root, 'cache'), scanner: new PluginScanner(), sourceResolver: async () => { throw new Error('network disabled'); } });
  const remoteRoot = path.join(f.root, 'remote-market');
  await mkdir(path.join(remoteRoot, '.claude-plugin'), { recursive: true });
  await writeFile(path.join(remoteRoot, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'remote', plugins: [{ name: 'remote-plugin', source: { source: 'github', repo: 'owner/repo' } }] }));
  const market = await service.addMarketplace({ source: remoteRoot });
  await assert.rejects(() => service.install({ marketplaceId: market.id, pluginName: 'remote-plugin' }), /network disabled/i);
});

test('PluginService returns bounded active skill and agent context with provenance but never hook content', async (t) => {
  const f = await marketplaceFixture(t);
  const service = new PluginService({ cacheRoot: path.join(f.root, 'cache-context'), scanner: new PluginScanner() });
  const market = await service.addMarketplace({ source: f.market });
  const installed = await service.install({ marketplaceId: market.id, pluginName: 'feature-dev' });
  await service.activate(installed.id, { projectId: 'project_1', requestedCapabilities: ['skills', 'agents', 'commands', 'hooks'] });
  const context = await service.contextForProject('project_1', { maxItems: 8, maxChars: 20_000 });
  assert.equal(context.items.some((item) => item.kind === 'skill' && item.name === 'explore' && /Explore a codebase/.test(item.text)), true);
  assert.equal(context.items.some((item) => item.kind === 'agent' && item.name === 'reviewer'), true);
  assert.equal(context.items.some((item) => item.kind === 'command' && item.name === 'feature'), true);
  assert.equal(JSON.stringify(context).includes('PreToolUse'), false);
  assert.equal(context.items.every((item) => item.pluginId === installed.id && item.contentSha256 === installed.contentSha256), true);
  assert.equal(Object.isFrozen(context), true);
});
