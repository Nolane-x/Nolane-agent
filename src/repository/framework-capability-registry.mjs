import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
const FRAMEWORKS = Object.freeze([{ id: 'express', packages: ['express'] }, { id: 'nextjs', packages: ['next'] }, { id: 'react', packages: ['react'] }, { id: 'fastapi', packages: ['fastapi'] }, { id: 'django', packages: ['django'] }, { id: 'spring', packages: ['spring-boot'] }]);
export class FrameworkCapabilityRegistry {
  probe({ packageJson = {}, files = [] } = {}) {
    const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
    const frameworks = FRAMEWORKS.map((item) => { const pkg = item.packages.find((name) => Object.hasOwn(deps, name)); return freeze({ id: item.id, status: pkg ? 'detected' : 'unavailable', provider: pkg ? 'manifest' : null, version: pkg ? String(deps[pkg]) : null, evidence: pkg ? freeze([`package.json:${pkg}`]) : freeze([]) }); });
    const base = { schema: 'forge.framework-capability-registry.v1', frameworks: freeze(frameworks), filesExamined: files.length, inferredSilently: false };
    return freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }
}
