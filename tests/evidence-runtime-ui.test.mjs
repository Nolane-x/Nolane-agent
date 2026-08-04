import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../ui/evidence-runtime-center.js', import.meta.url), 'utf8').catch(() => '');
const css = await readFile(new URL('../ui/evidence-runtime-center.css', import.meta.url), 'utf8').catch(() => '');
const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../ui/app.js', import.meta.url), 'utf8');

test('Evidence Runtime Center exposes graph, retrieval, packets, leases, and recovery without raw HTML injection', () => {
  for (const label of ['Graph','Retrieval','Context Packet','Leases','Recovery']) assert.match(source, new RegExp(label));
  for (const route of ['/api/evidence-runtime/graph','/api/evidence-runtime/retrieve','/api/evidence-runtime/packet','/api/evidence-runtime/audit','/api/evidence-runtime/recover']) assert.match(source, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(source, /textContent/);
  assert.match(source, /replaceChildren/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /localStorage.*token|sessionStorage.*token/i);
  assert.match(css, /\.evidence-runtime-center/);
  assert.match(css, /@media\s*\(max-width:/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /id="evidence-runtime-button"/);
  assert.match(html, /id="evidence-runtime-center"/);
  assert.match(app, /evidenceRuntime:\['\/evidence-runtime-center\.js','initEvidenceRuntimeCenter','evidence-runtime-center','evidence-runtime-button'/);
});
