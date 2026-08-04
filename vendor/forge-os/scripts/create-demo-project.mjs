import { rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { BlobStore } from '../src/storage/blob-store.mjs';
import { CommandEvidenceProvider, EvidenceProviderRegistry } from '../src/evidence/providers.mjs';

const root = path.resolve(process.argv[2] ?? '.forgeos-demo-data');
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const owner = createPrincipal({ id: 'human:demo-owner', type: 'human', roles: ['owner'], scopes: ['*', 'approve'], trustDomain: 'team:owner' });
const worker = createPrincipal({ id: 'agent:demo-builder', type: 'agent', roles: ['worker'], scopes: ['*'], trustDomain: 'team:build' });
const reviewer = createPrincipal({ id: 'service:demo-reviewer', type: 'service', roles: ['reviewer'], scopes: ['*'], trustDomain: 'team:review' });

const store = new ProjectStore(root);
const evidenceProviders = new EvidenceProviderRegistry({ blobStore: new BlobStore(path.join(root, '.blobs')) });
evidenceProviders.register(new CommandEvidenceProvider({
  id: 'demo-command',
  version: '1.0.0',
  recipes: { pass: { evidenceTypes: ['research-source', 'ux-evidence'], command: [process.execPath, '-e', 'process.stdout.write(\"demo verification receipt\\n\")'] } },
}));
const forge = new ForgeOrchestrator(store, { evidenceProviders });
const project = await forge.createProject({ name: 'Atlas Workflow Compiler', domain: 'developer-tools', assurance: 'A2', metadata: { demo: true } });
const projectId = project.id;

async function gateAndAdvance() {
  const gate = await forge.runCurrentGate(projectId);
  if (gate.status !== 'pass') throw new Error(`Demo gate ${gate.stage} failed: ${gate.failedRules.join(', ')}`);
  await forge.advance(projectId);
}

async function artifact(type, content, { skill, consumes = [] } = {}) {
  let updated = await forge.saveArtifact(projectId, {
    type,
    title: type,
    schemaVersion: '1.0.0',
    content,
    producedBy: { skill: skill ?? 'demo-builder' },
    consumes,
    decisions: [],
    evidence: [],
    residualRisks: [],
  }, { principal: worker });
  let created = updated.artifacts.find((item) => item.type === type && ['draft', 'review', 'verified'].includes(item.state));
  updated = await forge.reviewArtifact(projectId, created.id, { notes: `Independent demo review for ${type}.` }, { principal: reviewer });
  return updated.artifacts.find((item) => item.id === created.id);
}

async function evidence(type, title, summary) {
  return forge.requestEvidence(projectId, {
    providerId: 'demo-command',
    recipeId: 'pass',
    type,
    title,
    metadata: { expectedSummary: summary },
  }, { principal: reviewer });
}

await forge.recordIntent(projectId, {
  goal: 'Turn repeated developer workflows into portable, verified agent skills.',
  audience: 'Small engineering teams operating multiple AI coding agents.',
  constraints: ['Provider-neutral', 'Local-first state', 'Independent verification', 'No hidden autonomous execution'],
  success: ['Compile one repeated workflow into a reusable skill with passing behavioral evidence'],
  nonGoals: ['Generic chatbot', 'Unreviewed shell automation'],
  preferredDomain: 'developer-tools',
  confirmed: true,
});
await gateAndAdvance();

await artifact('problem-discovery', { problem: 'Valuable operating knowledge disappears inside successful human-agent conversations.' }, { skill: 'extracting-user-pain' });
await gateAndAdvance();

await artifact('research-synthesis', { findings: ['Trace segmentation, typed contracts, and replay evidence form a falsifiable compilation pipeline.'] }, { skill: 'synthesizing-product-evidence' });
await evidence('research-source', 'Prior-art comparison', 'Compared process mining, macro recorders, workflow engines, and portable Agent Skills packaging.');
await gateAndAdvance();

const ideas = [
  { id: 'trace-compiler', title: 'Trace-to-Skill Compiler', thesis: 'Compile successful human-agent traces into typed skills and require replay evidence before activation.', targetUser: 'engineering teams using multiple coding agents', hiddenProblem: 'successful operating knowledge disappears inside chat history', mechanism: 'segment traces, extract invariants, compile contracts, and replay behavior in a fresh workspace', interface: 'timeline diff and skill graph', valueModel: 'repeatable delivery with reviewable provenance', distribution: 'open protocol adapter and repository plugin', assumptions: ['agent traces are exportable'], closestPattern: 'process mining and macro recording', differences: ['extracts semantic invariants rather than clicks', 'emits portable skill contracts'], cheapestExperiment: 'compile one dependency-upgrade trace and replay it in a fresh repository', failureModes: ['overfitting to one repository'] },
  { id: 'counterfactual-ci', title: 'Counterfactual CI', thesis: 'Generate the smallest plausible worlds in which a change fails and execute the highest-risk worlds first.', targetUser: 'teams with expensive integration suites', hiddenProblem: 'known-path tests miss changing failure surfaces', mechanism: 'map a diff to risk dependencies and synthesize executable counterfactual environments', interface: 'pull-request risk map', valueModel: 'fewer escaped failures per CI minute', distribution: 'CI app and local CLI', assumptions: ['dependencies are traceable'], closestPattern: 'impact analysis', differences: ['generates executable failure worlds', 'budgets tests by residual risk'], cheapestExperiment: 'run against ten historical regressions', failureModes: ['incorrect dependency graph'] },
  { id: 'drift-radar', title: 'Architecture Drift Radar', thesis: 'Detect when small local changes collectively invalidate an architectural decision.', targetUser: 'maintainers of fast-moving repositories', hiddenProblem: 'architecture erosion is noticed after coupling becomes expensive', mechanism: 'link decisions to symbols and accumulate semantic drift against explicit thresholds', interface: 'repository topology radar', valueModel: 'earlier low-cost correction', distribution: 'IDE and CI integration', assumptions: ['decisions can be recorded'], closestPattern: 'static architecture tests', differences: ['tracks decision provenance', 'measures cumulative drift'], cheapestExperiment: 'map three architecture decisions to one repository history', failureModes: ['noisy symbol mapping'] },
  { id: 'proof-budgeter', title: 'Proof Budgeter', thesis: 'Allocate verification effort to the claims with the largest unproven downside.', targetUser: 'small teams shipping agent-built products', hiddenProblem: 'teams spend test time evenly while risk is uneven', mechanism: 'convert requirements, financial exposure, and change impact into an evidence-budget optimization problem', interface: 'claim-to-proof ledger', valueModel: 'higher assurance per engineering hour', distribution: 'ForgeOS policy pack and CI service', assumptions: ['risk can be estimated comparatively'], closestPattern: 'risk-based testing', differences: ['binds budget to individual product claims', 'tracks proof freshness by revision'], cheapestExperiment: 're-rank one release test plan and compare escaped-risk coverage', failureModes: ['bad impact estimates'] },
  { id: 'agent-black-box', title: 'Agent Flight Recorder', thesis: 'Capture enough causal state to replay and explain an agent failure without storing the entire conversation.', targetUser: 'operators of private multi-agent systems', hiddenProblem: 'full logs are expensive and sensitive while sparse logs are not reproducible', mechanism: 'record typed decisions, artifact hashes, tool boundaries, and state deltas as a minimal causal trace', interface: 'incident replay console', valueModel: 'faster debugging with less retained sensitive data', distribution: 'runtime SDK and OpenTelemetry exporter', assumptions: ['critical boundaries are instrumentable'], closestPattern: 'flight recorder and distributed tracing', differences: ['stores semantic state deltas', 'replays agent decisions against exact artifacts'], cheapestExperiment: 'reproduce three historical tool-use failures from causal traces', failureModes: ['missing a causal boundary'] },
];
await forge.saveIdeas(projectId, ideas);
await gateAndAdvance();

await forge.scoreIdeas(projectId, ideas.map((idea, index) => ({
  ideaId: idea.id,
  novelty: 84 + index,
  usefulness: 90 - index,
  feasibility: 78 - index,
  leverage: 88,
  defensibility: 80,
  testability: 84,
  clarity: 86,
  evidence: 72,
})), { principal: reviewer, rubricVersion: 'creativity-v2' });
await gateAndAdvance();

const approval = await forge.requestApproval(projectId, 'select-idea:trace-compiler', { principal: owner, ttlMs: 60_000 });
await forge.selectIdea(projectId, 'trace-compiler', 'Highest combined leverage, portability, and falsifiable implementation path.', { principal: owner, approvalToken: approval.token });
await gateAndAdvance();

const thesis = await artifact('product-thesis', { thesis: 'Compile repeated agent work into verified portable skills.' }, { skill: 'defining-product-thesis' });
await artifact('capability-map', { capabilities: ['trace capture', 'invariant extraction', 'contract compiler', 'behavior replay', 'candidate registry'] }, { skill: 'defining-minimum-viable-product', consumes: [thesis.id] });
await gateAndAdvance();

await artifact('ux-contract', { journeys: ['Select trace', 'Inspect invariants', 'Edit contract', 'Run replay', 'Publish candidate skill'] }, { skill: 'mapping-user-journeys' });
await evidence('ux-evidence', 'Critical-flow prototype review', 'Trace selection, invariant review, contract editing, replay, and publishing were evaluated as one critical flow.');
await gateAndAdvance();

await forge.addFinding(projectId, {
  title: 'Trace redaction policy needs an organization override',
  severity: 'medium',
  category: 'privacy',
  description: 'Default secret screening needs organization-specific sensitive-data patterns before production use.',
}, { principal: reviewer });
await forge.routeNextSkills(projectId, { tools: ['filesystem', 'tests', 'browser'], targets: ['architecture-decision', 'threat-model'] });

console.log(projectId);
