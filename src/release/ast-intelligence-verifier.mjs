import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const REQUIRED_CAPABILITIES = Object.freeze([
  'vendored-typescript-parser-provenance',
  'bounded-js-ts-ast-query',
  'file-and-node-hash-evidence',
  'single-node-stale-guarded-patch',
  'dry-run-and-syntax-reparse',
  'atomic-mode-and-line-ending-preservation',
  'task-authorized-operating-plane',
  'observable-knowledge-center',
  'item-level-feature-audit',
  'full-release-matrix-gate',
]);

const REQUIRED_FILES = Object.freeze([
  'third_party/typescript/package.json',
  'third_party/typescript/LICENSE.txt',
  'third_party/typescript/ThirdPartyNoticeText.txt',
  'third_party/typescript/lib/typescript.js',
  'src/repository/typescript-ast-loader.mjs',
  'src/repository/ast-intelligence-service.mjs',
  'src/agent/operating-plane-service.mjs',
  'src/agent/operating-plane-tool-gateway.mjs',
  'src/server/routes.mjs',
  'src/app.mjs',
  'ui/codebase-knowledge-center.js',
  'ui/codebase-knowledge-center.css',
  'tests/typescript-ast-loader.test.mjs',
  'tests/ast-intelligence-service.test.mjs',
  'tests/operating-plane-service.test.mjs',
  'tests/agent-operating-plane-wiring.test.mjs',
  'tests/app-operating-plane-wiring.test.mjs',
  'tests/ast-intelligence-center-ui.test.mjs',
  'tests/ast-intelligence-release-gate.test.mjs',
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

export async function verifyAstIntelligence({ rootDirectory = process.cwd(), version, outputFile } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? '').trim();
  const failures = [];
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) failures.push('stable semantic version is required');

  const contents = new Map();
  for (const relative of REQUIRED_FILES) contents.set(relative, await source(root, relative, failures));
  const packageText = contents.get('third_party/typescript/package.json') ?? '';
  const license = contents.get('third_party/typescript/LICENSE.txt') ?? '';
  const compiler = contents.get('third_party/typescript/lib/typescript.js') ?? '';
  const loader = contents.get('src/repository/typescript-ast-loader.mjs') ?? '';
  const service = contents.get('src/repository/ast-intelligence-service.mjs') ?? '';
  const plane = contents.get('src/agent/operating-plane-service.mjs') ?? '';
  const gateway = contents.get('src/agent/operating-plane-tool-gateway.mjs') ?? '';
  const routes = contents.get('src/server/routes.mjs') ?? '';
  const app = contents.get('src/app.mjs') ?? '';
  const ui = contents.get('ui/codebase-knowledge-center.js') ?? '';
  const css = contents.get('ui/codebase-knowledge-center.css') ?? '';
  const audit = contents.get('scripts/audit-feature-checklist.mjs') ?? '';
  const matrix = contents.get('src/release/full-release-matrix.mjs') ?? '';
  const limitationsRelative = `docs/LIMITATIONS-${releaseVersion}.md`;
  const limitations = await source(root, limitationsRelative, failures);
  contents.set(limitationsRelative, limitations);

  requirePattern(packageText, /"name"\s*:\s*"typescript"[\s\S]*"version"\s*:\s*"5\.8\.3"/, 'pinned TypeScript 5.8.3 package identity', failures);
  requirePattern(license, /Apache License[\s\S]*Version 2\.0/, 'vendored TypeScript license provenance', failures);
  requirePattern(compiler, /TypeScript Compiler[\s\S]*5\.8\.3|version\s*=\s*"5\.8\.3"/, 'vendored compiler implementation', failures);
  requirePattern(loader, /createRequire[\s\S]*PINNED_COMPILER_VERSION\s*=\s*'5\.8\.3'[\s\S]*SUPPORTED_AST_EXTENSIONS/, 'strict vendored parser loader', failures);
  requirePattern(loader, /MAX_SOURCE_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024[\s\S]*parseDiagnostics/, 'bounded source and syntax diagnostics', failures);
  requirePattern(service, /MAX_LIMIT\s*=\s*200[\s\S]*schema:\s*'forge\.ast-query\.v1'/, 'bounded AST query contract', failures);
  requirePattern(service, /sourceSha256[\s\S]*nodeSha256[\s\S]*receiptSha256/, 'file, node, and receipt hash evidence', failures);
  requirePattern(service, /AST_STALE_FILE[\s\S]*AST_NODE_AMBIGUOUS[\s\S]*AST_STALE_NODE/, 'single-node stale guards', failures);
  requirePattern(service, /parseAstSource\(\{ path: loaded\.path, source: after \}\)[\s\S]*dryRun/, 'dry-run and syntax reparse', failures);
  requirePattern(service, /randomUUID[\s\S]*writeFile\(temporary[\s\S]*chmod\(temporary[\s\S]*rename\(temporary, destination\)/, 'atomic write with file mode preservation', failures);
  requirePattern(service, /lineEnding = loaded\.source\.includes\('\\r\\n'\)/, 'line-ending preservation', failures);
  requirePattern(plane, /astIntelligenceFactory[\s\S]*name === 'astQuery' \|\| name === 'astPatch'/, 'operating-plane service routing', failures);
  requirePattern(gateway, /'code\.astQuery'[\s\S]*'code\.astPatch'[\s\S]*DEFAULT_READ_ONLY[\s\S]*'code\.astQuery'/, 'task-authorized AST tool schemas', failures);
  requirePattern(routes, /ast-query\|ast-patch[\s\S]*'ast-query': 'astQuery'[\s\S]*'ast-patch': 'astPatch'/, 'HTTP AST endpoints', failures);
  requirePattern(app, /import \{ AstIntelligenceService \}[\s\S]*const astIntelligenceFactory[\s\S]*local-ast-query-patch/, 'application wiring and capability', failures);
  requirePattern(ui, /AST Intelligence[\s\S]*\/api\/code\/ast-query[\s\S]*\/api\/code\/ast-patch[\s\S]*expectedNodeSha256/, 'observable guarded AST UI', failures);
  requirePattern(css, /knowledge-ast-shell[\s\S]*knowledge-ast-result[\s\S]*knowledge-ast-replacement/, 'responsive AST UI styling', failures);
  requirePattern(audit, /sections:\s*\[13\][\s\S]*Hỗ trợ AST query[\s\S]*astIntelligence/, 'AST query item-level audit rule', failures);
  requirePattern(audit, /sections:\s*\[16\][\s\S]*Patch theo AST[\s\S]*astIntelligence/, 'AST patch item-level audit rule', failures);
  requirePattern(audit, /EXTERNAL_RULES[\s\S]*Hỗ trợ tree-sitter[\s\S]*treeSitterRuntime/, 'honest Tree-sitter external gate', failures);
  requirePattern(limitations, /AST Query\/Patch do not use Tree-sitter|AST query and patch[\s\S]{0,240}does not claim[\s\S]{0,160}Tree-sitter/i, 'honest AST parser boundary', failures);
  requirePattern(matrix, /id:\s*'local-ast-intelligence'[\s\S]*scripts\/verify-ast-intelligence\.mjs/, 'full release matrix gate', failures);

  const fileDigests = {};
  for (const [relative, text] of contents) if (text) fileDigests[relative] = canonicalSha256({ relative, text });
  const base = {
    schema: 'forge.studio.ast-intelligence-verification.v1',
    version: releaseVersion,
    status: failures.length ? 'fail' : 'pass',
    requiredCapabilities: REQUIRED_CAPABILITIES,
    limitations: Object.freeze({ languages: Object.freeze(['javascript', 'typescript', 'jsx', 'tsx']), treeSitterClaimed: false, generalLanguageAstClaimed: false }),
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
    const error = new Error(`AST intelligence verification failed: ${failures.join('; ')}`);
    error.code = 'AST_INTELLIGENCE_VERIFICATION_FAILED';
    error.report = report;
    throw error;
  }
  return report;
}
