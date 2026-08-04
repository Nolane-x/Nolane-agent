import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'local-semantic-embedding',
  'semantic-ranking-and-bounded-preview',
  'principal-bound-authenticated-api',
  'dependency-traversal',
  'cycle-detection',
  'bounded-topology',
  'observable-control-center',
  'item-level-feature-audit',
  'full-release-matrix-gate',
]);

const REQUIRED_FILES = Object.freeze([
  'src/repository/embedding-provider.mjs',
  'src/repository/secure-semantic-index.mjs',
  'src/repository/hybrid-code-reranker.mjs',
  'src/repository/semantic-dependency-intelligence-service.mjs',
  'src/server/routes.mjs',
  'src/server/http-server.mjs',
  'src/app.mjs',
  'ui/codebase-knowledge-center.js',
  'ui/codebase-knowledge-center.css',
  'tests/semantic-dependency-intelligence-service.test.mjs',
  'tests/semantic-dependency-http-api.test.mjs',
  'tests/semantic-dependency-app-wiring.test.mjs',
  'tests/semantic-dependency-center-ui.test.mjs',
  'tests/semantic-dependency-release-gate.test.mjs',
  'scripts/audit-feature-checklist.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}

function requirePattern(text, pattern, label, failures) {
  if (!pattern.test(text)) failures.push(`missing ${label}`);
}

export async function verifySemanticDependencyIntelligence({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');

  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const embedding = contents.get('src/repository/embedding-provider.mjs') ?? '';
  const semanticIndex = contents.get('src/repository/secure-semantic-index.mjs') ?? '';
  const reranker = contents.get('src/repository/hybrid-code-reranker.mjs') ?? '';
  const service = contents.get('src/repository/semantic-dependency-intelligence-service.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/codebase-knowledge-center.js') ?? '';
  const css = contents.get('ui/codebase-knowledge-center.css') ?? '';
  const audit = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(embedding, /FeatureHashEmbeddingProvider[\s\S]*forge-feature-hash-v1[\s\S]*sha256/, 'local feature-hash embedding provider', failures);
  requirePattern(semanticIndex, /scoreBreakdown/, 'semantic index exposes score breakdown', failures);
  requirePattern(reranker, /scoreBreakdown:[\s\S]*semantic[\s\S]*lexical[\s\S]*path[\s\S]*symbol[\s\S]*graph/, 'hybrid semantic score breakdown', failures);
  requirePattern(service, /query\.length > 4_000[\s\S]*preview:[\s\S]*slice\(0, 1_200\)/, 'bounded semantic query and preview', failures);
  requirePattern(service, /#context\([\s\S]*authenticated principal[\s\S]*Unknown project/, 'fail-closed principal and project scope', failures);
  requirePattern(routes, /\/api\/semantic-dependency\/search[\s\S]*req\.forgePrincipal\?\.subject[\s\S]*\/api\/semantic-dependency\/graph/, 'principal-bound authenticated API', failures);
  requirePattern(service, /DIRECTIONS[\s\S]*queue[\s\S]*neighbors[\s\S]*distance/, 'bounded incoming and outgoing traversal', failures);
  requirePattern(service, /stronglyConnectedComponents[\s\S]*cycles/, 'cycle detection', failures);
  requirePattern(service, /depth, 3, 0, 8[\s\S]*limit, 500, 1, 500[\s\S]*slice\(0, 2_000\)/, 'bounded topology projection', failures);
  requirePattern(app, /new SemanticDependencyIntelligenceService[\s\S]*semanticDependency/, 'application wiring', failures);
  for (const label of ['Semantic Search', 'Dependencies']) requirePattern(ui, new RegExp(label), `Control Center tab ${label}`, failures);
  requirePattern(ui, /scoreBreakdown[\s\S]*receiptSha256[\s\S]*knowledge-dependency-lanes/, 'observable search and dependency evidence', failures);
  requirePattern(css, /knowledge-semantic-result[\s\S]*knowledge-dependency-node[\s\S]*prefers-reduced-motion/, 'semantic dependency responsive UI', failures);
  requirePattern(audit, /sections:\s*\[4\][\s\S]*Trình xem dependency graph[\s\S]*semanticDependency/, 'dependency graph item-level audit rule', failures);
  requirePattern(audit, /sections:\s*\[13\][\s\S]*Hỗ trợ semantic search[\s\S]*semanticDependency/, 'semantic search item-level audit rule', failures);
  requirePattern(matrix, /id:\s*'local-semantic-dependency-intelligence'/, 'full release matrix gate', failures);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.semantic-dependency-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    requiredCapabilities: REQUIRED_CAPABILITIES,
    failures: Object.freeze(failures),
    fileDigests: Object.freeze(fileDigests),
  };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) {
    const target = path.resolve(outputFile);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (failures.length) {
    const error = new Error(`Semantic dependency verification failed: ${failures.join('; ')}`);
    error.code = 'SEMANTIC_DEPENDENCY_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
