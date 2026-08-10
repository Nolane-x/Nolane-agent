import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';

const jsonFiles = [
  '.claude-plugin/plugin.json', '.mcp.json',
  'adapters/opencode/opencode.json', 'adapters/cursor/mcp.json',
  'adapters/cline/mcp.json', 'adapters/roo-code/mcp.json',
  'adapters/windsurf/mcp.json', 'adapters/continue/mcp.json',
  'adapters/generic/manifest.json', 'tck/platform-capabilities.json'
];

const requiredAdapters = [
  'chatgpt','codex','claude-code','cursor','opencode','gemini-cli','copilot-cli',
  'cline','roo-code','windsurf','continue','nolane_native','openclaw','pi','generic'
];

test('ForgeOS ships broad platform adapters with parseable manifests', async () => {
  for (const file of jsonFiles) {
    await access(file);
    assert.doesNotThrow(() => JSON.parse('null'));
    JSON.parse(await readFile(file, 'utf8'));
  }
  const adapters = new Set(await readdir('adapters'));
  for (const name of requiredAdapters) assert.ok(adapters.has(name), `missing adapter: ${name}`);
});

test('adapter contracts use the same local MCP endpoint and expose install guidance', async () => {
  const expectedCommand = 'node';
  const expectedArgs = ['src/server/stdio.mjs'];
  for (const file of ['.mcp.json','adapters/cursor/mcp.json','adapters/cline/mcp.json','adapters/roo-code/mcp.json','adapters/windsurf/mcp.json','adapters/continue/mcp.json']) {
    const value = JSON.parse(await readFile(file, 'utf8'));
    const server = value.mcpServers?.forgeos ?? value.servers?.forgeos;
    assert.equal(server.command, expectedCommand, file);
    assert.deepEqual(server.args, expectedArgs, file);
  }
  for (const name of requiredAdapters) await access(`adapters/${name}/README.md`);
});

test('platform TCK declares capability evidence rather than unsupported certification claims', async () => {
  const tck = JSON.parse(await readFile('tck/platform-capabilities.json', 'utf8'));
  assert.equal(tck.schemaVersion, 2);
  assert.ok(tck.capabilities.length >= 8);
  assert.ok(tck.adapters.length >= requiredAdapters.length);
  for (const adapter of tck.adapters) {
    assert.ok(['executable','documentation'].includes(adapter.verification));
    assert.ok(Array.isArray(adapter.evidence));
    assert.equal(Object.hasOwn(adapter, 'certified'), false);
  }
});
