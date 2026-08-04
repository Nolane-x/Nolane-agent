import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const HIDDEN_KEYS = new Set(['analysis', 'reasoning', 'hiddenReasoning', 'chainOfThought', 'chain_of_thought', 'scratchpad']);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function publicValue(value, depth = 0) {
  if (depth > 16) throw new Error('public value exceeds maximum depth');
  if (Array.isArray(value)) return value.map((entry) => publicValue(entry, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (HIDDEN_KEYS.has(key)) continue;
    output[key] = publicValue(entry, depth + 1);
  }
  return output;
}

function scrubText(value) {
  return String(value ?? '')
    .replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/```(?:analysis|reasoning)[\s\S]*?```/gi, '')
    .replace(/\u0000/g, '');
}

function cleanTitleText(value) {
  return scrubText(value)
    .replace(/[`*_>#~\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class AgentBehaviorRuntime {
  constructor({ maxMessageBytes = 64_000, titleMaxLength = 72, maxReplayEvents = 10_000, clock = () => Date.now() } = {}) {
    if (!Number.isInteger(maxMessageBytes) || maxMessageBytes < 1) throw new TypeError('maxMessageBytes must be a positive integer');
    if (!Number.isInteger(titleMaxLength) || titleMaxLength < 8) throw new TypeError('titleMaxLength must be at least 8');
    this.maxMessageBytes = maxMessageBytes;
    this.titleMaxLength = titleMaxLength;
    this.maxReplayEvents = maxReplayEvents;
    this.clock = clock;
    this.threads = new Map();
  }

  normalizeMessage(input = {}) {
    const id = String(input.id ?? '').trim();
    const role = String(input.role ?? '').trim();
    if (!id || !['system', 'user', 'assistant', 'tool'].includes(role)) throw new Error('message id and supported role are required');
    const content = scrubText(input.content ?? input.text ?? '');
    if (Buffer.byteLength(content) > this.maxMessageBytes) throw new Error('message exceeds byte budget');
    const portalTags = [...new Set((input.portalTags ?? []).map((entry) => String(entry).trim()).filter(Boolean))].sort();
    const attachments = (input.attachments ?? []).map((entry) => publicValue(entry)).filter((entry) => entry && typeof entry === 'object');
    const message = {
      schema: 'nolane.agent.public-message.v1',
      id,
      role,
      content,
      threadId: input.threadId == null ? null : String(input.threadId),
      portalTags,
      attachments,
      createdAt: this.clock(),
    };
    message.receiptSha256 = sha256(stable(message));
    return Object.freeze(message);
  }

  generateTitle(messages = []) {
    const source = messages.find((entry) => entry?.role === 'user') ?? messages[0] ?? {};
    const words = cleanTitleText(source.content ?? source.text ?? 'Untitled session').split(' ').filter(Boolean);
    let title = '';
    for (const word of words) {
      const next = title ? `${title} ${word}` : word;
      if (next.length > this.titleMaxLength) break;
      title = next;
    }
    return title || 'Untitled session';
  }

  classifyError(error) {
    const code = String(error?.code ?? '').toUpperCase();
    const status = Number(error?.statusCode ?? error?.status ?? 0);
    const text = `${error?.message ?? ''}`.toLowerCase();
    if (code === 'ABORT_ERR' || code === 'ERR_ABORTED' || text.includes('cancel')) return 'cancelled';
    if (status === 401 || status === 403 || text.includes('unauthorized') || text.includes('authentication')) return 'auth';
    if (status === 429 || text.includes('rate limit')) return 'rate_limit';
    if (code === 'ETIMEDOUT' || code === 'ERR_TIMEOUT' || status === 408 || text.includes('timed out') || text.includes('timeout')) return 'timeout';
    if ([500, 502, 503, 504].includes(status) || ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) return 'transient';
    return 'fatal';
  }

  async runOneShot({ requestId, input, execute, timeoutMs = 30_000, signal = null } = {}) {
    if (!requestId || typeof execute !== 'function') throw new Error('requestId and execute are required');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be a positive integer');
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason ?? 'cancelled');
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort('timeout'); }, timeoutMs);
    const startedAt = this.clock();
    try {
      const raw = await execute({ input: publicValue(input), signal: controller.signal });
      const output = publicValue(raw);
      const receipt = { schema: 'nolane.agent.one-shot-receipt.v1', requestId: String(requestId), startedAt, finishedAt: this.clock(), status: 'completed', inputSha256: sha256(stable(publicValue(input))), output };
      receipt.receiptSha256 = sha256(stable(receipt));
      return Object.freeze(receipt);
    } catch (error) {
      if (timedOut) throw Object.assign(new Error(`one-shot timed out after ${timeoutMs}ms`), { code: 'ERR_TIMEOUT', cause: error });
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
    }
  }

  async reviewEffects({ actorId, reviewerId, effects, reviewer } = {}) {
    if (!actorId || !reviewerId || actorId === reviewerId) throw new Error('independent reviewer is required');
    if (typeof reviewer !== 'function') throw new TypeError('reviewer is required');
    const normalizedEffects = (effects ?? []).map((effect) => ({ id: String(effect.id ?? ''), observed: effect.observed === true, receiptSha256: String(effect.receiptSha256 ?? '') }));
    if (normalizedEffects.length === 0 || normalizedEffects.some((effect) => !effect.id || !effect.observed || !/^[a-f0-9]{64}$/.test(effect.receiptSha256))) throw new Error('review requires observed effects with valid receipts');
    const raw = await reviewer({ effects: structuredClone(normalizedEffects) });
    const result = publicValue(raw);
    if (typeof result.accepted !== 'boolean') throw new Error('reviewer must return accepted boolean');
    const receipt = { schema: 'nolane.agent.background-review.v1', actorId: String(actorId), reviewerId: String(reviewerId), effects: normalizedEffects, accepted: result.accepted, evidenceIds: [...new Set((result.evidenceIds ?? []).map(String))].sort(), reviewedAt: this.clock() };
    receipt.receiptSha256 = sha256(stable(receipt));
    return Object.freeze(receipt);
  }

  cleanupReplay(events = []) {
    if (!Array.isArray(events) || events.length > this.maxReplayEvents) throw new Error('replay event budget exceeded');
    const sorted = [...events].sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0) || String(a.id ?? '').localeCompare(String(b.id ?? '')));
    const seen = new Set(); const accepted = []; const dropped = [];
    for (const raw of sorted) {
      const id = String(raw?.id ?? '');
      if (!id || seen.has(id)) { dropped.push({ id, reason: 'duplicate' }); continue; }
      if (raw.previousId && !seen.has(String(raw.previousId))) { dropped.push({ id, reason: 'orphan' }); continue; }
      const event = { id, sequence: Number(raw.sequence), previousId: raw.previousId == null ? null : String(raw.previousId), type: String(raw.type ?? 'event'), payload: publicValue(raw.payload ?? {}) };
      event.receiptSha256 = sha256(stable(event));
      seen.add(id); accepted.push(Object.freeze(event));
    }
    return Object.freeze({ schema: 'nolane.agent.replay-cleanup.v1', events: accepted, dropped: Object.freeze(dropped), receiptSha256: sha256(stable({ accepted, dropped })) });
  }

  threadOutput({ threadId, type, payload } = {}) {
    if (!threadId || !type) throw new Error('threadId and type are required');
    const previous = this.threads.get(String(threadId)) ?? null;
    const event = { schema: 'nolane.agent.thread-output.v1', threadId: String(threadId), sequence: (previous?.sequence ?? 0) + 1, type: String(type), payload: publicValue(payload ?? {}), previousSha256: previous?.receiptSha256 ?? null, createdAt: this.clock() };
    event.receiptSha256 = sha256(stable(event));
    const frozen = Object.freeze(event);
    this.threads.set(String(threadId), frozen);
    return frozen;
  }

  snapshot() {
    return Object.freeze({ schema: 'nolane.agent.agent-behavior-runtime-snapshot.v1', activeThreads: this.threads.size, maxMessageBytes: this.maxMessageBytes, maxReplayEvents: this.maxReplayEvents });
  }
}
