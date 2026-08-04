import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function bounded(value, fallback, min, max, label) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return result;
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

export class RunActivityTracker {
  constructor({ duplicateLimit = 3, maxEntries = 1_000 } = {}) {
    this.duplicateLimit = bounded(duplicateLimit, 3, 1, 100, 'duplicateLimit');
    this.maxEntries = bounded(maxEntries, 1_000, 10, 100_000, 'maxEntries');
    this.progressEpoch = 0;
    this.actions = new Map();
    this.progressFingerprints = new Set();
    this.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
    this.filesRead = new Set();
    this.filesWritten = new Set();
    this.commandsRun = [];
    this.errors = [];
    this.stepResults = [];
  }

  assertActionAllowed(action) {
    const signature = canonicalSha256({ epoch: this.progressEpoch, tool: String(action?.tool ?? ''), input: action?.input ?? {} });
    const count = (this.actions.get(signature) ?? 0) + 1;
    this.actions.set(signature, count);
    if (count > this.duplicateLimit) {
      const error = new Error(`Repeated identical action exceeded limit ${this.duplicateLimit}`);
      error.code = 'DUPLICATE_ACTION_LOOP';
      error.details = Object.freeze({ signature, count, duplicateLimit: this.duplicateLimit, progressEpoch: this.progressEpoch });
      throw error;
    }
    return Object.freeze({ signature, count });
  }

  markProgress(value) {
    const progressSha256 = canonicalSha256(value ?? null);
    if (this.progressFingerprints.has(progressSha256)) return Object.freeze({ progressEpoch: this.progressEpoch, progressSha256, changed: false });
    this.progressFingerprints.add(progressSha256);
    this.progressEpoch += 1;
    this.actions.clear();
    return Object.freeze({ progressEpoch: this.progressEpoch, progressSha256, changed: true });
  }

  recordModel(usage = {}) {
    this.usage.promptTokens += Number(usage.promptTokens ?? usage.inputTokens ?? 0) || 0;
    this.usage.completionTokens += Number(usage.completionTokens ?? usage.outputTokens ?? 0) || 0;
    this.usage.totalTokens += Number(usage.totalTokens ?? 0) || 0;
    this.usage.costUsd = Number((this.usage.costUsd + (Number(usage.costUsd ?? usage.cost ?? 0) || 0)).toFixed(8));
  }

  recordTool({ tool, input = {}, status, output = {}, receiptSha256 = null } = {}) {
    const name = String(tool ?? '');
    const candidate = String(output.path ?? input.path ?? '');
    if (name === 'fs.read' && candidate) this.filesRead.add(candidate);
    if (['fs.write', 'fs.patch', 'fs.delete'].includes(name) && candidate) this.filesWritten.add(candidate);
    if (name === 'fs.patchSet') for (const file of Array.isArray(output.files) ? output.files : []) if (file?.path) this.filesWritten.add(String(file.path));
    if (name === 'fs.rename') {
      if (input.from) this.filesRead.add(String(input.from));
      if (input.to) this.filesWritten.add(String(input.to));
    }
    if (name === 'process.run') this.#push(this.commandsRun, { command: String(input.command ?? ''), args: Array.isArray(input.args) ? [...input.args] : [], exitCode: Number.isInteger(output.exitCode) ? output.exitCode : null });
    this.#push(this.stepResults, { id: receiptSha256 ?? canonicalSha256({ name, input, status }), tool: name, status: String(status ?? ''), result: output });
    if (status === 'pass') this.markProgress({ tool: name, output });
  }

  recordError(error, metadata = {}) { this.#push(this.errors, { message: String(error?.message ?? error), code: error?.code ?? null, ...structuredClone(metadata) }); }
  recordStep(step = {}) { this.#push(this.stepResults, structuredClone(step)); }

  #push(target, item) { target.push(item); if (target.length > this.maxEntries) target.splice(0, target.length - this.maxEntries); }

  snapshot() {
    return freeze({
      schema: 'forge.run-activity.v1',
      progressEpoch: this.progressEpoch,
      usage: { ...this.usage },
      filesRead: [...this.filesRead],
      filesWritten: [...this.filesWritten],
      commandsRun: structuredClone(this.commandsRun),
      errors: structuredClone(this.errors),
      stepResults: structuredClone(this.stepResults),
    });
  }
}
