import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};
const integer = (value, fallback, min, max, label) => {
  const number = value == null ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
};
const boundedText = (value, limit) => {
  const text = String(value ?? '');
  const bytes = Buffer.from(text);
  if (bytes.length <= limit) return { text, truncated: false, bytes: bytes.length };
  return { text: bytes.subarray(0, limit).toString('utf8'), truncated: true, bytes: bytes.length };
};

export class ToolExecutionFabric {
  constructor({ registry, clock = () => Date.now(), defaultTimeoutMs = 30_000, maxOutputBytes = 1_000_000 } = {}) {
    if (!registry?.require) throw new TypeError('ToolExecutionFabric requires an execution backend registry');
    this.registry = registry;
    this.clock = clock;
    this.defaultTimeoutMs = integer(defaultTimeoutMs, 30_000, 1, 24 * 60 * 60_000, 'defaultTimeoutMs');
    this.maxOutputBytes = integer(maxOutputBytes, 1_000_000, 256, 100_000_000, 'maxOutputBytes');
  }

  async execute({ backendId, action = {}, timeoutMs = this.defaultTimeoutMs, signal = null, policy = {} } = {}) {
    const backend = this.registry.require(backendId);
    const risk = String(policy.risk ?? 'medium');
    const reversible = policy.reversible !== false;
    const approvalRequired = !reversible || risk === 'high' || risk === 'critical';
    if (approvalRequired && policy.approved !== true) throw Object.assign(new Error(`Approval required for ${backendId}`), { code: 'APPROVAL_REQUIRED' });
    const timeout = integer(timeoutMs, this.defaultTimeoutMs, 1, 24 * 60 * 60_000, 'timeoutMs');
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal.reason ?? 'cancelled');
    if (signal?.aborted) onAbort(); else signal?.addEventListener?.('abort', onAbort, { once: true });
    const startedAt = Number(this.clock());
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort('timeout'); }, timeout);
    let raw = null; let thrown = null;
    try {
      raw = await backend.execute({ ...action, signal: controller.signal, backendId: backend.id, backendKind: backend.kind });
    } catch (error) {
      thrown = error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      await backend.cleanup?.({ action, reason: timedOut ? 'timeout' : controller.signal.aborted ? 'cancelled' : thrown ? 'error' : 'completed' });
    }
    const finishedAt = Number(this.clock());
    const cancelled = !timedOut && controller.signal.aborted;
    if (thrown && !timedOut && !cancelled) throw thrown;
    const stdout = boundedText(raw?.stdout, this.maxOutputBytes);
    const stderr = boundedText(raw?.stderr, this.maxOutputBytes);
    const exitCode = Number.isInteger(raw?.exitCode) ? raw.exitCode : timedOut || cancelled ? null : 0;
    const status = timedOut ? 'timeout' : cancelled ? 'cancelled' : exitCode === 0 ? 'pass' : 'fail';
    const errorClass = timedOut ? 'timeout' : cancelled ? 'cancelled' : exitCode === 0 ? null : String(raw?.errorClass ?? 'process-exit');
    const resourceReceipt = freeze({
      peakRssBytes: Math.max(0, Number(raw?.resourceUsage?.peakRssBytes ?? 0) || 0),
      cpuMs: Math.max(0, Number(raw?.resourceUsage?.cpuMs ?? 0) || 0),
      outputBytes: stdout.bytes + stderr.bytes,
      outputTruncated: stdout.truncated || stderr.truncated,
    });
    const approvalReceipt = freeze({ required: approvalRequired, approved: !approvalRequired || policy.approved === true, risk, reversible });
    const base = {
      schema: 'nolane.native-core.tool-execution-receipt.v1',
      backendId: backend.id,
      backendKind: backend.kind,
      status,
      errorClass,
      exitCode,
      startedAt,
      finishedAt,
      durationMs: Math.max(0, finishedAt - startedAt),
      stdout: stdout.text,
      stderr: stderr.text,
      output: raw,
      resourceReceipt,
      approvalReceipt,
      actionSha256: sha256(JSON.stringify(canonical(action))),
    };
    return freeze({ ...base, receiptSha256: sha256(JSON.stringify(canonical(base))) });
  }
}
