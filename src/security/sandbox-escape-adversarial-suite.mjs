import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { signed, text } from '../construction/construction-utils.mjs';

const SCENARIOS = new Set(['path-traversal', 'encoded-traversal', 'symlink-escape', 'junction-escape', 'mount-escape', 'child-process-escape', 'orphan-child', 'environment-leakage', 'socket-escape', 'credential-escape']);
function within(root, candidate) { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }

export class SandboxEscapeAdversarialSuite {
  async run({ root, scenarios = [...SCENARIOS], adapter } = {}) {
    const rootPath = await realpath(text(root, 'root', 4096));
    if (!adapter || typeof adapter.attempt !== 'function') throw new TypeError('adapter.attempt is required');
    const results = [];
    for (const raw of scenarios) {
      const scenario = text(raw, 'scenario', 128);
      if (!SCENARIOS.has(scenario)) throw new TypeError(`Unsupported sandbox scenario: ${scenario}`);
      let localBlocked = true;
      if (scenario === 'path-traversal') localBlocked = !within(rootPath, path.resolve(rootPath, '../outside'));
      if (scenario === 'encoded-traversal') localBlocked = decodeURIComponent('%2e%2e%2foutside').startsWith('../');
      if (scenario === 'symlink-escape' || scenario === 'junction-escape') {
        try { localBlocked = !within(rootPath, await realpath(path.join(rootPath, 'inside', 'link'))); } catch { localBlocked = true; }
      }
      const attempted = await adapter.attempt({ scenario, root: rootPath, destructive: false });
      if (!/^[a-f0-9]{64}$/i.test(String(attempted?.receiptSha256 ?? ''))) throw new TypeError('adapter receipt is required');
      results.push(Object.freeze({ scenario, blocked: localBlocked && attempted.blocked === true, escaped: attempted.escaped === true, adapterReceiptSha256: attempted.receiptSha256, details: String(attempted.details ?? '').slice(0, 512) }));
    }
    const failures = results.filter((result) => !result.blocked || result.escaped);
    return signed({ schema: 'forge.sandbox-escape-suite.v1', rootFingerprint: path.basename(rootPath), status: failures.length ? 'fail' : 'pass', results, failures: failures.map((item) => item.scenario), claims: { destructiveHostEscapeAttempted: false, crossPlatformCertificationComplete: false } });
  }
}
