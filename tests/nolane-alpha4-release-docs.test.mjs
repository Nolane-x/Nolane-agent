import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'docs/RELEASE-5.0.0-alpha.4.md',
  'docs/LIMITATIONS-5.0.0-alpha.4.md',
  'docs/VERIFICATION-REPORT-5.0.0-alpha.4.md',
  'docs/FEATURE-COMPLETENESS-AUDIT-5.0.0-alpha.4.md',
];

test('alpha.4 release documents describe verified adaptive foundations without model claims', async () => {
  const texts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  for (const text of texts) {
    assert.match(text, /Nolane Agent 5\.0\.0-alpha\.4/);
    assert.doesNotMatch(text, /^# ForgeStudio|^# Forge Studio/m);
  }
  assert.match(texts[0], /DistillationOrchestrator/);
  assert.match(texts[0], /RecursivePolicySidecar/);
  assert.match(texts[0], /SymbolicSolverCompiler/);
  assert.match(texts[0], /PlasticityPlane/);
  assert.match(texts[0], /CurriculumFactory/);
  assert.match(texts[1], /No Nolane foundation model has been trained/);
  assert.match(texts[1], /23 open requirements/);
  assert.match(texts[1], /docs\/feature-audit-5\.0\.0-alpha\.4\.json/);
  assert.match(texts[1], /docs\/REMAINING-GAPS-5\.0\.0-alpha\.4\.md/);
  assert.match(texts[2], /175 verified requirements/);
  assert.match(texts[3], /production entrypoint/);
});
