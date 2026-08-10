import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { RepositoryDigitalTwinService } from '../src/repository/repository-digital-twin-service.mjs';
import { RepositoryIndex } from '../src/repository/repository-index.mjs';
import { SecureSemanticIndex } from '../src/repository/secure-semantic-index.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';

export const REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS = Object.freeze([
  '32.2','32.3','32.4','32.7','32.9','32.10','32.11','32.12','32.15','32.17','32.18',
]);

const SHA256 = /^[a-f0-9]{64}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const normalize = (value) => String(value ?? '').replaceAll('\\', '/');
const sortedUnique = (values) => [...new Set(values.map(String))].sort();

function git(root, args, env = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, ...env },
  }).trim();
}

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-repository-truth-measure-'));
  await Promise.all([
    mkdir(path.join(root, 'src', 'api'), { recursive: true }),
    mkdir(path.join(root, 'src', 'internal'), { recursive: true }),
    mkdir(path.join(root, 'tests'), { recursive: true }),
    mkdir(path.join(root, 'config'), { recursive: true }),
    mkdir(path.join(root, 'db'), { recursive: true }),
  ]);
  const files = {
    'package.json': `${JSON.stringify({
      name: 'repository-truth-measurement',
      type: 'module',
      scripts: { build: 'node build.mjs', test: 'node --test' },
      dependencies: { zod: '^4.0.0' },
    }, null, 2)}\n`,
    'src/api/session.mjs': [
      "import { encodeToken } from '../internal/token.mjs';",
      'export function createSession(user) {',
      '  return { id: user.id, token: encodeToken(user.id) };',
      '}',
      '',
    ].join('\n'),
    'src/internal/token.mjs': [
      'export function encodeToken(value) {',
      "  return `token:${value}`;",
      '}',
      '',
    ].join('\n'),
    'tests/session.test.mjs': [
      "import { createSession } from '../src/api/session.mjs';",
      "createSession({ id: 'u1' });",
      '',
    ].join('\n'),
    'config/app.json': '{"sessionTtl":60}\n',
    'db/schema.sql': 'CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL);\n',
  };
  for (const [relative, content] of Object.entries(files)) await writeFile(path.join(root, relative), content);

  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'truth-measure@example.invalid']);
  git(root, ['config', 'user.name', 'Repository Truth Measurement']);
  git(root, ['add', '.']);
  const fixedGitEnvironment = {
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  };
  git(root, ['commit', '-m', 'deterministic baseline'], fixedGitEnvironment);
  git(root, ['checkout', '-b', 'feature/repository-truth']);
  await writeFile(path.join(root, 'config', 'app.json'), '{"sessionTtl":120}\n');
  return { root, files };
}

