import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ui/sandbox-manager.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../ui/sandbox-manager.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');

test('Sandbox Manager exposes capability, resource meters, evidence, sample, close, and lazy navigation', () => {
  assert.match(source, /Local Resource Sandbox/);
  assert.match(source, /\/api\/local-resource-sandboxes\/capabilities/);
  assert.match(source, /\/api\/local-resource-sandboxes\?projectId=/);
  assert.match(source, /\/sample/);
  assert.match(source, /\/close/);
  assert.match(source, /cpuPercent/);
  assert.match(source, /memoryBytes/);
  assert.match(source, /processCount/);
  assert.match(source, /diskBytes/);
  assert.match(source, /receiptSha256/);
  assert.match(source, /Podman/);
  assert.match(source, /Windows Job Objects/);
  assert.match(source, /macOS sandbox/);
  assert.match(source, /violations/);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
  assert.match(css, /\.sandbox-manager/);
  assert.match(css, /\.sandbox-meter/);
  assert.match(css, /\.sandbox-violation/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(html, /id="sandbox-manager-button"/);
  assert.match(html, /id="sandbox-manager"/);
  assert.match(app, /sandbox:\['\/sandbox-manager\.js','initSandboxManager','sandbox-manager','sandbox-manager-button'/);
});
