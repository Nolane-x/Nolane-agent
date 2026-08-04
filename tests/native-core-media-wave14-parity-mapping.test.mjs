import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('wave14 media contracts are verified with direct tests and production wiring', async () => {
  const catalog = await read('requirements/nolane-native-core-contracts.json');
  for (const id of ['NATIVE-MEDIA-PROVIDER-FRAMEWORK-WAVE14', 'NATIVE-GENERATED-MEDIA-PROJECTION', 'NATIVE-MEDIA-GENERATION-PROVIDER-TCK', 'NATIVE-VOICE-COMPOSER-STATE']) {
    const contract = catalog.contracts.find((entry) => entry.id === id);
    assert.equal(contract?.status, 'verified', id);
    assert.ok(contract.entrypoints.includes('src/native-core/media-core-wave14.mjs'), id);
    assert.ok(contract.tests.some((file) => file.includes('media-wave14')), id);
    assert.ok(contract.productionWiring.some((entry) => entry.path.includes('orchestration-service') && entry.contains === 'MediaCoreRuntimeWave14'), id);
  }
});

test('wave14 verifies local media framework while real provider plugins remain external', async () => {
  const conformance = await read('requirements/nolane-native-core-conformance.json');
  const mappings = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  for (const sourcePath of ['agent/image_gen_registry.py', 'agent/video_gen_provider.py', 'agent/transcription_registry.py', 'agent/tts_provider.py', 'tools/tts_streaming.py', 'tools/vision_tools.py']) assert.equal(mappings.get(sourcePath)?.contractId, 'NATIVE-MEDIA-PROVIDER-FRAMEWORK-WAVE14', sourcePath);
  assert.equal(mappings.get('apps/desktop/src/components/chat/generated-image-result.tsx')?.contractId, 'NATIVE-GENERATED-MEDIA-PROJECTION');
  assert.equal(mappings.get('tools/image_generation_tool.py')?.contractId, 'NATIVE-MEDIA-GENERATION-PROVIDER-TCK');
  assert.equal(mappings.get('apps/desktop/src/app/chat/composer/hooks/use-voice-recorder.ts')?.contractId, 'NATIVE-VOICE-COMPOSER-STATE');
  for (const sourcePath of ['plugins/image_gen/openai/__init__.py', 'plugins/video_gen/fal/__init__.py', 'plugins/google_meet/meet_bot.py']) assert.equal(mappings.get(sourcePath)?.status, 'external_gate', sourcePath);
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
