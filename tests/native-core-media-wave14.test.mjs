import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  MediaCoreRuntimeWave14,
  MediaProviderTckWave14,
  VoiceActivityDetectorWave14,
} from '../src/native-core/media-core-wave14.mjs';

async function temp(t) { const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-wave14-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }

const providers = {
  image: { async generate({ prompt }) { return { mime: 'image/png', bytes: Buffer.from(`img:${prompt}`) }; } },
  video: { async generate({ prompt }) { return { mime: 'video/mp4', bytes: Buffer.from(`video:${prompt}`) }; } },
  transcription: { async transcribe({ bytes }) { return { text: `heard:${bytes.length}` }; } },
  tts: { async *stream({ text }) { yield Buffer.from(text.slice(0, 2)); yield Buffer.from(text.slice(2)); } },
};

test('content-addressed media store validates reference images and persists deterministic assets', async (t) => {
  const root = await temp(t); const runtime = new MediaCoreRuntimeWave14({ root, maxAssetBytes: 1024 }); await runtime.open();
  const source = path.join(root, 'reference.png'); await writeFile(source, Buffer.from('png-data'));
  const reference = await runtime.references.validate({ file: source, mime: 'image/png' });
  assert.equal(reference.mime, 'image/png');
  const stored = await runtime.assets.put({ bytes: Buffer.from('png-data'), mime: 'image/png', provenance: { source: 'test' } });
  assert.equal(stored.sha256, reference.sha256);
  assert.deepEqual(await readFile(stored.file), Buffer.from('png-data'));
  await assert.rejects(() => runtime.references.validate({ file: source, mime: 'text/plain' }), (error) => error.code === 'REFERENCE_IMAGE_MIME_DENIED');
});

test('provider TCK verifies image, video, transcription and streaming TTS without credentials in receipts', async (t) => {
  const root = await temp(t); const runtime = new MediaCoreRuntimeWave14({ root }); await runtime.open();
  for (const [kind, provider] of Object.entries(providers)) runtime.providers.register({ id: `${kind}-fixture`, kind, provider });
  const report = await new MediaProviderTckWave14().verify(runtime.providers);
  assert.equal(report.status, 'pass');
  assert.equal(report.kinds.length, 4);
  assert.equal(JSON.stringify(report).includes('secret'), false);
});

test('media generation and transcription are content-addressed, bounded and cancellable', async (t) => {
  const root = await temp(t); const runtime = new MediaCoreRuntimeWave14({ root, maxAssetBytes: 1024 }); await runtime.open();
  runtime.providers.register({ id: 'image', kind: 'image', provider: providers.image });
  runtime.providers.register({ id: 'transcribe', kind: 'transcription', provider: providers.transcription });
  const generated = await runtime.generate({ providerId: 'image', prompt: 'cat', credentialRef: 'vault:image' });
  assert.equal(generated.asset.mime, 'image/png');
  assert.equal(JSON.stringify(generated).includes('vault:image'), false);
  assert.equal((await runtime.transcribe({ providerId: 'transcribe', bytes: Buffer.from('abc') })).text, 'heard:3');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => runtime.generate({ providerId: 'image', prompt: 'cancel', signal: controller.signal }), (error) => error.code === 'MEDIA_CANCELLED');
});

test('streaming TTS, recorder and barge-in lifecycle stop playback deterministically', async (t) => {
  const root = await temp(t); const runtime = new MediaCoreRuntimeWave14({ root, maxStreamBytes: 64 }); await runtime.open(); runtime.providers.register({ id: 'tts', kind: 'tts', provider: providers.tts });
  runtime.voice.startRecording({ sessionId: 's1' }); runtime.voice.appendRecording(Buffer.from('audio')); const recording = await runtime.voice.stopRecording(); assert.equal(recording.bytes, 5);
  const tts = await runtime.speak({ providerId: 'tts', text: 'hello' }); assert.equal(tts.bytes, 5); runtime.voice.startPlayback(tts.asset.id); const stopped = runtime.voice.bargeIn({ reason: 'user-speech' }); assert.equal(stopped.playback, 'stopped');
  assert.equal(runtime.voice.snapshot().state, 'idle');
});

test('voice activity detector uses explicit threshold and generated media state survives restart', async (t) => {
  const detector = new VoiceActivityDetectorWave14({ threshold: 0.4, hangoverFrames: 2 });
  assert.equal(detector.push([0, 0.8]).active, true); assert.equal(detector.push([0, 0]).active, true); assert.equal(detector.push([0, 0]).active, false);
  const root = await temp(t); const runtime = new MediaCoreRuntimeWave14({ root }); await runtime.open(); runtime.projection.begin({ requestId: 'r1', kind: 'image' }); runtime.projection.complete({ requestId: 'r1', assetId: 'asset-1' }); await runtime.persist();
  const reopened = new MediaCoreRuntimeWave14({ root }); await reopened.open(); assert.equal(reopened.projection.status('r1').state, 'complete');
});
