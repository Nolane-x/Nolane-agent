import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze(['routes-and-api-endpoints','database-models','references-and-conservative-calls','git-history','bounded-regex','incremental-indexing','portable-watcher','dependency-distance-ranking','git-recency-ranking','test-relation-ranking','authenticated-api','lazy-control-center']);
const REQUIRED_FILES = Object.freeze([
  'src/repository/codebase-knowledge-graph-service.mjs',
  'src/repository/codebase-knowledge-watcher.mjs',
  'src/repository/adaptive-repository-intelligence.mjs',
  'src/repository/repository-intelligence-fabric.mjs',
  'src/server/routes.mjs',
  'src/app.mjs',
  'ui/codebase-knowledge-center.js',
  'ui/codebase-knowledge-center.css',
  'tests/codebase-knowledge-graph-service.test.mjs',
  'tests/codebase-knowledge-http-api.test.mjs',
  'tests/codebase-knowledge-app-wiring.test.mjs',
  'tests/codebase-knowledge-center-ui.test.mjs',
  'tests/codebase-knowledge-release-gate.test.mjs',
  'src/release/full-release-matrix.mjs',
]);

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing required source: ${relative}`); return ''; }
}
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(`missing ${label}`); }

export async function verifyCodebaseKnowledge({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory); const releaseVersion = String(version ?? '').trim(); const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');
  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const graph = contents.get('src/repository/codebase-knowledge-graph-service.mjs') ?? '';
  const watcher = contents.get('src/repository/codebase-knowledge-watcher.mjs') ?? '';
  const adaptive = contents.get('src/repository/adaptive-repository-intelligence.mjs') ?? '';
  const fabric = contents.get('src/repository/repository-intelligence-fabric.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/codebase-knowledge-center.js') ?? '';
  const css = contents.get('ui/codebase-knowledge-center.css') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';
  requirePattern(graph, /js-router-method[\s\S]*python-router-decorator[\s\S]*api_endpoint/, 'route/API detectors', failures);
  requirePattern(graph, /prisma-model[\s\S]*sql-create-table[\s\S]*database_model/, 'database model detectors', failures);
  requirePattern(graph, /unique-symbol-occurrence[\s\S]*function-body-call-pattern[\s\S]*conservative-lexical/, 'reference and conservative call edges', failures);
  requirePattern(graph, /gitHistory[\s\S]*last_commit_at[\s\S]*commit_count/, 'Git history index', failures);
  requirePattern(graph, /Unsafe regex pattern[\s\S]*Regex search time budget exceeded/, 'bounded regex controls', failures);
  requirePattern(graph, /existing\.get\(relative\) === digest[\s\S]*reused \+= 1/, 'incremental content-hash reuse', failures);
  requirePattern(watcher, /portable-polling/, 'portable watcher mode', failures);
  requirePattern(watcher, /setInterval/, 'portable watcher polling loop', failures);
  requirePattern(watcher, /stop\(projectId\)/, 'portable watcher stop lifecycle', failures);
  requirePattern(graph, /dependencyDistance[\s\S]*gitRecency[\s\S]*testRelation/, 'ranking breakdown', failures);
  requirePattern(adaptive, /graphService[\s\S]*knowledge-graph[\s\S]*dependencyDistance/, 'adaptive graph ranking integration', failures);
  requirePattern(routes, /\/api\/codebase-knowledge[\s\S]*watch\/start[\s\S]*rank/, 'authenticated API routes', failures);
  requirePattern(app, /createRepositoryIntelligenceFabric[\s\S]*repositoryIntelligenceFabric\.close/, 'application lifecycle wiring', failures);
  requirePattern(fabric, /(?=[\s\S]*new CodebaseKnowledgeGraphService)(?=[\s\S]*new CodebaseKnowledgeWatcher)(?=[\s\S]*new AdaptiveRepositoryIntelligence)(?=[\s\S]*watcher\.close)(?=[\s\S]*scheduler\.close)/, 'knowledge graph lifecycle behind repository fabric', failures);
  for (const label of ['Graph','Routes & APIs','Data Models','References & Calls','Git History','Regex Search','Live Watch','Ranking']) requirePattern(ui, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `UI tab ${label}`, failures);
  requirePattern(css, /knowledge-constellation/, 'future constellation UI', failures);
  requirePattern(css, /knowledge-signal-grid/, 'future signal-grid UI', failures);
  requirePattern(css, /prefers-reduced-motion/, 'reduced-motion support', failures);
  requirePattern(matrix, /id:\s*'codebase-knowledge-graph'/, 'full release matrix gate', failures);
  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = { schema: 'forge.studio.codebase-knowledge-verification.v1', version: releaseVersion, status: failures.length ? 'fail' : 'pass', requiredCapabilities: REQUIRED_CAPABILITIES, failures: Object.freeze(failures), fileDigests: Object.freeze(fileDigests) };
  const report = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  if (outputFile) { const target = path.resolve(outputFile); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, `${JSON.stringify(report, null, 2)}\n`); }
  if (failures.length) { const error = new Error(`Codebase knowledge verification failed: ${failures.join('; ')}`); error.code = 'CODEBASE_KNOWLEDGE_VERIFICATION_FAILED'; error.report = report; throw error; }
  return report;
}
