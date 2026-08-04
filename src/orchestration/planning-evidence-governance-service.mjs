import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { createEvent } from '../protocol/events.mjs';

const VAGUE = /\b(?:todo|tbd|fix it|do it|somehow|something|whatever|unspecified|later|etc\.?|gì đó|chưa rõ|để sau)\b/i;
const TEST_PATH = /(?:^|\/)(?:test|tests|spec|specs)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i;
const DOC_PATH = /(?:^|\/)docs?(?:\/|$)|\.(?:md|mdx|rst|adoc|txt)$/i;
const CONFIG_PATH = /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|deno\.jsonc?|tsconfig(?:\.[^/]+)?\.json|jsconfig\.json|eslint\.config\.[^/]+|\.eslintrc(?:\.[^/]+)?|prettier\.config\.[^/]+|\.prettierrc(?:\.[^/]+)?|vite\.config\.[^/]+|vitest\.config\.[^/]+|jest\.config\.[^/]+|webpack\.config\.[^/]+|rollup\.config\.[^/]+|pyproject\.toml|requirements[^/]*\.txt|go\.mod|cargo\.toml|dockerfile|compose\.ya?ml)$/i;
const SECRETISH = /(?:secret|credential|password|api[_-]?key|access[_-]?token|private[_-]?key)/i;
const KNOWN_TOOLS = Object.freeze(new Set(['fs.search', 'fs.read', 'fs.readMany', 'fs.patchSet', 'git.status', 'git.diff', 'test.detect', 'test.run', 'security.scanArtifacts', 'security.scanDependencies', 'plan.review']));
const ROLE_TOOLS = Object.freeze({
  coordinator: ['plan.review', 'git.status'],
  scout: ['fs.search', 'fs.readMany'],
  builder: ['fs.search', 'fs.read', 'fs.patchSet', 'test.run'],
  reviewer: ['git.diff', 'test.run', 'security.scanArtifacts'],
  integrator: ['git.status', 'git.diff', 'test.run'],
});

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function boundedInteger(value, fallback, min, max, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new TypeError(`${label} must be between ${min} and ${max}`);
  return number;
}

function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function freezeItems(items) { return Object.freeze(items.map((item) => Object.freeze(item))); }
function category(pathValue) {
  const relative = normalizePath(pathValue);
  if (TEST_PATH.test(relative)) return 'tests';
  if (CONFIG_PATH.test(relative)) return 'configs';
  if (DOC_PATH.test(relative)) return 'docs';
  return 'sources';
}

function matchesAllowed(relative, allowedPaths) {
  const value = normalizePath(relative);
  return allowedPaths.some((raw) => {
    const rule = normalizePath(raw);
    if (!rule || rule === '**' || rule === '*') return true;
    if (!rule.includes('*')) return value === rule;
    const prefix = rule.split('*')[0].replace(/\/$/, '');
    return !prefix || value === prefix || value.startsWith(`${prefix}/`);
  });
}

function missingInformation(objective) {
  const text = String(objective ?? '').trim();
  const items = [];
  if (text.length < 8) items.push({ code: 'OBJECTIVE_TOO_SHORT', field: 'objective', prompt: 'Describe the concrete outcome and affected behavior.' });
  if (VAGUE.test(text)) items.push({ code: 'OBJECTIVE_AMBIGUOUS', field: 'objective', prompt: 'Replace vague placeholders with the specific outcome, files, behavior, or failure to address.' });
  return items;
}

function riskFor(task) {
  const text = `${task.title ?? ''} ${task.objective ?? ''}`.toLowerCase();
  const reasons = [];
  let score = 0;
  if ((task.allowedPaths ?? []).includes('**')) { score += 2; reasons.push('broad-write-scope'); }
  if (/security|auth|permission|secret|credential|database|migration|deploy|network|sandbox|git|conflict/.test(text)) { score += 2; reasons.push('sensitive-domain'); }
  if (task.role === 'builder' || task.role === 'integrator') { score += 2; reasons.push('mutating-role'); }
  if ((task.dependencies ?? []).length > 2) { score += 1; reasons.push('dependency-fan-in'); }
  const level = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return Object.freeze({ level, reasons: Object.freeze(reasons) });
}

