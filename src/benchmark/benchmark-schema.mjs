function requiredString(value, name) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${name} is required`); return text; }
function bounded(value, fallback, min, max, name) { const out = value === undefined ? fallback : Number(value); if (!Number.isFinite(out) || out < min || out > max) throw new TypeError(`${name} must be between ${min} and ${max}`); return out; }
function freeze(value, seen = new WeakSet()) { if (!value || typeof value !== 'object' || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) freeze(child, seen); return Object.freeze(value); }
function sha(value, name) { const out = String(value ?? '').toLowerCase(); if (!/^[a-f0-9]{64}$/.test(out)) throw new TypeError(`${name} must be SHA-256`); return out; }

function normalizeBudgets(raw = {}) {
  return {
    timeoutMs: Math.max(1, Number(raw.timeoutMs ?? 900_000)),
    maxTokens: Math.max(0, Number(raw.maxTokens ?? 0)),
    maxCostUsd: Math.max(0, Number(raw.maxCostUsd ?? 0)),
    maxRssMb: Math.max(0, Number(raw.maxRssMb ?? 0)),
    maxProcesses: Math.max(0, Number(raw.maxProcesses ?? 0)),
  };
}

export function validateBenchmarkSuite(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('benchmark suite must be an object');
  const schemaVersion = Number(input.schemaVersion ?? 1);
  if (![1, 2].includes(schemaVersion)) throw new TypeError('unsupported benchmark suite version');
  const suite = { schemaVersion, id: requiredString(input.id, 'suite id'), version: Number(input.version ?? 1), title: requiredString(input.title, 'suite title'), tasks: [] };
  if (!Number.isInteger(suite.version) || suite.version < 1) throw new TypeError('unsupported benchmark suite version');
  if (schemaVersion === 2) {
    suite.distribution = {
      id: requiredString(input.distribution?.id, 'distribution id'),
      version: Number(input.distribution?.version ?? 1),
      fingerprint: sha(input.distribution?.fingerprint, 'distribution fingerprint'),
      public: input.distribution?.public === true,
    };
    suite.environment = {
      machineFingerprint: sha(input.environment?.machineFingerprint, 'environment machineFingerprint'),
      platform: requiredString(input.environment?.platform, 'environment platform'),
      runtime: requiredString(input.environment?.runtime, 'environment runtime'),
    };
  }
  if (!Array.isArray(input.tasks) || !input.tasks.length) throw new TypeError('benchmark suite requires tasks');
  const ids = new Set();
  for (const raw of input.tasks) {
    const id = requiredString(raw?.id, 'task id'); if (ids.has(id)) throw new TypeError(`duplicate benchmark task id: ${id}`); ids.add(id);
    const verify = Array.isArray(raw.verify) ? raw.verify.map((check) => ({ command: requiredString(check.command, 'verify command'), args: Array.isArray(check.args) ? check.args.map(String) : [], timeoutMs: Math.max(1, Number(check.timeoutMs ?? 60_000)) })) : [];
    const task = { id, version: Number(raw.version ?? 1), objective: requiredString(raw.objective, 'task objective'), fixture: raw.fixture ? String(raw.fixture) : null, verify, budgets: normalizeBudgets(raw.budgets) };
    if (schemaVersion === 2) {
      task.category = requiredString(raw.category, 'task category');
      task.split = requiredString(raw.split, 'task split');
      task.repository = {
        sourceId: requiredString(raw.repository?.sourceId, 'repository sourceId'),
        commit: sha(raw.repository?.commit, 'repository commit'),
        contentFingerprint: sha(raw.repository?.contentFingerprint, 'repository contentFingerprint'),
      };
      task.permissions = {
        network: requiredString(raw.permissions?.network, 'permissions.network'),
        filesystem: requiredString(raw.permissions?.filesystem, 'permissions.filesystem'),
        shell: requiredString(raw.permissions?.shell, 'permissions.shell'),
      };
      task.artifactPolicy = {
        retain: Array.isArray(raw.artifactPolicy?.retain) ? [...new Set(raw.artifactPolicy.retain.map(String))].sort() : [],
        maxBytes: bounded(raw.artifactPolicy?.maxBytes, 5_000_000, 1, 1_000_000_000, 'artifactPolicy.maxBytes'),
      };
    }
    suite.tasks.push(task);
  }
  return freeze(suite);
}
