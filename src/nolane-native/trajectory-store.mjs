import { mkdir, appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const stable = (value) => { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])); return value; };
const containsPrivateReasoning = (value) => value && typeof value === 'object' && Object.entries(value).some(([key, child]) => /chain.?of.?thought|private.?reasoning|hidden.?reasoning/i.test(key) || containsPrivateReasoning(child));

export class NolaneTrajectoryStore {
  constructor({ file } = {}) { if (!file) throw new Error('trajectory file is required'); this.file = path.resolve(file); }
  async append(input) {
    if (!input?.verifier?.valid || !/^[a-f0-9]{64}$/.test(input.verifier.receiptSha256 ?? '')) throw new Error('verified trajectory step and verifier receipt are required');
    if (containsPrivateReasoning(input)) throw new Error('chain-of-thought and private reasoning must not be stored');
    if (!input.episodeId || !input.state || !input.action || !input.effect) throw new Error('trajectory requires episodeId, state, action and effect');
    const base = stable({ schema: 'nolane.agent.trajectory-step.v1', episodeId: input.episodeId, step: input.step ?? 0, state: input.state, action: input.action, effect: input.effect, verifier: input.verifier, provenance: input.provenance ?? {} });
    const record = Object.freeze({ ...base, recordSha256: sha256(JSON.stringify(base)) });
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return record;
  }
  async export({ outputFile }) {
    let lines = [];
    try { lines = (await readFile(this.file, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    lines.sort((a, b) => a.episodeId.localeCompare(b.episodeId) || a.step - b.step);
    const body = lines.map((line) => JSON.stringify(line)).join('\n') + (lines.length ? '\n' : '');
    await mkdir(path.dirname(path.resolve(outputFile)), { recursive: true });
    await writeFile(outputFile, body, { mode: 0o600 });
    return Object.freeze({ records: lines.length, outputSha256: sha256(body) });
  }
}
