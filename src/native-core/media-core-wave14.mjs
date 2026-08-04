import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteJson, readJson, redact, sha256 } from './native-runtime-utils.mjs';

const coded = (code, message) => Object.assign(new Error(message), { code });
const clone = (value) => structuredClone(value);
const MIME_EXT = new Map([['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['video/mp4', '.mp4'], ['audio/wav', '.wav'], ['audio/mpeg', '.mp3'], ['application/octet-stream', '.bin']]);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

class ContentAddressedMediaStoreWave14 {
  constructor({ root, maxAssetBytes, state, persist }) { this.root = path.resolve(root); this.maxAssetBytes = maxAssetBytes; this.state = state; this.persist = persist; }
  async put({ bytes, mime = 'application/octet-stream', provenance = {} } = {}) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
    if (!buffer.length) throw coded('MEDIA_EMPTY', 'Media asset is empty');
    if (buffer.length > this.maxAssetBytes) throw coded('MEDIA_BYTE_BUDGET', `Media asset exceeds ${this.maxAssetBytes} bytes`);
    const digest = sha256(buffer); const ext = MIME_EXT.get(String(mime)) ?? '.bin'; const file = path.join(this.root, 'assets', `${digest}${ext}`);
    await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, buffer, { flag: 'wx' }).catch((error) => { if (error?.code !== 'EEXIST') throw error; });
    const asset = { id: digest, sha256: digest, mime: String(mime), bytes: buffer.length, file, provenance: redact(clone(provenance)) };
    this.state.assets[digest] = asset; await this.persist(); return clone(asset);
  }
  get(id) { const asset = this.state.assets[String(id)] ?? null; return asset ? clone(asset) : null; }
  snapshot() { const assets = Object.values(this.state.assets).sort((a, b) => a.id.localeCompare(b.id)); return { assets: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0), headSha256: sha256(JSON.stringify(assets)) }; }
}

class ReferenceImageValidatorWave14 {
  constructor({ maxAssetBytes }) { this.maxAssetBytes = maxAssetBytes; }
  async validate({ file, mime } = {}) {
    if (!IMAGE_MIMES.has(String(mime))) throw coded('REFERENCE_IMAGE_MIME_DENIED', `Reference image MIME ${mime} is not allowed`);
    const info = await stat(file); if (!info.isFile()) throw coded('REFERENCE_IMAGE_INVALID', 'Reference image must be a regular file');
    if (info.size <= 0 || info.size > this.maxAssetBytes) throw coded('REFERENCE_IMAGE_BYTE_BUDGET', 'Reference image exceeds byte budget');
    const bytes = await readFile(file); return { file: path.resolve(file), mime: String(mime), bytes: bytes.length, sha256: sha256(bytes) };
  }
}

class MediaProviderRegistryWave14 {
  constructor() { this.entries = new Map(); }
  register({ id, kind, provider } = {}) { if (!id || !['image', 'video', 'transcription', 'tts'].includes(String(kind))) throw new TypeError('provider id and supported kind are required'); if (!provider || typeof provider !== 'object') throw new TypeError('provider is required'); const entry = { id: String(id), kind: String(kind), provider }; this.entries.set(entry.id, entry); return { id: entry.id, kind: entry.kind }; }
  require(id, kind) { const entry = this.entries.get(String(id)); if (!entry || (kind && entry.kind !== kind)) throw coded('MEDIA_PROVIDER_UNAVAILABLE', `Media provider ${id} is unavailable for ${kind}`); return entry; }
  byKind(kind) { return [...this.entries.values()].filter((entry) => entry.kind === kind); }
  snapshot() { return [...this.entries.values()].map(({ id, kind }) => ({ id, kind })).sort((a, b) => a.id.localeCompare(b.id)); }
}