function toolsFor(task) {
  const list = ROLE_TOOLS[task.role] ?? ['fs.search', 'fs.read'];
  return Object.freeze([...new Set(list)].filter((tool) => KNOWN_TOOLS.has(tool)));
}

function evidenceProjection(item) {
  return Object.freeze({ path: item.path, sha256: item.sha256, score: Number(item.score ?? 0), language: item.language ?? 'text' });
}

function scopeFrom(evidence) {
  const sourceCount = evidence.sources.length;
  const supportCount = evidence.tests.length + evidence.configs.length + evidence.docs.length;
  const score = sourceCount * 2 + Math.min(6, supportCount);
  const band = score <= 6 ? 'small' : score <= 18 ? 'medium' : 'large';
  const min = Math.max(1, Math.min(sourceCount || 1, band === 'small' ? 2 : band === 'medium' ? 4 : 8));
  const max = Math.max(min, Math.min(64, sourceCount + Math.ceil(supportCount / 2) || 1));
  const confidence = sourceCount >= 3 && supportCount >= 2 ? 'high' : sourceCount || supportCount ? 'medium' : 'low';
  return Object.freeze({ band, estimatedFiles: Object.freeze({ min, max }), confidence, evidenceCount: sourceCount + supportCount });
}

function summarize(evidence) {
  const top = [...evidence.sources, ...evidence.tests, ...evidence.configs, ...evidence.docs]
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 8)
    .map((item) => item.path);
  return Object.freeze({
    sources: evidence.sources.length,
    tests: evidence.tests.length,
    configs: evidence.configs.length,
    docs: evidence.docs.length,
    topPaths: Object.freeze(top),
  });
}

export class PlanningEvidenceGovernanceService {
  constructor({ store, repositoryIndex, maxSteps = 12, maxEvidencePerKind = 8 } = {}) {
    if (!store?.getProject || !store?.appendEvent) throw new TypeError('PlanningEvidenceGovernanceService store is required');
    if (!repositoryIndex?.index || !repositoryIndex?.search) throw new TypeError('PlanningEvidenceGovernanceService repositoryIndex is required');
    this.store = store;
    this.repositoryIndex = repositoryIndex;
    this.maxSteps = boundedInteger(maxSteps, 12, 1, 32, 'maxSteps');
    this.maxEvidencePerKind = boundedInteger(maxEvidencePerKind, 8, 1, 32, 'maxEvidencePerKind');
  }

