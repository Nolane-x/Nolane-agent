import { spawnSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

async function defaultProbeExecutable(name) {
  const result = spawnSync(String(name), ['--version'], { encoding: 'utf8', shell: false, timeout: 10_000, windowsHide: true });
  if (result.error || result.status !== 0) return { available: false, reason: result.error?.code ?? `exit-${result.status}` };
  return { available: true, version: String(result.stdout || result.stderr).trim().slice(0, 200) };
}

export class DependencyPreflightService {
  constructor({ projectRoot = process.cwd(), probeExecutable = defaultProbeExecutable } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.probeExecutable = probeExecutable;
  }

  async run({ dependencies } = {}) {
    if (!Array.isArray(dependencies) || dependencies.length === 0) throw new TypeError('dependencies are required');
    const checks = [];
    for (const dependency of dependencies) {
      if (!dependency?.id || !dependency.kind || typeof dependency.required !== 'boolean' || !dependency.remediation) throw new TypeError('Dependency id, kind, required and remediation are required');
      let probe;
      if (dependency.kind === 'executable') probe = await this.probeExecutable(String(dependency.name ?? dependency.id));
      else if (dependency.kind === 'file') {
        const absolute = path.resolve(this.projectRoot, String(dependency.path ?? ''));
        if (!absolute.startsWith(`${this.projectRoot}${path.sep}`) && absolute !== this.projectRoot) probe = { available: false, reason: 'outside-project-root' };
        else probe = await stat(absolute).then((entry) => ({ available: entry.isFile(), reason: entry.isFile() ? null : 'not-a-file' })).catch((error) => ({ available: false, reason: error.code ?? 'not-found' }));
      } else throw new TypeError(`Unsupported dependency kind: ${dependency.kind}`);
      checks.push(freeze({
        id: String(dependency.id), kind: dependency.kind, required: dependency.required, available: probe.available === true,
        version: probe.version ?? null, reason: probe.available === true ? null : String(probe.reason ?? 'unavailable'), remediation: String(dependency.remediation),
      }));
    }
    const missingRequired = checks.filter((item) => item.required && !item.available).map((item) => item.id);
    const missingOptional = checks.filter((item) => !item.required && !item.available).map((item) => item.id);
    const base = {
      schema: 'nolane.release.dependency-preflight.v1', ready: missingRequired.length === 0,
      degraded: missingOptional.length > 0, missingRequired, missingOptional, checks,
      offlineReproducible: checks.filter((item) => item.kind === 'file' && item.required).every((item) => item.available),
    };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