export class MediaProviderTckWave14 {
  async verify(registry) {
    try {
      const kinds = [];
      const image = registry.byKind('image')[0]; if (!image || typeof image.provider.generate !== 'function') throw new Error('image provider missing generate'); const imageOut = await image.provider.generate({ prompt: 'fixture', credentialRef: 'ref:test' }); if (!Buffer.isBuffer(imageOut.bytes) || !String(imageOut.mime).startsWith('image/')) throw new Error('image provider output invalid'); kinds.push('image');
      const video = registry.byKind('video')[0]; if (!video || typeof video.provider.generate !== 'function') throw new Error('video provider missing generate'); const videoOut = await video.provider.generate({ prompt: 'fixture', credentialRef: 'ref:test' }); if (!Buffer.isBuffer(videoOut.bytes) || !String(videoOut.mime).startsWith('video/')) throw new Error('video provider output invalid'); kinds.push('video');
      const transcription = registry.byKind('transcription')[0]; if (!transcription || typeof transcription.provider.transcribe !== 'function') throw new Error('transcription provider missing transcribe'); const transcript = await transcription.provider.transcribe({ bytes: Buffer.from('audio'), credentialRef: 'ref:test' }); if (typeof transcript.text !== 'string') throw new Error('transcription output invalid'); kinds.push('transcription');
      const tts = registry.byKind('tts')[0]; if (!tts || typeof tts.provider.stream !== 'function') throw new Error('tts provider missing stream'); let bytes = 0; for await (const chunk of tts.provider.stream({ text: 'fixture', credentialRef: 'ref:test' })) bytes += Buffer.from(chunk).length; if (!bytes) throw new Error('tts stream empty'); kinds.push('tts');
      return { status: 'pass', kinds, receiptSha256: sha256(JSON.stringify({ kinds, image: imageOut.bytes.length, video: videoOut.bytes.length, transcript: transcript.text.length, tts: bytes })) };
    } catch (error) { return { status: 'fail', error: error.message, kinds: [] }; }
  }
}