  async preflight({ projectId, objective, changedPaths = [] } = {}) {
    const project = this.store.getProject(required(projectId, 'projectId'));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const cleanObjective = required(objective, 'objective');
    await this.repositoryIndex.index(project);
    const searchResult = await this.repositoryIndex.search(project.id, cleanObjective, { limit: 200, changedPaths });
    const ranked = Array.isArray(searchResult) ? searchResult : Array.isArray(searchResult?.items) ? searchResult.items : [];
    const rankedByPath = new Map(ranked.map((item) => [normalizePath(item.path), item]));
    const rows = this.store.db.prepare('SELECT path,sha256,language FROM repository_files WHERE project_id=? ORDER BY path').all(project.id);
    const buckets = { tests: [], configs: [], docs: [], sources: [] };
    for (const row of rows) {
      const relative = normalizePath(row.path);
      if (SECRETISH.test(relative)) continue;
      const rankedItem = rankedByPath.get(relative);
      const kind = category(relative);
      if (!rankedItem && kind === 'sources') continue;
      buckets[kind].push(evidenceProjection(rankedItem ?? { ...row, score: 1 }));
    }
    for (const key of Object.keys(buckets)) {
      buckets[key] = freezeItems(buckets[key].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, this.maxEvidencePerKind));
    }
    const evidence = Object.freeze(buckets);
    const missing = freezeItems(missingInformation(cleanObjective));
    const scope = scopeFrom(evidence);
    const summary = summarize(evidence);
    const status = missing.length ? 'needs-input' : 'ready';
    const base = {
      schema: 'forge.planning-evidence-preflight.v1',
      projectId: project.id,
      objective: cleanObjective,
      status,
      missingInformation: missing,
      inputRequest: status === 'needs-input' ? Object.freeze({ required: true, question: 'What specific outcome, affected behavior, and success condition should the plan target?', fields: Object.freeze([...new Set(missing.map((item) => item.field))]) }) : null,
      scope,
      evidence,
      summary,
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  enrichPlan({ preflight, plan } = {}) {
    if (!preflight?.projectId || !preflight?.receiptSha256) throw new TypeError('planning preflight is required');
    if (preflight.status !== 'ready') throw new Error('Planning input is incomplete; request user input before enrichment');
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.tasks)) throw new TypeError('plan.tasks is required');
    if (plan.tasks.length < 1 || plan.tasks.length > this.maxSteps) throw new Error(`Plan detail must contain between 1 and ${this.maxSteps} steps`);
    const sourcePaths = preflight.evidence.sources.map((item) => item.path);
    const evidenceRefs = Object.freeze({
      tests: Object.freeze(preflight.evidence.tests.map((item) => item.path)),
      configs: Object.freeze(preflight.evidence.configs.map((item) => item.path)),
      docs: Object.freeze(preflight.evidence.docs.map((item) => item.path)),
    });
    const tasks = plan.tasks.map((raw, index) => {
      const task = structuredClone(raw);
      const objective = required(task.objective, `task ${index + 1} objective`);
      const title = required(task.title, `task ${index + 1} title`);
      if (objective.length < 12 || title.length < 6 || VAGUE.test(`${title} ${objective}`)) throw new Error(`Plan step ${task.id ?? index + 1} is ambiguous or vague`);
      const allowedPaths = Array.isArray(task.allowedPaths) && task.allowedPaths.length ? task.allowedPaths.map(String) : ['**'];
      const explicit = allowedPaths.filter((item) => !item.includes('*')).map(normalizePath);
      const related = sourcePaths.filter((item) => matchesAllowed(item, allowedPaths));
      const expectedFiles = Object.freeze([...new Set([...explicit, ...related])].slice(0, this.maxEvidencePerKind));
      if ((task.role === 'builder' || task.role === 'integrator') && expectedFiles.length === 0 && !allowedPaths.includes('**')) throw new Error(`Plan step ${task.id ?? index + 1} has no evidence-bound expected files`);
      return Object.freeze({
        ...task,
        title,
        objective,
        allowedPaths: Object.freeze(allowedPaths),
        risk: riskFor(task),
        expectedFiles,
        requiredTools: toolsFor(task),
        subagent: Object.freeze({ required: task.role === 'reviewer' || task.role === 'integrator', role: task.role === 'reviewer' ? 'reviewer' : task.role === 'integrator' ? 'integrator' : null }),
        evidence: evidenceRefs,
      });
    });
    const base = {
      schema: 'forge.planning-evidence-plan.v1',
      projectId: preflight.projectId,
      summary: String(plan.summary ?? '').trim(),
      preflightReceiptSha256: preflight.receiptSha256,
      scope: preflight.scope,
      evidenceSummary: preflight.summary,
      tasks: Object.freeze(tasks),
    };
    return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
  }

  recordRevision({ projectId, previousPlan, nextPlan, reason } = {}) {
    const project = this.store.getProject(required(projectId, 'projectId'));
    if (!project) throw new Error(`Unknown project: ${projectId}`);
    const cleanReason = required(reason, 'plan revision reason');
    if (!previousPlan?.receiptSha256) throw new TypeError('previousPlan receipt is required');
    if (!nextPlan || typeof nextPlan !== 'object') throw new TypeError('nextPlan is required');
    const previousReceiptSha256 = String(previousPlan.receiptSha256);
    const nextReceiptSha256 = canonicalSha256(nextPlan);
    const base = {
      schema: 'forge.planning-evidence-revision.v1',
      projectId: project.id,
      reason: cleanReason,
      previousReceiptSha256,
      nextReceiptSha256,
      changedSummary: String(previousPlan.summary ?? '') !== String(nextPlan.summary ?? ''),
      previousStepCount: Array.isArray(previousPlan.tasks) ? previousPlan.tasks.length : 0,
      nextStepCount: Array.isArray(nextPlan.tasks) ? nextPlan.tasks.length : 0,
    };
    const result = Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.store.appendEvent(createEvent('planning.plan.revised', { ...result }, { projectId: project.id }));
    return result;
  }
}