export async function measureRepositoryTruthPlane({ rootDirectory = process.cwd(), version = '3.3.0' } = {}) {
  void rootDirectory;
  const { root, files } = await createFixture();
  const canonicalRoot = await realpath(root);
  const store = new StudioStore(path.join(root, '.forge-truth-measurement.db'));
  try {
    const project = store.createProject({ id: 'repository_truth_measurement', name: 'Repository Truth Measurement', workspaceRoot: root });
    await new RepositoryIndex({ store }).index(project);
    await new SecureSemanticIndex({ store }).index(project, { deferEmbeddings: true });

    const diskSource = await readFile(path.join(root, 'src', 'api', 'session.mjs'), 'utf8');
    const diskSourceHash = hash(diskSource);
    const configHash = hash(await readFile(path.join(root, 'config', 'app.json')));
    const runtimeHash = hash('deterministic repository runtime observation v1');
    const overlayContent = [
      "import { encodeToken } from '../internal/token.mjs';",
      'export function createSession(user) {',
      "  return { id: user.id, token: encodeToken(user.id), source: 'editor' };",
      '}',
      '',
    ].join('\n');
    const overlay = {
      path: 'src/api/session.mjs',
      content: overlayContent,
      sha256: hash(overlayContent),
      overlayId: 'editor:src/api/session.mjs',
    };

    const relationshipEdges = [
      { kind: 'calls', from: 'symbol:createSession', to: 'symbol:encodeToken', citation: { path: 'src/api/session.mjs', line: 3, sourceHash: diskSourceHash }, confidence: 'ast' },
      { kind: 'reads', from: 'symbol:createSession', to: 'config:config/app.json', citation: { path: 'src/api/session.mjs', line: 2, sourceHash: diskSourceHash }, confidence: 'ast' },
      { kind: 'writes', from: 'symbol:createSession', to: 'schema:sessions', citation: { path: 'src/api/session.mjs', line: 3, sourceHash: diskSourceHash }, confidence: 'ast' },
      { kind: 'controls', from: 'config:config/app.json', to: 'service:session', citation: { path: 'config/app.json', line: 1, sourceHash: configHash }, confidence: 'exact' },
      { kind: 'calls', from: 'uncited:source', to: 'uncited:target', citation: null, confidence: 'inferred' },
    ];
    const runtimeEdges = ['request','event','process','state','data-flow'].map((kind, index) => ({
      kind,
      from: `${kind}:source`,
      to: `${kind}:target`,
      citation: { path: 'runtime/repository-truth.ndjson', line: index + 1, sourceHash: runtimeHash },
      confidence: 'runtime-observed',
    }));

    const service = new RepositoryDigitalTwinService({ store });
    const twin = service.build(project.id, {
      editorOverlays: [overlay],
      relationshipProvider: { edges: () => relationshipEdges },
      runtimeProvider: { snapshot: () => ({ edges: runtimeEdges }) },
    });
    const query = await service.query(project.id, { query: 'createSession', budget: 80 });
    const firstPage = service.zoom(project.id, { level: 'symbol', limit: 1 });
    let corruptCursorRejected = false;
    try {
      service.zoom(project.id, { level: 'symbol', limit: 1, cursor: `${firstPage.nextCursor ?? 'missing'}corrupt` });
    } catch { corruptCursorRejected = true; }

    const diskContext = { ...twin.branch, editorOverlayHash: null };
    const crossBranch = service.validateFacts(project.id, { ...diskContext, branch: 'main' });
    await writeFile(path.join(root, 'src', 'api', 'session.mjs'), `${diskSource}// drift\n`);
    const sourceDrift = service.validateFacts(project.id, diskContext);

    const architectureKinds = sortedUnique(twin.architecture.nodes.map((node) => node.kind));
    const symbolEdgeKinds = sortedUnique(twin.symbols.edges.map((edge) => edge.kind));
    const runtimeEdgeKinds = sortedUnique(twin.runtime.edges.map((edge) => edge.kind));
    const citedResults = query.citedResults ?? [];
    const unavailableStages = query.stages.filter((stage) => stage.status === 'unavailable').map((stage) => stage.id);
    const overlaySymbols = twin.symbols.nodes.filter((node) => node.citation?.overlayId === overlay.overlayId);
    const diskSymbols = twin.symbols.nodes.filter((node) => node.path === overlay.path && node.citation?.overlayId == null);

    const base = {
      schema: 'forge.studio.repository-truth-plane-measurement.v1',
      version: String(version),
      promotedRequirementIds: REPOSITORY_TRUTH_PLANE_REQUIREMENT_IDS,
      workspace: {
        realGitRepository: twin.branch.available === true && /^[a-f0-9]{40}$/.test(String(twin.branch.headSha ?? '')),
        branchDetected: twin.branch.branch === 'feature/repository-truth',
        worktreeDetected: normalize(twin.branch.worktree) === normalize(canonicalRoot),
        dirtyStateDetected: twin.branch.dirtyHash !== 'clean' && twin.branch.uncommittedChanges.some((item) => item.path === 'config/app.json'),
        editorOverlayIsolated: overlaySymbols.length > 0 && diskSymbols.length > 0
          && overlaySymbols.every((node) => node.citation.sourceHash === overlay.sha256)
          && diskSymbols.some((node) => node.citation.sourceHash === hash(files['src/api/session.mjs'])),
      },
      architecture: { nodeKinds: architectureKinds },
      symbols: { edgeKinds: symbolEdgeKinds },
      runtime: { edgeKinds: runtimeEdgeKinds },
      provenance: {
        allReturnedFactsCited: citedResults.length > 0 && citedResults.every((result) => SHA256.test(String(result.citation?.sourceHash ?? ''))),
        crossBranchFactRejected: crossBranch.invalid.some((item) => item.reason === 'branch-context-mismatch'),
        sourceHashDriftInvalidated: sourceDrift.invalid.some((item) => item.reason === 'source-hash-mismatch'),
      },
      query: {
        stageOrder: query.stages.map((stage) => stage.id),
        unavailableStagesExplicit: unavailableStages.includes('git') && unavailableStages.includes('semantic'),
      },
      viewer: {
        pageLoadedLessThanGraph: firstPage.loadedNodeCount === 1 && firstPage.loadedNodeCount < firstPage.graphTotalNodeCount,
        corruptCursorRejected,
      },
      boundaries: {
        externalGateCountChanged: false,
        comparativeSuperiorityClaimed: false,
        uncitedInferencePromoted: !twin.unknowns.includes('relationship-edge-rejected:missing-citation'),
        fullGraphLoadedForPage: firstPage.loadedNodeCount >= firstPage.graphTotalNodeCount,
      },
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const version = process.argv[2] ?? '3.3.0';
  const result = await measureRepositoryTruthPlane({ rootDirectory: process.cwd(), version });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
