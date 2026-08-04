import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString('base64'));
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function freeze(value) {
  if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
}
function receipt(base) { return freeze({ ...base, receiptSha256: sha256(canonical(base)) }); }
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function validSha(value, label) { const text = String(value ?? '').toLowerCase(); if (!/^[a-f0-9]{64}$/.test(text)) throw new TypeError(`${label} must be SHA-256`); return text; }
function normalizeRepository(repository = {}) {
  return freeze({ sourceId: required(repository.sourceId, 'repository sourceId'), commit: validSha(repository.commit, 'repository commit'), contentFingerprint: validSha(repository.contentFingerprint, 'repository contentFingerprint'), neverSeenBefore: repository.neverSeenBefore === true });
}
function publicTask(task = {}) {
  return freeze({ id: required(task.id, 'task id'), category: required(task.category, 'task category'), frontierCategory: required(task.frontierCategory, 'frontier category'), repository: normalizeRepository(task.repository), objective: required(task.objective, 'task objective'), input: structuredClone(task.input ?? {}) });
}
function normalizedTasks(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new TypeError('benchmark tasks are required');
  const ids = new Set();
  return [...tasks].map((task) => {
    const projected = publicTask(task); if (ids.has(projected.id)) throw new TypeError(`duplicate benchmark task: ${projected.id}`); ids.add(projected.id);
    return { projected, full: freeze({ ...projected, oracle: structuredClone(task.oracle ?? {}) }) };
  }).sort((a, b) => a.projected.id.localeCompare(b.projected.id));
}
function suiteBase({ id, version, tasks }, includeOracle) {
  const normalized = normalizedTasks(tasks);
  const projected = normalized.map((item) => includeOracle ? item.full : item.projected);
  return {
    schema: includeOracle ? 'forge.frontier-private-benchmark.v1' : 'forge.frontier-public-benchmark.v1',
    id: required(id, 'suite id'),
    version: Number(version),
    categories: [...new Set(projected.map((item) => item.category))].sort(),
    frontierCategories: [...new Set(projected.map((item) => item.frontierCategory))].sort(),
    tasks: projected,
  };
}
function assertKey(key) { if (!Buffer.isBuffer(key) || key.length !== 32) throw new TypeError('AES-256-GCM key must be 32 bytes'); return key; }
function assertIv(iv) { if (!Buffer.isBuffer(iv) || iv.length !== 12) throw new TypeError('AES-GCM IV must be 12 bytes'); return iv; }

