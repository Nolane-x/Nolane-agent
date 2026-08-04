import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  'docs/RELEASE-5.0.0-alpha.5.md',
  'docs/LIMITATIONS-5.0.0-alpha.5.md',
  'docs/VERIFICATION-REPORT-5.0.0-alpha.5.md',
  'docs/FEATURE-COMPLETENESS-AUDIT-5.0.0-alpha.5.md',
  'docs/NOLANE-AGENT-5.0.0-ALPHA.5-STATUS.md',
];

test('alpha.5 release documents distinguish verified harness behavior from model and external claims', async () => {
  const texts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  for (const text of texts) {
    assert.match(text, /Nolane Agent 5\.0\.0-alpha\.5/);
    assert.doesNotMatch(text, /^# ForgeStudio|^# Forge Studio/m);
  }
  assert.match(texts[0], /AstCodemodEngine/);
  assert.match(texts[0], /FiniteDomainSmtAdapter/);
  assert.match(texts[0], /DatalogAdapter/);
  assert.match(texts[0], /AdaptationPolicyLearner/);
  assert.match(texts[0], /NolaneNativeCapabilityPack/);
  assert.match(texts[1], /No Nolane foundation model has been trained/);
  assert.match(texts[1], /6 open requirements/);
  assert.match(texts[1], /provider-real Windows dogfood remains pending/);
  assert.match(texts[1], /runtimeCertification=false/);
  assert.match(texts[2], /192 verified requirements/);
  assert.match(texts[2], /claimAllowed=false/);
  assert.match(texts[3], /production entrypoint/);
  assert.match(texts[4], /93 alpha\.4 gates retained/);
});
