import { boundedArray, finite, sha, signed, text } from './completion-utils.mjs';

function branch(value) { return text(value, 'branch', 512); }
function repository(value) { return text(value, 'repositoryId', 512); }
function commit(value, label = 'commitSha') {
  const result = text(value, label, 64).toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(result)) throw new TypeError(`${label} must be a 40-64 character hexadecimal commit digest`);
  return result;
}
function normalizedPath(value, label = 'path') { return text(value, label, 4_096).replaceAll('\\', '/').replace(/^\.\//, ''); }
function confidence(value, fallback = 0.5) { return finite(value ?? fallback, 'confidence', 0, 1); }
function evidenceKind(value = 'observed') {
  const result = text(value, 'evidenceKind', 32);
  if (!['observed', 'inferred'].includes(result)) throw new TypeError('evidenceKind must be observed or inferred');
  return result;
}
function normalizeCitations(value, label = 'citations', maximum = 256) {
  const rows = boundedArray(value, label, maximum);
  if (!rows.length) throw new TypeError(`${label} must contain at least one citation`);
  return rows.map((item, index) => {
    const path = normalizedPath(item?.path, `${label}[${index}].path`);
    const startLine = Math.max(1, Math.floor(finite(item?.startLine ?? 1, `${label}[${index}].startLine`, 1, 10_000_000)));
    const endLine = Math.max(startLine, Math.floor(finite(item?.endLine ?? startLine, `${label}[${index}].endLine`, startLine, 10_000_000)));
    return { path, startLine, endLine, sourceHash: sha(item?.sourceHash, `${label}[${index}].sourceHash`) };
  });
}
function invalidation(branchName, citations) { return citations.map((item) => ({ branch: branchName, path: item.path, sourceHash: item.sourceHash })); }
function regex(value, label) {
  if (value == null || String(value).trim() === '') return null;
  const source = text(value, label, 1_000);
  try { return new RegExp(source, 'i'); } catch (error) { throw new TypeError(`${label} is invalid: ${error.message}`); }
}

export class RepositoryIntelligenceCompletionService {
  constructor({ maximumHistory = 10_000 } = {}) {
    this.maximumHistory = Math.max(1, Math.min(100_000, Math.floor(Number(maximumHistory) || 10_000)));
    this.relations = [];
    this.moduleMaps = [];
    this.zoneReports = [];
    this.riskProfiles = [];
  }

  recordCommitArchitecture(input = {}) {
    const repositoryId = repository(input.repositoryId); const branchName = branch(input.branch); const commitSha = commit(input.commitSha);
    const architectureIds = boundedArray(input.architectureIds, 'architectureIds', 256).map((item, index) => text(item, `architectureIds[${index}]`, 512));
    if (!architectureIds.length) throw new TypeError('architectureIds must not be empty');
    const citations = normalizeCitations(input.citations);
    const receipt = signed({ schema: 'forge.commit-architecture-relation.v1', repositoryId, branch: branchName, relation: 'commit-changed-architecture', commitSha, architectureIds, evidenceKind: evidenceKind(input.evidenceKind), confidence: confidence(input.confidence), citations, invalidationKeys: invalidation(branchName, citations), claims: { causalityProven: false, architectureChangeObservedBeyondCitations: false } });
    this.relations.push(receipt); return receipt;
  }

  recordIssueCodeReference(input = {}) {
    const repositoryId = repository(input.repositoryId); const branchName = branch(input.branch); const issueId = text(input.issueId, 'issueId', 512);
    const codeIds = boundedArray(input.codeIds, 'codeIds', 256).map((item, index) => text(item, `codeIds[${index}]`, 512));
    if (!codeIds.length) throw new TypeError('codeIds must not be empty');
    const citations = normalizeCitations(input.citations);
    const receipt = signed({ schema: 'forge.issue-code-relation.v1', repositoryId, branch: branchName, relation: 'issue-referenced-code', issueId, codeIds, evidenceKind: evidenceKind(input.evidenceKind), confidence: confidence(input.confidence), citations, invalidationKeys: invalidation(branchName, citations), claims: { issueProvesDefectLocation: false, causalityProven: false } });
    this.relations.push(receipt); return receipt;
  }

  buildModuleMap(input = {}) {
    const repositoryId = repository(input.repositoryId); const branchName = branch(input.branch);
    const raw = boundedArray(input.modules, 'modules', 10_000); const ids = new Set();
    const modules = raw.map((item, index) => {
      const moduleId = text(item?.moduleId, `modules[${index}].moduleId`, 512); if (ids.has(moduleId)) throw new Error(`duplicate moduleId: ${moduleId}`); ids.add(moduleId);
      const citations = normalizeCitations(item?.citations, `modules[${index}].citations`);
      const dependencies = boundedArray(item?.dependencies ?? [], `modules[${index}].dependencies`, 2_000).map((dependency, dependencyIndex) => {
        const direction = text(dependency?.direction, `modules[${index}].dependencies[${dependencyIndex}].direction`, 32);
        if (!['outbound', 'inbound', 'bidirectional'].includes(direction)) throw new TypeError(`unsupported dependency direction: ${direction}`);
        return { targetModuleId: text(dependency?.targetModuleId, `modules[${index}].dependencies[${dependencyIndex}].targetModuleId`, 512), direction, kind: text(dependency?.kind ?? 'depends-on', `modules[${index}].dependencies[${dependencyIndex}].kind`, 128) };
      });
      return {
        moduleId,
        path: normalizedPath(item?.path, `modules[${index}].path`),
        responsibility: text(item?.responsibility, `modules[${index}].responsibility`, 2_000),
        owner: text(item?.owner, `modules[${index}].owner`, 512),
        publicSurface: boundedArray(item?.publicSurface ?? [], `modules[${index}].publicSurface`, 1_000).map((surface, surfaceIndex) => text(surface, `modules[${index}].publicSurface[${surfaceIndex}]`, 512)),
        dependencies,
        citations,
        invalidationKeys: invalidation(branchName, citations),
      };
    });
    const receipt = signed({ schema: 'forge.repository-module-map.v1', repositoryId, branch: branchName, modules, claims: { ownershipInferredFromGit: false, dependencyDirectionGuessed: false } });
    this.moduleMaps.push(receipt); return receipt;
  }

  detectArchitectureZones(input = {}) {
    const repositoryId = repository(input.repositoryId); const branchName = branch(input.branch);
    const files = boundedArray(input.files, 'files', 100_000).map((item, index) => ({
      path: normalizedPath(item?.path, `files[${index}].path`),
      imports: boundedArray(item?.imports ?? [], `files[${index}].imports`, 5_000).map(String),
      annotations: boundedArray(item?.annotations ?? [], `files[${index}].annotations`, 5_000).map(String),
      sourceHash: sha(item?.sourceHash, `files[${index}].sourceHash`),
    }));
    const rules = boundedArray(input.rules, 'rules', 1_000).map((item, index) => ({
      ruleId: text(item?.ruleId, `rules[${index}].ruleId`, 256),
      zoneType: text(item?.zoneType, `rules[${index}].zoneType`, 128),
      path: regex(item?.pathPattern, `rules[${index}].pathPattern`),
      import: regex(item?.importPattern, `rules[${index}].importPattern`),
      annotation: regex(item?.annotationPattern, `rules[${index}].annotationPattern`),
      confidence: confidence(item?.confidence),
    }));
    const findings = [];
    for (const file of files) for (const rule of rules) {
      const matches = (rule.path?.test(file.path) ?? false) || (rule.import ? file.imports.some((value) => rule.import.test(value)) : false) || (rule.annotation ? file.annotations.some((value) => rule.annotation.test(value)) : false);
      if (!matches) continue;
      const citations = [{ path: file.path, startLine: 1, endLine: 1, sourceHash: file.sourceHash }];
      findings.push({ ruleId: rule.ruleId, zoneType: rule.zoneType, path: file.path, confidence: rule.confidence, citations, invalidationKeys: invalidation(branchName, citations), evidenceKind: 'inferred' });
    }
    const receipt = signed({ schema: 'forge.repository-architecture-zone-report.v1', repositoryId, branch: branchName, findings, rulesEvaluated: rules.length, claims: { architecturePatternIsGroundTruth: false, uncitedFindingAllowed: false } });
    this.zoneReports.push(receipt); return receipt;
  }

  buildGitRiskProfile(input = {}) {
    const repositoryId = repository(input.repositoryId); const branchName = branch(input.branch);
    if (input.expectedBranch != null && branchName !== branch(input.expectedBranch)) throw new Error(`branch mismatch: expected ${input.expectedBranch}, received ${branchName}`);
    const nowMs = finite(input.nowMs ?? Date.now(), 'nowMs', 0, Number.MAX_SAFE_INTEGER);
    const history = boundedArray(input.history ?? [], 'history', this.maximumHistory).map((item, index) => {
      const timestampMs = Date.parse(text(item?.timestamp, `history[${index}].timestamp`, 128)); if (!Number.isFinite(timestampMs)) throw new TypeError(`history[${index}].timestamp is invalid`);
      return { commitSha: commit(item?.commitSha, `history[${index}].commitSha`), author: text(item?.author, `history[${index}].author`, 512), path: normalizedPath(item?.path, `history[${index}].path`), linesChanged: Math.max(0, Math.floor(finite(item?.linesChanged ?? 0, `history[${index}].linesChanged`, 0, 100_000_000))), regression: item?.regression === true, timestamp: new Date(timestampMs).toISOString(), timestampMs, sourceHash: sha(item?.sourceHash, `history[${index}].sourceHash`) };
    });
    const grouped = new Map();
    for (const row of history) { const list = grouped.get(row.path) ?? []; list.push(row); grouped.set(row.path, list); }
    const paths = [...grouped.entries()].map(([path, rows]) => {
      rows.sort((a, b) => b.timestampMs - a.timestampMs || b.commitSha.localeCompare(a.commitSha));
      const byAuthor = new Map(); for (const row of rows) byAuthor.set(row.author, (byAuthor.get(row.author) ?? 0) + 1);
      const owner = [...byAuthor.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
      const churn = rows.reduce((sum, row) => sum + row.linesChanged, 0); const regressionCount = rows.filter((row) => row.regression).length;
      const recency = rows.reduce((sum, row) => sum + Math.max(0, 30 - Math.floor((nowMs - row.timestampMs) / 86_400_000)) / 30, 0);
      const hotspotScore = Number((rows.length + churn / 100 + regressionCount * 5 + recency).toFixed(6));
      const citations = rows.slice(0, 100).map((row) => ({ path: row.path, startLine: 1, endLine: 1, sourceHash: row.sourceHash }));
      return { path, owner, contributors: [...byAuthor.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([author, commits]) => ({ author, commits })), commitCount: rows.length, churn, regressionCount, hotspotScore, recentCommits: rows.slice(0, 20).map((row) => ({ commitSha: row.commitSha, author: row.author, timestamp: row.timestamp, linesChanged: row.linesChanged, regression: row.regression, sourceHash: row.sourceHash })), citations, invalidationKeys: invalidation(branchName, citations) };
    }).sort((a, b) => b.hotspotScore - a.hotspotScore || a.path.localeCompare(b.path));
    const receipt = signed({ schema: 'forge.repository-git-risk-profile.v1', repositoryId, branch: branchName, generatedAt: new Date(nowMs).toISOString(), historyEntries: history.length, paths, claims: { ownershipIsAuthorization: false, hotspotProvesDefect: false, historyBeyondInputUsed: false } });
    this.riskProfiles.push(receipt); return receipt;
  }

  snapshot() {
    return signed({ schema: 'forge.repository-intelligence-completion-snapshot.v1', relations: this.relations.slice(-100), moduleMaps: this.moduleMaps.slice(-20), zoneReports: this.zoneReports.slice(-20), riskProfiles: this.riskProfiles.slice(-20), claims: { rawGitLogStored: false, causalClaimsAllowed: false } });
  }
}
