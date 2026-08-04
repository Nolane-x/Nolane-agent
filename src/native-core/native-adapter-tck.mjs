import crypto from 'node:crypto';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const SENSITIVE_KEY = /(?:secret|password|token|api[_-]?key|credential(?:value)?|private[_-]?key)/i;
const REQUIRED_METHODS = ['probe', 'start', 'execute', 'stop'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const canonicalJson = (value) => JSON.stringify(canonical(value));
const clone = (value) => structuredClone(value);
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};

function assertNoEmbeddedSecrets(value, path = 'manifest') {
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (key !== 'credentialRefs' && SENSITIVE_KEY.test(key)) throw new Error(`embedded secret field is forbidden: ${path}.${key}`);
    if (entry && typeof entry === 'object') assertNoEmbeddedSecrets(entry, `${path}.${key}`);
  }
}

export class NativeAdapterTck {
  constructor({ allowedPermissions = [], credentialResolver = null, defaultTimeoutMs = 15_000, clock = () => Date.now() } = {}) {
    if (!Number.isInteger(defaultTimeoutMs) || defaultTimeoutMs < 1) throw new TypeError('defaultTimeoutMs must be a positive integer');
    this.allowedPermissions = new Set(allowedPermissions.map(String));
    this.credentialResolver = credentialResolver;
    this.defaultTimeoutMs = defaultTimeoutMs;
    this.clock = clock;
    this.records = new Map();
    this.receipts = [];
  }

