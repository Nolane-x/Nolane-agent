import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stableForensicId } from '../src/forensics/stable-id.mjs';
import { extractJavaScriptSymbols } from '../src/forensics/symbol-inventory/javascript-symbol-extractor.mjs';
import { inventoryRepositorySymbols } from '../src/forensics/symbol-inventory/repository-symbol-inventory.mjs';

const fixture = `export async function executeMission(input) {
  return input;
}

export class MissionController {
  async start(id) {
    return id;
  }
}

export const routeHandler = (request) => request;
router.post('/api/missions', routeHandler);
commands.register('mission.start', routeHandler);
bus.on('mission:completed', routeHandler);
const key = process.env.NOLANE_API_KEY;
const receipt = { schema: 'nolane.mission.receipt.v1' };
button.addEventListener('click', routeHandler);
`;

test('stable forensic IDs are deterministic and namespace separated', () => {
  assert.equal(stableForensicId('symbol', 'a'), stableForensicId('symbol', 'a'));
  assert.notEqual(stableForensicId('symbol', 'a'), stableForensicId('surface', 'a'));
  assert.match(stableForensicId('symbol', 'a'), /^symbol-[a-f0-9]{24}$/);
});

test('JavaScript extractor inventories symbols and operational surfaces', () => {
  const records = extractJavaScriptSymbols({
    sourceText: fixture,
    relativePath: 'src/mission/controller.mjs',
    fileSha256: 'a'.repeat(64),
  });
  const functionRecord = records.symbols.find((item) => item.name === 'executeMission');
  assert.equal(functionRecord.kind, 'function');
  assert.equal(functionRecord.exported, true);
  assert.equal(functionRecord.startLine, 1);
  assert.equal(functionRecord.endLine, 3);
  assert.ok(records.symbols.some((item) => item.kind === 'class' && item.name === 'MissionController'));
  assert.ok(records.symbols.some((item) => item.kind === 'method' && item.name === 'MissionController.start'));
  assert.ok(records.symbols.some((item) => item.kind === 'function' && item.name === 'routeHandler'));
  assert.deepEqual(new Set(records.surfaces.map((item) => item.kind)), new Set(['http-route', 'command', 'event', 'configuration-key', 'schema', 'ui-action']));
  assert.ok(records.surfaces.some((item) => item.kind === 'http-route' && item.value === 'POST /api/missions'));
  assert.ok(records.surfaces.some((item) => item.kind === 'command' && item.value === 'mission.start'));
  assert.ok(records.surfaces.some((item) => item.kind === 'configuration-key' && item.value === 'NOLANE_API_KEY'));
});

test('repository inventory reports syntax failures instead of silently skipping files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-symbols-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'ok.mjs'), fixture);
  await writeFile(path.join(root, 'src', 'bad.mjs'), 'export function broken( {\n');
  const report = await inventoryRepositorySymbols({ root, include: ['src'] });
  assert.equal(report.files.length, 2);
  assert.equal(report.parseFailures.length, 1);
  assert.match(report.parseFailures[0].relativePath, /bad\.mjs$/);
  assert.ok(report.symbols.length > 0);
});

test('repository inventory validates large file sets without argv overflow', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-symbols-large-'));
  const sourceRoot = path.join(root, 'src');
  await mkdir(sourceRoot, { recursive: true });
  const writes = [];
  for (let index = 0; index < 1800; index += 1) {
    const group = path.join(sourceRoot, `group-${String(index % 30).padStart(2, '0')}`);
    await mkdir(group, { recursive: true });
    writes.push(writeFile(path.join(group, `module-${String(index).padStart(4, '0')}-long-forensic-name.mjs`), `export const value${index} = ${index};\n`));
  }
  await Promise.all(writes);
  const report = await inventoryRepositorySymbols({ root, include: ['src'] });
  assert.equal(report.files.length, 1800);
  assert.equal(report.parseFailures.length, 0);
});
