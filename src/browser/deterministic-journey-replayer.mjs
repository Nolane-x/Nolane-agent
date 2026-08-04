import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { boundedNumber, optionalText, signed, text } from '../construction/construction-utils.mjs';
import { BrowserInjectionGuard } from './browser-injection-guard.mjs';

const ACTIONS = new Set(['navigate', 'click', 'type', 'select', 'drag', 'upload', 'keyboard', 'wait', 'assert', 'screenshot', 'checkpoint']);
function sha(value) { return createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex'); }
function originOf(value) { const url = new URL(String(value)); return url.origin; }
function normalizeScript(script) {
  if (!script || typeof script !== 'object') throw new TypeError('journey script is required');
  const actions = Array.isArray(script.actions) ? script.actions : [];
  if (!actions.length || actions.length > 500) throw new TypeError('journey actions must contain 1-500 items');
  return Object.freeze({ scriptId: text(script.scriptId, 'scriptId', 256), version: Math.floor(boundedNumber(script.version, 1, 1, 1_000_000, 'version')), seed: text(script.seed, 'seed', 256), actions: Object.freeze(actions.map((raw, index) => {
    const type = text(raw.type, `actions[${index}].type`, 64).toLowerCase();
    if (!ACTIONS.has(type)) throw new TypeError(`unsupported journey action: ${type}`);
    return Object.freeze({ type, url: optionalText(raw.url, 16_384) || null, target: optionalText(raw.target, 2_000) || null, value: optionalText(raw.value ?? raw.text, 20_000) || null, filename: optionalText(raw.filename, 512) || null, expectedState: optionalText(raw.expectedState, 512) || null, timeoutMs: boundedNumber(raw.timeoutMs, 15_000, 100, 120_000, `actions[${index}].timeoutMs`) });
  })) });
}
function stateView(result = {}, action, guard) {
  const screenings = [];
  for (const [source, content] of [['dom', result.dom], ['clipboard', result.clipboard], ['download', result.downloadedContent]]) if (content) screenings.push(guard.screen({ source, content, filename: result.downloadFilename, mimeType: result.downloadMimeType }));
  if (screenings.some((item) => !item.allowed)) throw Object.assign(new Error('browser content was blocked by injection or download policy'), { code: 'BROWSER_CONTENT_BLOCKED', screenings });
  let url = 'about:blank'; try { url = new URL(String(result.url ?? 'about:blank')); url.search = ''; url.hash = ''; url = url.toString(); } catch {}
  const domText = String(result.dom ?? '').replace(/\s+/g, ' ').trim();
  const accessibility = result.accessibility ?? {};
  const assertions = (Array.isArray(result.assertions) ? result.assertions : []).slice(0, 200).map((item, index) => ({ id: String(item?.id ?? `a-${index}`), passed: item?.passed === true }));
  const consoleEntries = (Array.isArray(result.console) ? result.console : []).slice(-200).map((item) => ({ level: String(item?.level ?? item?.type ?? 'log').toLowerCase(), fingerprint: sha(String(item?.message ?? item?.text ?? '')) }));
  const networkEntries = (Array.isArray(result.network) ? result.network : []).slice(-500).map((item) => { let origin = null; let pathname = null; try { const parsed = new URL(String(item?.url ?? '')); origin = parsed.origin; pathname = parsed.pathname; } catch {} return { status: Number(item?.status ?? 0), failed: item?.failed === true || Number(item?.status ?? 0) >= 400, origin, pathname }; });
  const artifacts = [];
  if (result.screenshot) artifacts.push({ kind: 'screenshot', sha256: sha(result.screenshot), bytes: Buffer.byteLength(result.screenshot) });
  if (result.video) artifacts.push({ kind: 'video', sha256: sha(result.video), bytes: Buffer.byteLength(result.video) });
  const semantic = { actionType: action.type, expectedState: action.expectedState, url, domSha256: sha(domText), domBytes: Buffer.byteLength(domText), accessibilitySha256: canonicalSha256(accessibility), console: { total: consoleEntries.length, errors: consoleEntries.filter((e) => ['error', 'assert'].includes(e.level)).length, fingerprints: consoleEntries.filter((e) => ['error', 'assert', 'warn', 'warning'].includes(e.level)) }, network: { total: networkEntries.length, failures: networkEntries.filter((e) => e.failed).length, entries: networkEntries.filter((e) => e.failed) }, assertions, artifacts };
  return Object.freeze({ ...semantic, fingerprint: canonicalSha256(semantic) });
}

export class DeterministicJourneyReplayer {
  constructor({ guard = new BrowserInjectionGuard() } = {}) { this.guard = guard; }
  async replay({ script, adapter, repeat = 2, allowedOrigins = [], reuseContext = false } = {}) {
    if (!adapter || typeof adapter.reset !== 'function' || typeof adapter.execute !== 'function') throw new TypeError('browser replay adapter with reset() and execute() is required');
    const normalized = normalizeScript(script); const allowed = new Set(allowedOrigins.map(String)); const runs = [];
    const repeatCount = Math.floor(boundedNumber(repeat, 2, 1, 10, 'repeat'));
    for (let runIndex = 0; runIndex < repeatCount; runIndex += 1) {
      await adapter.reset({ cookies: true, storage: true, serviceWorkers: true, cache: true, reuseContext: Boolean(reuseContext), seed: normalized.seed });
      const steps = [];
      for (const action of normalized.actions) {
        if (action.type === 'navigate' && allowed.size && !allowed.has(originOf(action.url))) throw new Error(`browser origin is not allowed: ${originOf(action.url)}`);
        const result = await adapter.execute(action, { runIndex, seed: normalized.seed });
        steps.push(stateView(result, action, this.guard));
      }
      const finalFingerprint = canonicalSha256(steps.map((step) => step.fingerprint));
      runs.push(Object.freeze({ runIndex, steps: Object.freeze(steps), finalFingerprint, artifacts: Object.freeze(steps.flatMap((step) => step.artifacts)) }));
    }
    const divergences = [];
    const baseline = runs[0];
    for (const run of runs.slice(1)) for (let index = 0; index < Math.max(baseline.steps.length, run.steps.length); index += 1) if (baseline.steps[index]?.fingerprint !== run.steps[index]?.fingerprint) divergences.push({ runIndex: run.runIndex, actionIndex: index, baselineFingerprint: baseline.steps[index]?.fingerprint ?? null, actualFingerprint: run.steps[index]?.fingerprint ?? null });
    const base = { schema: 'forge.deterministic-browser-replay.v1', scriptId: normalized.scriptId, scriptVersion: normalized.version, seedFingerprint: sha(normalized.seed), runs, flaky: divergences.length > 0, divergences, isolation: { sessionStateReset: true, storageReset: true, serviceWorkersReset: true, cacheReset: true }, claims: { visualCorrectnessProven: false, rawCookieStored: false, authorizationHeaderStored: false, passwordStored: false, executableDownloadRan: false, crossPlatformCertified: false } };
    return signed(base);
  }
}
