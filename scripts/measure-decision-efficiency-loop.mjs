import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalSha256 } from '../vendor/forge-os/src/core/canonical-json.mjs';
import { createEvidenceCard } from '../src/context/evidence-card.mjs';
import { selectEvidence } from '../src/context/context-utility-selector.mjs';
import { TokenCostAdapter } from '../src/context/token-cost-adapter.mjs';
import { ContextEscalationController } from '../src/context/context-escalation-controller.mjs';
import { DecisionPlane } from '../src/decision/decision-plane.mjs';

function verificationReceipt({ taskId, criterionId, sourceHash, status = 'pass' }) {
  const base = { schema: 'forge.acceptance-criterion-verification.v1', taskId, criterionId, status, sourceHash, verifier: 'decision-efficiency-measurement' };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

export async function measureDecisionEfficiencyLoop({ rootDirectory = process.cwd(), version } = {}) {
  const root = path.resolve(rootDirectory);
  const releaseVersion = String(version ?? JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  let tick = 1_722_000_000_000;
  const plane = new DecisionPlane({
    clock: () => ++tick,
    tokenizers: { 'measurement-code-tokenizer': { count: async (text) => Math.max(1, String(text).trim().split(/\s+/).filter(Boolean).length) } },
    limits: { maxDecisionReceipts: 20, maxDecisionEfficiencyEntries: 20 },
  });
  const taskId = 'decision-efficiency-measurement-task';
  const criteria = [
    { criterionId: 'root-cause-fixed', description: 'Root cause is fixed', weight: 4, sourceHash: canonicalSha256({ criterion: 1 }) },
    { criterionId: 'regression-safe', description: 'Existing behavior remains valid', weight: 3, sourceHash: canonicalSha256({ criterion: 2 }) },
    { criterionId: 'counter-evidence-reviewed', description: 'Counter evidence is reviewed', weight: 2, sourceHash: canonicalSha256({ criterion: 3 }) },
  ];
  plane.registerTaskCriteria(taskId, criteria);

  const make = (name, tokenCost, extra = {}) => ({
    ...createEvidenceCard({ source: extra.source ?? 'test', path: `tests/${name}.test.mjs`, symbol: extra.symbol ?? name, startLine: 1, endLine: 20, sourceHash: canonicalSha256({ name }), currentHash: canonicalSha256({ name }), branch: 'feat/2.20', worktree: 'measurement', claim: extra.claim ?? name, trust: extra.trust ?? 0.95, supports: extra.supports ?? [], contradicts: extra.contradicts ?? [], tokenCost, tokenCostMethod: 'measurement-code-tokenizer', text: `${name} verified evidence` }),
    relevance: extra.relevance ?? 0.95,
    decisionImpact: extra.decisionImpact ?? 0.95,
    coverage: extra.coverage ?? 0.9,
    polarity: extra.polarity,
  });
  const cards = [
    make('root-cause', 90, { supports: ['h-root', 'root-cause-fixed'], claim: 'Targeted test proves the root cause is gone' }),
    make('regression', 80, { supports: ['regression-safe'], claim: 'Impacted regression test remains green' }),
    make('counter', 70, { contradicts: ['h-alternative'], supports: ['counter-evidence-reviewed'], polarity: 'counter', claim: 'A competing explanation is contradicted' }),
    make('long-duplicate', 900, { source: 'memory', trust: 0.45, relevance: 0.35, decisionImpact: 0.25, coverage: 0.2, claim: 'Verbose duplicate history' }),
    make('irrelevant', 700, { source: 'conversation', trust: 0.3, relevance: 0.15, decisionImpact: 0.1, coverage: 0.1, claim: 'Unrelated historical discussion' }),
  ];
  const baselineTokens = cards.reduce((sum, item) => sum + item.tokenCost, 0);
  const selection = selectEvidence(cards, { budgetTokens: 400, counterEvidenceRatio: 0.2, minMarginalUtility: 0.001 });
  const selectedSupports = new Set(selection.selected.flatMap((item) => item.supports ?? []));
  for (const criterion of criteria) {
    if (!selectedSupports.has(criterion.criterionId)) throw new Error(`measurement selection did not preserve criterion ${criterion.criterionId}`);
    plane.recordCriterionVerification(taskId, criterion.criterionId, verificationReceipt({ taskId, criterionId: criterion.criterionId, sourceHash: criterion.sourceHash }));
  }
  const criterionSnapshot = plane.criterionSnapshot(taskId);
  const tokenAdapter = new TokenCostAdapter({ tokenizers: { 'measurement-code-tokenizer': { count: async (text) => Math.max(1, String(text).trim().split(/\s+/).filter(Boolean).length) } } });
  const tokenizer = await tokenAdapter.count('one two three four five', { tokenizerId: 'measurement-code-tokenizer' });
  const escalation = new ContextEscalationController();
  const initial = escalation.start();
  const expanded = escalation.evaluate(initial, { confidence: 0.42, unresolvedHypotheses: ['h-alternative'] });
  const efficiency = plane.recordEfficiency({ taskId, providerId: 'measurement-provider', taskKind: 'bugfix', criterionSnapshot, inputTokens: 700, outputTokens: 180, contextTokensSelected: selection.usedTokens, contextTokensActuallyUseful: selection.usedTokens, rssMbSeconds: 180, changedLines: 8, changedFiles: 1, semanticFootprint: 3, correctionCycles: 0, revertedLines: 0, humanInterventions: 0, firstPatchPassed: true, observedAtMs: ++tick });
  const decision = plane.createReceipt({ decisionId: 'decision-measurement-1', taskId, goal: 'Fix the root cause with the smallest verified context', hypotheses: [{ id: 'h-root', confidence: 0.91, claim: 'The targeted branch causes the failure' }, { id: 'h-alternative', confidence: 0.09, claim: 'The environment alone causes the failure' }], evidenceUsed: selection.selected.filter((item) => !item.contradicts?.length).map((item) => item.evidenceId), counterEvidenceUsed: selection.selected.filter((item) => item.contradicts?.length).map((item) => item.evidenceId), alternativesRejected: [{ action: 'Read the whole repository', reason: 'Lower utility per token' }], selectedAction: 'Apply the bounded verified patch', expectedImpact: ['root-cause-fixed'], actualImpact: ['root-cause-fixed', 'regression-safe'], patchMetrics: { files: 1, changedLines: 8, semanticFootprint: 3, revertedLines: 0 }, verification: { targetedTests: 'passed', impactedTests: 'passed', verifiedCriterionIds: criteria.map((item) => item.criterionId) }, resourceCost: { inputTokens: 700, outputTokens: 180, contextTokens: selection.usedTokens, rssMbSeconds: 180, elapsedMs: 50 }, criterionSnapshot, createdAtMs: ++tick });

  const privateBase = { decisionId: 'private-probe', taskId, goal: 'privacy probe', hypotheses: [{ id: 'h', confidence: 1, claim: 'probe' }], evidenceUsed: ['ev-probe'], selectedAction: 'probe', patchMetrics: {}, verification: { verifiedCriterionIds: [] }, resourceCost: {}, createdAtMs: ++tick };
  let rawPromptRejected = false; let modelOutputRejected = false;
  try { plane.createReceipt({ ...privateBase, rawPrompt: 'PRIVATE' }); } catch { rawPromptRejected = true; }
  try { plane.createReceipt({ ...privateBase, modelOutput: 'PRIVATE' }); } catch { modelOutputRejected = true; }
  const snapshot = plane.snapshot();
  const app = await readFile(path.join(root, 'src/app.mjs'), 'utf8');
  const reportBase = {
    schema: 'forge.studio.decision-efficiency-loop-measurement.v1',
    version: releaseVersion,
    criteria: { totalCriteriaWeight: criterionSnapshot.totalCriteriaWeight, verifiedCriteriaScore: criterionSnapshot.verifiedCriteriaScore, completionRatio: criterionSnapshot.completionRatio, receiptSha256: criterionSnapshot.receiptSha256 },
    context: { baselineTokens, selectedTokens: selection.usedTokens, reductionPercent: Number(((1 - selection.usedTokens / baselineTokens) * 100).toFixed(3)), selectedEvidenceIds: selection.selected.map((item) => item.evidenceId), omittedCount: selection.omissions.length, counterEvidenceIncluded: selection.counterEvidenceTokens > 0, verifiedCriteriaPreserved: criteria.every((item) => selectedSupports.has(item.criterionId)), selectionReceiptSha256: canonicalSha256(selection) },
    tokenizer,
    escalation: { initialStage: initial.stage, initialBudgetTokens: initial.budgetTokens, action: expanded.action, nextStage: expanded.nextState?.stage ?? null, nextBudgetTokens: expanded.nextState?.budgetTokens ?? null },
    efficiency: { verifiedValue: efficiency.verifiedValue, tokenYield: efficiency.tokenYield, memoryYield: efficiency.memoryYield, editYield: efficiency.editYield, contextTokensSelected: efficiency.contextTokensSelected, contextTokensActuallyUseful: efficiency.contextTokensActuallyUseful, receiptSha256: efficiency.receiptSha256 },
    decision: { decisionId: decision.decisionId, evidenceCount: decision.evidenceUsed.length, counterEvidenceCount: decision.counterEvidenceUsed.length, verifiedCriterionIds: decision.verification.verifiedCriterionIds, receiptSha256: decision.receiptSha256 },
    privacy: { rawPromptRejected, modelOutputRejected, rawPrivatePayloadStored: JSON.stringify(snapshot).includes('PRIVATE') },
    ui: { decisionProjectionPresent: (await readFile(path.join(root, 'ui/evidence-runtime-center.js'), 'utf8')).includes('Decision Efficiency'), boundedRecentDecisions: 100 },
    composition: { appStaticImports: (app.match(/^import\s.+$/gm) ?? []).length, appConstructors: (app.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*/g) ?? []).length },
    boundaries: { learnedContextPolicyClaimed: false, automaticRouterChangeClaimed: false, comparativeSuperiorityClaimed: false, realRepositoryBenchmarkClaimed: false },
  };
  return Object.freeze({ ...reportBase, receiptSha256: canonicalSha256(reportBase) });
}

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const output = path.resolve(root, process.argv[3] ?? `docs/decision-efficiency-loop-measurement-${metadata.version}.json`);
  const report = await measureDecisionEfficiencyLoop({ rootDirectory: root, version: metadata.version });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ output: path.relative(root, output).replaceAll('\\', '/'), receiptSha256: report.receiptSha256 })}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
