import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const STATES = new Set(['unloaded', 'loading', 'active', 'idle', 'suspended', 'failed']);
const ALL_PROFILES = Object.freeze(['lite', 'balanced', 'performance']);

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}
function list(value, fallback = []) { return Object.freeze([...(value ?? fallback)].map(String)); }
function view(record) {
  return Object.freeze({
    id: record.id,
    state: record.state,
    essential: record.essential,
    dependencies: record.dependencies,
    profiles: record.profiles,
    reason: record.reason,
    activatedAt: record.activatedAt,
    lastUsedAt: record.lastUsedAt,
    receipt: record.receipt,
    error: record.error,
  });
}

export class RuntimeModuleManager {
  constructor({ profile = 'balanced', clock = () => Date.now(), eventSink = () => {} } = {}) {
    this.profile = required(profile, 'profile');
    this.clock = clock;
    this.eventSink = eventSink;
    this.modules = new Map();
    this.inflight = new Map();
    this.emergency = false;
  }

  register(descriptor = {}) {
    const id = required(descriptor.id, 'module id');
    if (this.modules.has(id)) throw new Error(`Module is already registered: ${id}`);
    if (typeof descriptor.activate !== 'function') throw new TypeError(`Module ${id} activate function is required`);
    const record = {
      id,
      essential: descriptor.essential === true,
      dependencies: list(descriptor.dependencies),
      profiles: list(descriptor.profiles, ALL_PROFILES),
      activateFn: descriptor.activate,
      instance: null,
      state: 'unloaded',
      reason: 'registered',
      activatedAt: null,
      lastUsedAt: null,
      receipt: null,
      error: null,
    };
    this.modules.set(id, record);
    this.#transition(record, 'unloaded', 'registered');
    return view(record);
  }

  get(id) {
    const record = this.modules.get(String(id));
    if (!record) throw new Error(`Unknown runtime module: ${id}`);
    return view(record);
  }

  async activate(id, context = {}, stack = []) {
    const key = String(id);
    const record = this.modules.get(key);
    if (!record) throw new Error(`Unknown runtime module: ${key}`);
    if (!record.profiles.includes(this.profile)) throw new Error(`Module ${key} is not available in profile ${this.profile}`);
    if (this.emergency && !record.essential) throw new Error(`Module ${key} activation is denied during emergency`);
    if (record.state === 'active' || record.state === 'idle') { record.state = 'active'; record.lastUsedAt = this.clock(); return record.instance; }
    if (record.state === 'suspended') {
      await record.instance?.resume?.(context);
      this.#transition(record, 'active', 'resumed');
      record.lastUsedAt = this.clock();
      return record.instance;
    }
    if (this.inflight.has(key)) return this.inflight.get(key);
    if (stack.includes(key)) throw new Error(`Runtime module dependency cycle: ${[...stack, key].join(' -> ')}`);
    const promise = this.#activate(record, context, [...stack, key]);
    this.inflight.set(key, promise);
    try { return await promise; } finally { this.inflight.delete(key); }
  }

  async #activate(record, context, stack) {
    this.#transition(record, 'loading', 'activation-requested');
    try {
      for (const dependency of record.dependencies) await this.activate(dependency, context, stack);
      const instance = await record.activateFn(Object.freeze({ manager: this, profile: this.profile, moduleId: record.id, ...context }));
      record.instance = instance ?? Object.freeze({});
      record.activatedAt = this.clock();
      record.lastUsedAt = record.activatedAt;
      record.error = null;
      this.#transition(record, 'active', 'activated');
      return record.instance;
    } catch (error) {
      record.error = String(error?.message ?? error);
      this.#transition(record, 'failed', 'activation-failed');
      throw error;
    }
  }

  markIdle(id, reason = 'idle') {
    const record = this.modules.get(String(id));
    if (!record) throw new Error(`Unknown runtime module: ${id}`);
    if (record.state === 'active') this.#transition(record, 'idle', reason);
    return view(record);
  }

  async suspend(id, reason = 'policy') {
    const record = this.modules.get(String(id));
    if (!record) throw new Error(`Unknown runtime module: ${id}`);
    if (!['active', 'idle'].includes(record.state)) return view(record);
    await record.instance?.suspend?.({ reason });
    this.#transition(record, 'suspended', reason);
    return view(record);
  }

  async unload(id, reason = 'unload') {
    const record = this.modules.get(String(id));
    if (!record) throw new Error(`Unknown runtime module: ${id}`);
    if (record.state === 'unloaded') return view(record);
    await record.instance?.close?.({ reason });
    record.instance = null;
    record.activatedAt = null;
    record.lastUsedAt = null;
    this.#transition(record, 'unloaded', reason);
    return view(record);
  }

  async applyPolicy(policy = {}) {
    this.emergency = policy.state === 'emergency';
    if (policy.unloadOptionalModules === true) {
      const optional = [...this.modules.values()].filter((record) => !record.essential && record.state !== 'unloaded');
      await Promise.allSettled(optional.map((record) => this.unload(record.id, 'resource-emergency')));
    } else if (policy.semanticIndexing === 'suspended' && this.modules.has('semantic-index')) {
      await this.suspend('semantic-index', 'resource-policy');
    }
    return this.snapshot();
  }

  snapshot() {
    return Object.freeze({ schema: 'forge.runtime-modules.v1', profile: this.profile, emergency: this.emergency, modules: Object.freeze([...this.modules.values()].map(view)) });
  }

  async close() {
    const records = [...this.modules.values()].reverse();
    for (const record of records) await this.unload(record.id, 'manager-close').catch(() => {});
  }

  #transition(record, state, reason) {
    if (!STATES.has(state)) throw new TypeError(`Unknown module state: ${state}`);
    const from = record.state;
    record.state = state;
    record.reason = String(reason ?? '');
    const event = {
      schema: 'forge.runtime-module-transition.v1',
      moduleId: record.id,
      from,
      to: state,
      reason: record.reason,
      profile: this.profile,
      at: this.clock(),
    };
    record.receipt = canonicalSha256(event);
    this.eventSink(Object.freeze({ ...event, receipt: record.receipt }));
  }
}