class GeneratedMediaProjectionWave14 {
  constructor({ state }) { this.state = state; }
  begin({ requestId, kind } = {}) { if (!requestId) throw new TypeError('requestId is required'); const record = { requestId: String(requestId), kind: String(kind), state: 'pending', assetId: null, error: null }; this.state.projections[record.requestId] = record; return clone(record); }
  complete({ requestId, assetId } = {}) { const record = this.#require(requestId); record.state = 'complete'; record.assetId = String(assetId); record.error = null; return clone(record); }
  fail({ requestId, error } = {}) { const record = this.#require(requestId); record.state = 'failed'; record.error = String(error); return clone(record); }
  status(requestId) { return clone(this.#require(requestId)); }
  #require(id) { const record = this.state.projections[String(id)]; if (!record) throw coded('MEDIA_REQUEST_UNKNOWN', `Unknown media request ${id}`); return record; }
  snapshot() { return Object.values(this.state.projections).sort((a, b) => a.requestId.localeCompare(b.requestId)).map(clone); }
}

class VoiceLifecycleWave14 {
  constructor({ assets }) { this.assets = assets; this.state = 'idle'; this.sessionId = null; this.recordingChunks = []; this.playbackAssetId = null; }
  startRecording({ sessionId } = {}) { if (this.state !== 'idle') throw coded('VOICE_STATE_CONFLICT', `Cannot record from ${this.state}`); this.state = 'recording'; this.sessionId = String(sessionId); this.recordingChunks = []; return this.snapshot(); }
  appendRecording(bytes) { if (this.state !== 'recording') throw coded('VOICE_NOT_RECORDING', 'Recorder is not active'); this.recordingChunks.push(Buffer.from(bytes)); return { bytes: this.recordingChunks.reduce((sum, chunk) => sum + chunk.length, 0) }; }
  async stopRecording() { if (this.state !== 'recording') throw coded('VOICE_NOT_RECORDING', 'Recorder is not active'); const bytes = Buffer.concat(this.recordingChunks); const asset = await this.assets.put({ bytes, mime: 'application/octet-stream', provenance: { sessionId: this.sessionId, source: 'voice-recorder' } }); this.state = 'idle'; this.recordingChunks = []; return { asset, bytes: bytes.length }; }
  startPlayback(assetId) { if (this.state !== 'idle') throw coded('VOICE_STATE_CONFLICT', `Cannot play from ${this.state}`); this.state = 'playing'; this.playbackAssetId = String(assetId); return this.snapshot(); }
  bargeIn({ reason = 'barge-in' } = {}) { const wasPlaying = this.state === 'playing'; this.state = 'idle'; const assetId = this.playbackAssetId; this.playbackAssetId = null; return { playback: wasPlaying ? 'stopped' : 'idle', assetId, reason: String(reason) }; }
  snapshot() { return { state: this.state, sessionId: this.sessionId, playbackAssetId: this.playbackAssetId, recordingBytes: this.recordingChunks.reduce((sum, chunk) => sum + chunk.length, 0) }; }
}

export class VoiceActivityDetectorWave14 {
  constructor({ threshold = 0.1, hangoverFrames = 3 } = {}) { this.threshold = threshold; this.hangoverFrames = hangoverFrames; this.remaining = 0; }
  push(samples = []) { const peak = Math.max(0, ...samples.map((value) => Math.abs(Number(value) || 0))); if (peak >= this.threshold) this.remaining = this.hangoverFrames; else this.remaining = Math.max(0, this.remaining - 1); return { active: this.remaining > 0, peak, remaining: this.remaining }; }
}

export class MediaCoreRuntimeWave14 {
  constructor({ root, maxAssetBytes = 25 * 1024 * 1024, maxStreamBytes = 10 * 1024 * 1024 } = {}) { if (!root) throw new TypeError('root is required'); this.root = path.resolve(root); this.file = path.join(this.root, 'media-state.json'); this.maxAssetBytes = maxAssetBytes; this.maxStreamBytes = maxStreamBytes; this.state = { schema: 'nolane.media-core.wave14.v1', assets: {}, projections: {} }; this.providers = new MediaProviderRegistryWave14(); this.persist = this.persist.bind(this); this.assets = new ContentAddressedMediaStoreWave14({ root: this.root, maxAssetBytes, state: this.state, persist: this.persist }); this.references = new ReferenceImageValidatorWave14({ maxAssetBytes }); this.projection = new GeneratedMediaProjectionWave14({ state: this.state }); this.voice = new VoiceLifecycleWave14({ assets: this.assets }); }
  async open() { const stored = await readJson(this.file, null); if (stored) { if (stored.schema !== this.state.schema) throw coded('MEDIA_STORE_INVALID', 'Media state schema is invalid'); Object.assign(this.state, stored); } await mkdir(this.root, { recursive: true }); return this.snapshot(); }
  async persist() { await atomicWriteJson(this.file, this.state); }
  #abort(signal) { if (signal?.aborted) throw coded('MEDIA_CANCELLED', 'Media operation cancelled'); }
  async generate({ providerId, prompt, reference = null, credentialRef = null, signal } = {}) { this.#abort(signal); const entry = this.providers.require(providerId); if (!['image', 'video'].includes(entry.kind) || typeof entry.provider.generate !== 'function') throw coded('MEDIA_PROVIDER_KIND', 'Provider cannot generate media'); const requestId = sha256(`${entry.id}:${prompt}:${Date.now()}`).slice(0, 24); this.projection.begin({ requestId, kind: entry.kind }); try { const output = await entry.provider.generate({ prompt: String(prompt ?? ''), reference, credentialRef, signal }); this.#abort(signal); const asset = await this.assets.put({ bytes: output.bytes, mime: output.mime, provenance: { providerId: entry.id, kind: entry.kind, promptSha256: sha256(String(prompt ?? '')), referenceSha256: reference?.sha256 ?? null } }); this.projection.complete({ requestId, assetId: asset.id }); await this.persist(); return { requestId, asset, receiptSha256: sha256(JSON.stringify({ requestId, asset: asset.sha256, provider: entry.id })) }; } catch (error) { this.projection.fail({ requestId, error: error.code ?? error.message }); await this.persist(); throw error; } }
  async transcribe({ providerId, bytes, credentialRef = null, signal } = {}) { this.#abort(signal); const entry = this.providers.require(providerId, 'transcription'); const input = Buffer.from(bytes ?? []); if (input.length > this.maxAssetBytes) throw coded('MEDIA_BYTE_BUDGET', 'Transcription input exceeds byte budget'); const result = await entry.provider.transcribe({ bytes: input, credentialRef, signal }); this.#abort(signal); return { text: String(result.text ?? ''), inputSha256: sha256(input), receiptSha256: sha256(`${entry.id}:${sha256(input)}:${String(result.text ?? '')}`) }; }
  async speak({ providerId, text, credentialRef = null, signal } = {}) { this.#abort(signal); const entry = this.providers.require(providerId, 'tts'); const chunks = []; let total = 0; for await (const chunk of entry.provider.stream({ text: String(text ?? ''), credentialRef, signal })) { this.#abort(signal); const bytes = Buffer.from(chunk); total += bytes.length; if (total > this.maxStreamBytes) throw coded('MEDIA_STREAM_BUDGET', 'TTS stream exceeds byte budget'); chunks.push(bytes); } const asset = await this.assets.put({ bytes: Buffer.concat(chunks), mime: 'application/octet-stream', provenance: { providerId: entry.id, kind: 'tts', textSha256: sha256(String(text ?? '')) } }); return { asset, bytes: total, receiptSha256: sha256(`${entry.id}:${asset.sha256}:${total}`) }; }
  snapshot() { const snapshot = { schema: this.state.schema, assets: this.assets.snapshot(), providers: this.providers.snapshot(), projection: this.projection.snapshot(), voice: this.voice.snapshot() }; return { ...snapshot, receiptSha256: sha256(JSON.stringify(snapshot)) }; }
}