  validateManifest(input) {
    const manifest = clone(input ?? {});
    if (manifest.schema !== 'nolane.native.adapter.v1') throw new Error('adapter manifest schema must be nolane.native.adapter.v1');
    if (!/^[a-z0-9][a-z0-9._-]{1,127}$/.test(String(manifest.id ?? ''))) throw new Error('adapter id is invalid');
    if (!/^[a-z][a-z0-9._-]{1,63}$/.test(String(manifest.kind ?? ''))) throw new Error('adapter kind is invalid');
    if (!SEMVER.test(String(manifest.version ?? ''))) throw new Error('adapter version must be a semantic version');
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('adapter capabilities must be non-empty strings');
    if (!Array.isArray(manifest.credentialRefs) || manifest.credentialRefs.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('adapter credentialRefs must be strings');
    if (!Array.isArray(manifest.permissions) || manifest.permissions.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('adapter permissions must be strings');
    assertNoEmbeddedSecrets(manifest);
    for (const permission of manifest.permissions) if (!this.allowedPermissions.has(permission)) throw new Error(`adapter permission is not allowed: ${permission}`);
    const normalized = {
      schema: manifest.schema,
      id: String(manifest.id),
      kind: String(manifest.kind),
      version: String(manifest.version),
      capabilities: [...new Set(manifest.capabilities.map(String))].sort(),
      credentialRefs: [...new Set(manifest.credentialRefs.map(String))].sort(),
      permissions: [...new Set(manifest.permissions.map(String))].sort(),
    };
    return freeze(normalized);
  }

  register({ manifest, adapter } = {}) {
    const validated = this.validateManifest(manifest);
    if (this.records.has(validated.id)) throw new Error(`adapter already registered: ${validated.id}`);
    if (!adapter || REQUIRED_METHODS.some((method) => typeof adapter[method] !== 'function')) throw new Error(`adapter must implement ${REQUIRED_METHODS.join(', ')}`);
    this.records.set(validated.id, { manifest: validated, adapter, state: 'registered', lastError: null, startedAt: null, stoppedAt: null });
    return this.describe(validated.id);
  }

  async probe(id) {
    const record = this.#require(id);
    const started = this.clock();
    try {
      const output = await this.#bounded(record.adapter.probe({ signal: new AbortController().signal }), this.defaultTimeoutMs, 'adapter probe timed out');
      if (output?.ready !== true) throw new Error(`adapter probe did not report ready: ${id}`);
      record.state = 'ready';
      record.lastError = null;
      const receipt = this.#append('probe', record, { durationMs: Math.max(0, this.clock() - started), outputSha256: sha256(canonicalJson(output)) });
      return freeze({ ready: true, receipt });
    } catch (error) {
      record.state = 'failed'; record.lastError = String(error?.message ?? error);
      this.#append('probe-failed', record, { errorCode: String(error?.code ?? 'ADAPTER_PROBE_FAILED'), errorSha256: sha256(record.lastError) });
      throw error;
    }
  }

  async start(id) {
    const record = this.#require(id);
    if (record.state === 'running') return this.describe(id);
    if (record.state === 'failed') throw new Error(`adapter is failed and must be re-registered: ${id}`);
    const started = this.clock();
    await this.#bounded(record.adapter.start({ signal: new AbortController().signal }), this.defaultTimeoutMs, 'adapter start timed out');
    record.state = 'running'; record.startedAt = this.clock(); record.lastError = null;
    this.#append('start', record, { durationMs: Math.max(0, this.clock() - started) });
    return this.describe(id);
  }

  async execute(id, input, { timeoutMs = this.defaultTimeoutMs, signal = null } = {}) {
    const record = this.#require(id);
    if (record.state !== 'running') throw new Error(`adapter must be running before execute: ${id}`);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new TypeError('timeoutMs must be a positive integer');
    const controller = new AbortController();
    const externalAbort = () => controller.abort(signal.reason ?? new Error('adapter execution cancelled'));
    if (signal?.aborted) externalAbort(); else signal?.addEventListener('abort', externalAbort, { once: true });
    const timeoutError = Object.assign(new Error(`adapter execution timed out after ${timeoutMs}ms`), { code: 'ADAPTER_TIMEOUT' });
    const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
    const started = this.clock();
    try {
      const credentials = {};
      for (const reference of record.manifest.credentialRefs) {
        if (typeof this.credentialResolver !== 'function') throw new Error(`credential resolver is unavailable for reference: ${reference}`);
        const resolved = await this.credentialResolver(reference, { adapterId: record.manifest.id });
        if (!resolved || typeof resolved.value !== 'string') throw new Error(`credential reference did not resolve: ${reference}`);
        credentials[reference] = resolved.value;
      }
      const output = await Promise.race([
        Promise.resolve(record.adapter.execute(freeze(clone(input)), Object.freeze({ signal: controller.signal, credentials: freeze(credentials), manifest: record.manifest }))),
        new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason ?? timeoutError), { once: true })),
      ]);
      const receipt = this.#append('execute', record, {
        durationMs: Math.max(0, this.clock() - started),
        inputSha256: sha256(canonicalJson(input)),
        outputSha256: sha256(canonicalJson(output)),
        credentialRefs: [...record.manifest.credentialRefs],
      });
      return freeze({ output: clone(output), receipt });
    } catch (error) {
      record.state = 'failed'; record.lastError = String(error?.message ?? error);
      try { await record.adapter.stop({ reason: error?.code ?? 'execute-failed' }); } catch {}
      record.stoppedAt = this.clock();
      this.#append('execute-failed', record, {
        durationMs: Math.max(0, this.clock() - started),
        inputSha256: sha256(canonicalJson(input)),
        errorCode: String(error?.code ?? 'ADAPTER_EXECUTION_FAILED'),
        errorSha256: sha256(record.lastError),
      });
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', externalAbort);
    }
  }

  async stop(id) {
    const record = this.#require(id);
    if (record.state === 'stopped') return this.describe(id);
    const started = this.clock();
    await this.#bounded(record.adapter.stop({ reason: 'operator-stop' }), this.defaultTimeoutMs, 'adapter stop timed out');
    record.state = 'stopped'; record.stoppedAt = this.clock(); record.lastError = null;
    this.#append('stop', record, { durationMs: Math.max(0, this.clock() - started) });
    return this.describe(id);
  }

  describe(id) {
    const record = this.#require(id);
    return freeze({
      id: record.manifest.id, kind: record.manifest.kind, version: record.manifest.version,
      capabilities: [...record.manifest.capabilities], credentialRefs: [...record.manifest.credentialRefs], permissions: [...record.manifest.permissions],
      state: record.state, lastErrorSha256: record.lastError ? sha256(record.lastError) : null,
      startedAt: record.startedAt, stoppedAt: record.stoppedAt,
    });
  }

  snapshot() {
    const adapters = [...this.records.keys()].sort().map((id) => this.describe(id));
    const base = {
      schema: 'nolane.native.adapter-tck.v1',
      adapters,
      receipts: this.receipts.map((entry) => clone(entry)),
      headSha256: this.receipts.at(-1)?.sha256 ?? null,
    };
    return freeze({ ...base, receiptSha256: sha256(canonicalJson(base)) });
  }

  #append(type, record, payload) {
    const event = {
      sequence: this.receipts.length + 1,
      type,
      adapterId: record.manifest.id,
      adapterKind: record.manifest.kind,
      adapterVersion: record.manifest.version,
      at: this.clock(),
      payload: canonical(payload),
      previousSha256: this.receipts.at(-1)?.sha256 ?? null,
    };
    event.sha256 = sha256(canonicalJson(event));
    const frozen = freeze(event); this.receipts.push(frozen); return frozen;
  }

  #require(id) {
    const record = this.records.get(String(id));
    if (!record) throw new Error(`unknown native adapter: ${id}`);
    return record;
  }

  async #bounded(promise, timeoutMs, message) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error(message), { code: 'ADAPTER_TIMEOUT' })), timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
}
