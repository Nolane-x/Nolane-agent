import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
export class SourceClassifier {
  classify(filePath, { content = '' } = {}) {
    const p = String(filePath).replaceAll('\\', '/').replace(/^\.\//, ''); const name = path.posix.basename(p).toLowerCase(); const evidence = [];
    let kind = 'source';
    if (/(^|\/)(dist|build|out|coverage|\.next|target)\//i.test(p)) { kind = 'build-output'; evidence.push('build-output-directory'); }
    else if (/(^|\/)(vendor|vendored|third_party|node_modules)\//i.test(p)) { kind = 'vendored'; evidence.push('vendor-directory'); }
    else if (/(^|\/)(migrations?|database\/migrations?)\//i.test(p) || /^\d+[_-].*\.sql$/i.test(name)) { kind = 'migration'; evidence.push('migration-path'); }
    else if (/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock|go\.sum|poetry\.lock|gemfile\.lock)$/i.test(name)) { kind = 'lockfile'; evidence.push('lockfile-name'); }
    else if (/(^|\/)(tests?|__tests__|spec)\//i.test(p) || /(?:\.test|\.spec)\.[^.]+$/i.test(name)) { kind = 'test'; evidence.push('test-path-or-suffix'); }
    else if (/(^|\/)(generated|gen)\//i.test(p) || /@generated|generated file|do not edit/i.test(String(content).slice(0, 2048))) { kind = 'generated'; evidence.push('generated-marker'); }
    else if (/(^|\/)(config|configs)\//i.test(p) || /^(package\.json|tsconfig.*\.json|pyproject\.toml|go\.mod|cargo\.toml|pom\.xml|build\.gradle.*)$/i.test(name)) { kind = 'configuration'; evidence.push('configuration-path-or-name'); }
    else evidence.push('default-source');
    const editPolicy = ['generated', 'build-output', 'vendored', 'lockfile'].includes(kind) ? 'deny-normal-source-edit' : 'allow-governed-edit';
    const base = { schema: 'forge.source-classification.v1', path: p, kind, editPolicy, evidence: freeze(evidence), inferredSilently: false };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
