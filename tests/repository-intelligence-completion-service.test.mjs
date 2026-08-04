import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryIntelligenceCompletionService } from '../src/intelligence-completion/repository-intelligence-completion-service.mjs';

const S = (c) => c.repeat(64);
const C = (path, c = 'a') => ({ path, startLine: 1, endLine: 3, sourceHash: S(c) });

test('records commit-architecture and issue-code relations without claiming causality', () => {
  const service = new RepositoryIntelligenceCompletionService();
  const commit = service.recordCommitArchitecture({
    repositoryId: 'repo', branch: 'main', commitSha: 'a'.repeat(40), architectureIds: ['layer:runtime'],
    evidenceKind: 'observed', confidence: 0.9, citations: [C('src/runtime/main.mjs')],
  });
  assert.equal(commit.relation, 'commit-changed-architecture');
  assert.equal(commit.claims.causalityProven, false);
  assert.equal(commit.invalidationKeys[0].branch, 'main');
  const issue = service.recordIssueCodeReference({ repositoryId: 'repo', branch: 'main', issueId: 'GH-42', codeIds: ['symbol:parseConfig'], evidenceKind: 'inferred', confidence: 0.6, citations: [C('src/config.mjs', 'b')] });
  assert.equal(issue.relation, 'issue-referenced-code');
  assert.equal(issue.claims.issueProvesDefectLocation, false);
  assert.throws(() => service.recordCommitArchitecture({ repositoryId: 'repo', branch: 'main', commitSha: 'bad', architectureIds: ['x'], citations: [C('x')] }), /commitSha/);
});

test('builds a cited module map with responsibility dependency direction owner and public surface', () => {
  const service = new RepositoryIntelligenceCompletionService();
  const result = service.buildModuleMap({ repositoryId: 'repo', branch: 'main', modules: [
    { moduleId: 'context', path: 'src/context', responsibility: 'build bounded context', owner: 'core-team', publicSurface: ['ContextLearningKernel'], dependencies: [{ targetModuleId: 'repository', direction: 'outbound', kind: 'reads' }], citations: [C('src/context/index.mjs')] },
    { moduleId: 'repository', path: 'src/repository', responsibility: 'index code', owner: 'repo-team', publicSurface: ['RepositoryIntelligenceFabric'], dependencies: [], citations: [C('src/repository/index.mjs', 'b')] },
  ] });
  assert.equal(result.modules.length, 2);
  assert.equal(result.modules[0].responsibility, 'build bounded context');
  assert.equal(result.modules[0].dependencies[0].direction, 'outbound');
  assert.equal(result.modules[0].owner, 'core-team');
  assert.ok(result.modules[0].invalidationKeys.length > 0);
});

test('detects architecture patterns conventions legacy and security zones with citations', () => {
  const service = new RepositoryIntelligenceCompletionService();
  const result = service.detectArchitectureZones({ repositoryId: 'repo', branch: 'main', files: [
    { path: 'src/security/token-vault.mjs', imports: ['node:crypto'], annotations: ['@critical'], sourceHash: S('a') },
    { path: 'legacy/adapter.js', imports: [], annotations: [], sourceHash: S('b') },
    { path: 'src/services/user-service.mjs', imports: ['./repository.mjs'], annotations: [], sourceHash: S('c') },
  ], rules: [
    { ruleId: 'security-path', zoneType: 'security-critical', pathPattern: 'security|token', confidence: 0.95 },
    { ruleId: 'legacy-path', zoneType: 'legacy', pathPattern: '^legacy/', confidence: 0.9 },
    { ruleId: 'service-convention', zoneType: 'convention', pathPattern: '-service\\.mjs$', confidence: 0.8 },
    { ruleId: 'repository-pattern', zoneType: 'architecture-pattern', importPattern: 'repository', confidence: 0.75 },
  ] });
  assert.deepEqual(new Set(result.findings.map((item) => item.zoneType)), new Set(['security-critical', 'legacy', 'convention', 'architecture-pattern']));
  assert.ok(result.findings.every((item) => item.citations.length > 0 && item.invalidationKeys.length > 0));
});

test('builds bounded Git ownership churn hotspot and regression risk profiles', () => {
  const service = new RepositoryIntelligenceCompletionService({ maximumHistory: 10 });
  const result = service.buildGitRiskProfile({ repositoryId: 'repo', branch: 'main', expectedBranch: 'main', nowMs: Date.parse('2026-07-31T00:00:00Z'), history: [
    { commitSha: 'a'.repeat(40), author: 'alice', path: 'src/a.mjs', linesChanged: 100, regression: true, timestamp: '2026-07-30T00:00:00Z', sourceHash: S('a') },
    { commitSha: 'b'.repeat(40), author: 'alice', path: 'src/a.mjs', linesChanged: 20, regression: false, timestamp: '2026-07-20T00:00:00Z', sourceHash: S('b') },
    { commitSha: 'c'.repeat(40), author: 'bob', path: 'src/b.mjs', linesChanged: 5, regression: false, timestamp: '2026-07-29T00:00:00Z', sourceHash: S('c') },
  ] });
  const a = result.paths.find((item) => item.path === 'src/a.mjs');
  assert.equal(a.owner, 'alice');
  assert.equal(a.churn, 120);
  assert.equal(a.regressionCount, 1);
  assert.ok(a.hotspotScore > result.paths.find((item) => item.path === 'src/b.mjs').hotspotScore);
  assert.equal(a.recentCommits.length, 2);
  assert.throws(() => service.buildGitRiskProfile({ repositoryId: 'repo', branch: 'feature', expectedBranch: 'main', history: [] }), /branch mismatch/);
});
