import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'authenticated-principal-bound-index',
  'compiler-ast-inheritance-index',
  'same-file-relative-import-resolution',
  'explicit-ambiguous-unresolved-evidence',
  'contextual-local-issue-references',
  'git-commit-to-changed-file-links',
  'bounded-api-and-knowledge-center',
  'item-level-feature-audit',
  'full-release-matrix-gate',
]);

const REQUIRED_FILES = Object.freeze([
  'third_party/typescript/package.json',
  'third_party/typescript/LICENSE.txt',
  'third_party/typescript/lib/typescript.js',
  'src/repository/typescript-ast-loader.mjs',
  'src/repository/code-relationship-intelligence-service.mjs',
  'src/server/routes.mjs',
  'src/server/http-server.mjs',
  'src/app.mjs',
  'ui/codebase-knowledge-center.js',
  'ui/codebase-knowledge-center.css',
  'tests/code-relationship-intelligence-service.test.mjs',
  'tests/code-relationship-http-api.test.mjs',
  'tests/code-relationship-app-wiring.test.mjs',
  'tests/code-relationship-center-ui.test.mjs',
  'tests/code-relationship-release-gate.test.mjs',
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

function auditItem(audit, id) {
  for (const section of audit?.sections ?? []) {
    const item = (section.items ?? []).find((entry) => entry.id === id);
    if (item) return item;
  }
  return null;
}

export async function verifyCodeRelationshipIntelligence({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');

  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const loader = contents.get('src/repository/typescript-ast-loader.mjs') ?? '';
  const service = contents.get('src/repository/code-relationship-intelligence-service.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const http = contents.get('src/server/http-server.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/codebase-knowledge-center.js') ?? '';
  const auditSource = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';

  requirePattern(loader, /typescript[\s\S]*typescript\.js[\s\S]*SUPPORTED_AST_EXTENSIONS[\s\S]*parseAstSource/, 'vendored TypeScript AST loader', failures);
  requirePattern(service, /CodeRelationshipIntelligenceService[\s\S]*principalId[\s\S]*getProject/, 'authenticated project and principal enforcement', failures);
  requirePattern(service, /parseAstSource[\s\S]*isClassDeclaration[\s\S]*isInterfaceDeclaration[\s\S]*heritageClauses/, 'compiler AST inheritance extraction', failures);
  requirePattern(service, /ImplementsKeyword[\s\S]*'implements'[\s\S]*'extends'/, 'extends and implements relationship detection', failures);
  requirePattern(service, /same-file[\s\S]*relative-import[\s\S]*unique-project-symbol/, 'same-file, relative import, and unique project resolution', failures);
  requirePattern(service, /ambiguous[\s\S]*not-found/, 'explicit ambiguous and unresolved evidence', failures);
  requirePattern(service, /ISSUE_CONTEXT[\s\S]*contextual-source-reference/, 'contextual local issue references', failures);
  requirePattern(service, /'git'[\s\S]*'log'[\s\S]*git-commit-reference[\s\S]*commit-message-changed-file/, 'Git commit to changed-file issue links', failures);
  requirePattern(service, /MAX_LIMIT\s*=\s*500[\s\S]*boundedInteger/, 'bounded relationship queries', failures);
  requirePattern(service, /receiptSha256[\s\S]*graphSha256|graphSha256[\s\S]*receiptSha256/, 'content-addressed graph and receipts', failures);

  requirePattern(routes, /POST[\s\S]*\/api\/code-relationships\/index[\s\S]*projectId:\s*body\.projectId[\s\S]*principalId:\s*req\.forgePrincipal\?\.subject/, 'authenticated bounded relationship index endpoint', failures);
  requirePattern(routes, /GET[\s\S]*\/api\/code-relationships\/inheritance[\s\S]*principalId:\s*req\.forgePrincipal\?\.subject/, 'authenticated inheritance endpoint', failures);
  requirePattern(routes, /GET[\s\S]*\/api\/code-relationships\/issues[\s\S]*principalId:\s*req\.forgePrincipal\?\.subject/, 'authenticated issue relationship endpoint', failures);
  if (/codeRelationships\.indexProject\(\{[\s\S]{0,240}(?:workspaceRoot|rootDirectory|credential|token)\s*:/i.test(routes)) failures.push('relationship index API must not accept arbitrary workspace or credential inputs');
  requirePattern(http, /codeRelationships\s*=\s*null[\s\S]*createRoutes\(\{[\s\S]*codeRelationships/, 'HTTP relationship service forwarding', failures);
  requirePattern(app, /CodeRelationshipIntelligenceService[\s\S]*new CodeRelationshipIntelligenceService\(\{\s*store,\s*codebaseKnowledge[\s\S]*createHttpServer\(\{[\s\S]*codeRelationships/, 'application relationship service wiring', failures);

  requirePattern(ui, /inheritance:\s*'Inheritance'[\s\S]*issues:\s*'Issue Links'/, 'Inheritance and Issue Links tabs', failures);
  requirePattern(ui, /\/api\/code-relationships\/inheritance[\s\S]*\/api\/code-relationships\/issues/, 'relationship Knowledge Center queries', failures);
  requirePattern(ui, /Unresolved evidence[\s\S]*item\.reason[\s\S]*commitHash[\s\S]*receiptSha256/, 'unresolved, commit, and receipt evidence rendering', failures);
  if (/(?:api\.github\.com|api\.atlassian\.com|jira|octokit)/i.test(service + ui)) failures.push('relationship intelligence must not synchronize with remote issue providers');

  requirePattern(auditSource, /codeRelationships:[\s\S]*code-relationship-intelligence-service\.mjs[\s\S]*code-relationship-center-ui\.test\.mjs[\s\S]*code-relationship-release-gate\.test\.mjs/, 'code relationship audit evidence set', failures);
  requirePattern(auditSource, /sections:\s*\[13\][^\n]*Lập chỉ mục inheritance graph\|Lập chỉ mục issue liên quan[^\n]*codeRelationships/, 'item-level code relationship audit rules', failures);
  if (/EXPLICIT_NOT_IMPLEMENTED[\s\S]*inheritance graph/.test(auditSource)) failures.push('inheritance graph remains explicitly not implemented');
  requirePattern(matrix, /id:\s*'code-relationship-intelligence'[\s\S]*scripts\/verify-code-relationships\.mjs/, 'full release matrix relationship gate', failures);

  try {
    const audit = JSON.parse(await readFile(path.join(root, 'docs', `feature-audit-${releaseVersion}.json`), 'utf8'));
    for (const id of ['13.15', '13.19']) {
      const item = auditItem(audit, id);
      if (item?.status !== 'verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);
    }
    const treeSitter = auditItem(audit, '13.27');
    if (!['not_implemented', 'external_gate'].includes(treeSitter?.status)) failures.push('Tree-sitter item 13.27 must remain outside compiler relationship verification');
  } catch { failures.push(`missing or invalid feature audit for ${releaseVersion}`); }

  const limitations = await source(root, `docs/LIMITATIONS-${releaseVersion}.md`, failures);
  requirePattern(limitations, /does not use Tree-sitter|không sử dụng Tree-sitter/i, 'no Tree-sitter claim', failures);
  requirePattern(limitations, /JavaScript.*TypeScript.*JSX.*TSX|JS\/TS\/JSX\/TSX/i, 'language scope boundary', failures);
  requirePattern(limitations, /does not synchronize.*remote issue|không đồng bộ.*issue.*từ xa/i, 'no remote issue synchronization claim', failures);
  requirePattern(limitations, /does not infer.*issue.*truth|không suy đoán.*issue/i, 'no inferred issue truth claim', failures);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.code-relationship-intelligence-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    requiredCapabilities: REQUIRED_CAPABILITIES,
    limitations: Object.freeze({
      treeSitterClaimed: false,
      remoteIssueSyncClaimed: false,
      languageGeneralClaimed: false,
      inferredIssueTruthClaimed: false,
    }),
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
    const error = new Error(`Code relationship intelligence verification failed: ${failures.join('; ')}`);
    error.code = 'CODE_RELATIONSHIP_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