export class ReproducibleBenchmarkPack {
  constructor({ contaminationFingerprints = [] } = {}) { this.contamination = new Set(contaminationFingerprints.map((value) => validSha(value, 'contamination fingerprint'))); }
  admitRepository(repository) {
    const normalized = normalizeRepository(repository);
    if (!normalized.neverSeenBefore) throw new Error('repository must be declared never-seen before admission');
    if (this.contamination.has(normalized.contentFingerprint)) throw new Error('repository contamination fingerprint is locked');
    return receipt({ schema: 'forge.benchmark-repository-admission.v1', status: 'admitted', repository: normalized, contaminationSetSha256: sha256([...this.contamination].sort().join('\n')) });
  }
  createPublicSuite(input = {}) {
    const base = suiteBase(input, false);
    for (const task of base.tasks) this.admitRepository(task.repository);
    return receipt(base);
  }
  sealPrivateSuite({ id, version, tasks, key, iv } = {}) {
    const secret = suiteBase({ id, version, tasks }, true);
    const publicSuite = suiteBase({ id, version, tasks }, false);
    for (const task of publicSuite.tasks) this.admitRepository(task.repository);
    const plaintext = Buffer.from(canonical(secret));
    const cipher = createCipheriv('aes-256-gcm', assertKey(key), assertIv(iv));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const base = {
      schema: 'forge.frontier-private-benchmark-envelope.v1', cipher: 'aes-256-gcm', id: publicSuite.id, version: publicSuite.version,
      tasks: publicSuite.tasks, categories: publicSuite.categories, frontierCategories: publicSuite.frontierCategories,
      iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64'), plaintextSha256: sha256(plaintext),
    };
    return receipt(base);
  }
  executorProjection(sealed = {}) {
    return freeze({ schema: 'forge.frontier-private-executor-projection.v1', id: String(sealed.id), version: Number(sealed.version), tasks: structuredClone(sealed.tasks ?? []), envelopeReceiptSha256: validSha(sealed.receiptSha256, 'envelope receipt') });
  }
  openPrivateSuite(sealed = {}, { key, role } = {}) {
    if (role !== 'verifier') throw new Error('private held-out oracle is available only to verifier role');
    const decipher = createDecipheriv('aes-256-gcm', assertKey(key), Buffer.from(String(sealed.iv), 'base64'));
    decipher.setAuthTag(Buffer.from(String(sealed.authTag), 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(String(sealed.ciphertext), 'base64')), decipher.final()]);
    if (sha256(plaintext) !== sealed.plaintextSha256) throw new Error('private benchmark plaintext integrity mismatch');
    return freeze(JSON.parse(plaintext.toString('utf8')));
  }
  recordRun({ suiteReceiptSha256, taskId, environment = {}, permissions = {}, budgets = {}, result = {} } = {}) {
    const verified = result.verified === true && validSha(result.verificationReceiptSha256, 'verification receipt');
    const artifacts = [...(result.artifacts ?? [])].map((value) => validSha(value, 'result artifact')).sort();
    return receipt({ schema: 'forge.frontier-benchmark-run.v1', status: verified ? 'verified' : 'failed', suiteReceiptSha256: validSha(suiteReceiptSha256, 'suite receipt'), taskId: required(taskId, 'taskId'), environment: { machineSha256: validSha(environment.machineSha256, 'machine fingerprint'), runtimeSha256: validSha(environment.runtimeSha256, 'runtime fingerprint') }, permissions: structuredClone(permissions), budgets: structuredClone(budgets), result: { verified: Boolean(result.verified), verificationReceiptSha256: result.verificationReceiptSha256, artifacts } });
  }
  compareSystems({ forgeRun, competitorRun } = {}) {
    if (!forgeRun?.receiptSha256 || !competitorRun?.receiptSha256) return receipt({ schema: 'forge.frontier-comparison-readiness.v1', status: 'external_gate', claimAllowed: false, reason: 'independent comparable competitor artifact is absent', forgeRunReceiptSha256: forgeRun?.receiptSha256 ?? null, competitorRunReceiptSha256: competitorRun?.receiptSha256 ?? null });
    return receipt({ schema: 'forge.frontier-comparison-readiness.v1', status: 'ready_for_independent_attestation', claimAllowed: false, reason: 'independent attestation is still required', forgeRunReceiptSha256: validSha(forgeRun.receiptSha256, 'Forge run receipt'), competitorRunReceiptSha256: validSha(competitorRun.receiptSha256, 'competitor run receipt') });
  }
}

export function createFrontierBenchmarkFixtures({ tasks, key, iv } = {}) {
  const pack = new ReproducibleBenchmarkPack();
  const publicSuite = pack.createPublicSuite({ id: 'forge-local-frontier-public', version: 1, tasks });
  const privateSuite = pack.sealPrivateSuite({ id: 'forge-local-frontier-private', version: 1, tasks, key, iv });
  const publicContent = `${JSON.stringify(publicSuite, null, 2)}\n`;
  const privateContent = `${JSON.stringify(privateSuite, null, 2)}\n`;
  return freeze({
    publicFile: { path: 'benchmark/frontier/public-suite.json', sha256: sha256(publicContent), content: publicContent },
    privateFile: { path: 'benchmark/frontier/private-held-out.enc.json', sha256: sha256(privateContent), content: privateContent },
  });
}
