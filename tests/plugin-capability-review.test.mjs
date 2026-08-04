import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PluginScanner } from '../src/plugins/plugin-scanner.mjs';
import { PluginService } from '../src/plugins/plugin-service.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-plugin-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const market = path.join(root, 'market');
  const plugin = path.join(market, 'plugins', 'intel');
  await mkdir(path.join(market, '.claude-plugin'), { recursive: true });
  await mkdir(path.join(plugin, '.claude-plugin'), { recursive: true });
  await writeFile(path.join(market, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'review-market', owner: { name: 'Test' }, plugins: [{ name: 'intel', source: './plugins/intel' }] }));
  await writeFile(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'intel', version: '1.0.0' }));
  await writeFile(path.join(plugin, '.mcp.json'), JSON.stringify({ mcpServers: { docs: { command: 'node', args: ['server.mjs'], env: { DOCS_TOKEN: '${DOCS_TOKEN}', SAFE_MODE: '1' } } } }));
  await writeFile(path.join(plugin, '.lsp.json'), JSON.stringify({ typescript: { command: 'typescript-language-server', args: ['--stdio'], extensionToLanguage: { '.ts': 'typescript', '.tsx': 'typescriptreact' } } }));
  const service = new PluginService({ cacheRoot: path.join(root, 'cache'), scanner: new PluginScanner() });
  const marketplace = await service.addMarketplace({ source: market });
  const installed = await service.install({ marketplaceId: marketplace.id, pluginName: 'intel' });
  return { root, service, installed };
}

test('scanner inventories MCP and LSP server capabilities with bounded review metadata', async (t) => {
  const f = await fixture(t);
  assert.deepEqual([...f.installed.capabilities].sort(), ['lsp', 'mcp']);
  const review = await f.service.review(f.installed.id, { projectId: 'project-1' });
  assert.equal(review.capabilities.mcp.requiredApproval, true);
  assert.equal(review.capabilities.lsp.requiredApproval, true);
  assert.equal(review.capabilities.mcp.servers[0].id, 'docs');
  assert.deepEqual([...review.capabilities.mcp.servers[0].envNames].sort(), ['DOCS_TOKEN', 'SAFE_MODE']);
  assert.equal(JSON.stringify(review).includes('${DOCS_TOKEN}'), false);
  assert.equal(review.capabilities.lsp.servers[0].id, 'typescript');
  assert.deepEqual([...review.capabilities.lsp.servers[0].extensions].sort(), ['.ts', '.tsx']);
});

test('activation denies MCP and LSP until individual servers are explicitly approved', async (t) => {
  const f = await fixture(t);
  const denied = await f.service.activate(f.installed.id, { projectId: 'project-1', requestedCapabilities: ['mcp', 'lsp'] });
  assert.deepEqual(denied.grantedCapabilities, []);
  assert.equal(denied.deniedCapabilities.includes('mcp:review-required'), true);
  assert.equal(denied.deniedCapabilities.includes('lsp:review-required'), true);

  const granted = await f.service.activate(f.installed.id, {
    projectId: 'project-1', requestedCapabilities: ['mcp', 'lsp'],
    approvedServers: { mcp: ['docs'], lsp: ['typescript'] },
  });
  assert.deepEqual(granted.grantedCapabilities.sort(), ['lsp', 'mcp']);
  assert.deepEqual(granted.grantedServers, { mcp: ['docs'], lsp: ['typescript'] });
  const runtime = await f.service.runtimeCapabilitiesForProject('project-1');
  assert.equal(runtime.mcp[0].name, 'docs');
  assert.match(runtime.mcp[0].cwd, /objects/);
  assert.equal(runtime.mcp[0].env.DOCS_TOKEN, '${DOCS_TOKEN}');
  assert.equal(runtime.lsp[0].name, 'typescript');
});
