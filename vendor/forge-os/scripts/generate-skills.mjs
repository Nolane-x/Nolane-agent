import { rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CORE_SKILLS, DOMAIN_SKILLS, PACK_STAGE, PACK_METHOD } from '../config/skill-definitions.mjs';
import { SKILL_OVERRIDES } from '../config/skill-overrides.mjs';

const title = (slug) => slug.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
const action = (slug) => slug.replaceAll('-', ' ');
const packInput = {
  kernel: ['project-state','gate-state'], research: ['confirmed-brief','research-questions'], creativity: ['creative-brief','research-synthesis'],
  product: ['selected-concept','product-evidence'], ux: ['product-definition','user-workflows'], architecture: ['product-definition','quality-attributes'],
  planning: ['verified-specification','acceptance-contracts'], implementation: ['implementation-task','failing-test'], quality: ['implemented-increment','acceptance-contracts'],
  security: ['system-boundaries','threat-context'], operations: ['verified-build','deployment-context'], meta: ['behavioral-baseline','candidate-change'],
};
const packOutput = {
  kernel: 'routing-decision', research: 'research-evidence', creativity: 'creative-artifact', product: 'product-decision', ux: 'ux-contract', architecture: 'architecture-decision',
  planning: 'execution-plan', implementation: 'verified-increment', quality: 'quality-evidence', security: 'security-finding-set', operations: 'operations-evidence', meta: 'skill-utility-report',
};
const DOMAIN_METHOD = [
  'Read the confirmed product definition, domain context, assurance profile, and active findings.',
  'Identify the domain objects, actors, state transitions, regulations, provider boundaries, and operational constraints owned by this skill.',
  'Model normal, boundary, failure, recovery, permission, concurrency, migration, and abuse behavior before implementation.',
  'Define stable contracts and explicit non-goals; do not leak domain concerns into unrelated modules.',
  'Create executable acceptance, negative, resilience, and compatibility checks proportional to risk.',
  'Publish the domain artifact, evidence packet, unresolved assumptions, and downstream invalidations.',
];
const assurance = (pack, kind) => kind === 'domain' || pack === 'security' || pack === 'quality' ? ['A0','A1','A2','A3','A4'] : ['A0','A1','A2','A3'];

function genericMethod(name, pack, domain) {
  const objective = action(name);
  const scope = domain ? `${domain} product boundaries` : `${pack} lifecycle boundaries`;
  return {
    focus: `${objective} within ${scope}`,
    source: 'generated-specific',
    steps: [
      `Define the exact decision, actors, objects, states, invariants, side effects, and non-goals owned by ${objective}.`,
      `Build a decision table for normal, boundary, invalid, permission, failure, retry, recovery, concurrency, migration, and abuse conditions relevant to ${objective}.`,
      `Apply ${objective} only to direct input artifacts; record assumptions, rejected alternatives, and any human decision still required.`,
      `Trace the resulting contract to user value, security, reliability, cost, operability, and downstream consumers.`,
      `Create reproducible checks that would fail if ${objective} were incomplete or implemented incorrectly.`,
    ],
    verification: [
      `Does the artifact make the owned decision for ${objective} explicit and bounded?`,
      'Are failure, recovery, permissions, concurrency, and irreversible side effects addressed where applicable?',
      'Can every load-bearing claim be traced to a confirmed fact, direct artifact, executable check, or declared assumption?',
      'Would a downstream agent know exactly what changed, what remains open, and what must be invalidated?',
    ],
    evidence: [`${name}-decision-table`, `${name}-verification-report`, `${name}-handoff-envelope`],
    traps: [`treating ${objective} as a naming exercise`, 'covering only the happy path', 'creating extension points without a current contract or consumer'],
  };
}

function referencePath(pack, kind, domain) {
  return kind === 'domain' ? `skills/references/domains/${domain}.md` : `skills/references/core/${pack}.md`;
}

function definition(name, pack, kind, domain = 'all') {
  const objective = action(name);
  const stages = kind === 'domain'
    ? ['product-definition','ux-design','architecture','planning','implementation','verification','release-readiness']
    : PACK_STAGE[pack];
  const consumes = kind === 'domain' ? ['domain-context','product-definition'] : packInput[pack];
  const produces = [`${name}-artifact`, kind === 'domain' ? 'domain-evidence' : packOutput[pack] ?? 'verified-artifact'];
  const method = SKILL_OVERRIDES[name] ?? genericMethod(name, pack, kind === 'domain' ? domain : null);
  const base = kind === 'domain' ? DOMAIN_METHOD : (PACK_METHOD[pack] ?? PACK_METHOD.meta);
  const procedure = [base[0], base[1], ...method.steps, ...base.slice(2)];
  const reviewerRole = pack === 'security' ? 'security-reviewer' : pack === 'quality' ? 'quality-reviewer' : kind === 'domain' ? `${domain}-reviewer` : 'independent-reviewer';
  return {
    name, version: '0.1.0', kind, pack, domain: kind === 'domain' ? domain : null, status: name === 'using-forge-os' ? 'stable' : 'candidate',
    stages, domains: kind === 'domain' ? [domain] : ['all'],
    consumes, produces, preconditions: ['intent.confirmed'], invalidates: [`downstream:${produces[0]}`], tools: [],
    assurance: assurance(pack, kind), conflicts: [], reference: referencePath(pack, kind, domain), method, procedure,
    gate: {
      reviewerRole,
      rules: [
        `The output directly and completely performs ${objective} within its declared boundary.`,
        ...method.verification,
        'Every material claim is traceable to an input, decision, executable check, or evidence item.',
        'Required fields are complete and machine-readable.',
        'The producing agent is not the approving reviewer.',
        'Open uncertainty and residual risk are explicit; critical findings are never hidden by an aggregate score.',
      ],
      passCondition: 'All mandatory rules pass, evidence targets the current artifact hash, and no unresolved critical finding applies.',
    },
    handoff: {
      next: 'router-selected',
      requiredEvidence: ['contract-validation','independent-review',...method.evidence],
      requiredFields: ['artifactId','schemaVersion','sha256','producingSkill','producingAgent','consumedArtifacts','decisionIds','evidenceIds','residualRisks','validationState','invalidationTargets','stopCondition'],
      stopWhen: 'Output contract is satisfied, a blocker is recorded, or a material human decision is required.',
    },
    context: { estimatedTokens: method.source === 'flagship' ? 900 : kind === 'domain' ? 760 : 700, maxArtifacts: 8, maxReferenceDepth: 1, verbosity: 'domain-precise' },
    failureModes: [...new Set(['guessing a material requirement','producing prose without the contracted artifact','self-approving the output','expanding scope without a decision record',...method.traps])],
  };
}

function description(d) {
  const scope = d.kind === 'domain' ? `${d.domain} product work` : `${d.pack} work`;
  return `Use when ${action(d.name)} is required during ${scope}, especially when the result must be traceable, independently reviewable, and safe to hand to another agent.`;
}

function markdown(d) {
  const root = d.name === 'using-forge-os';
  const methodSteps = d.method.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  const procedure = d.procedure.map((step, i) => `${i + 1}. ${step}`).join('\n');
  const verification = d.method.verification.map((item) => `- ${item}`).join('\n');
  const evidence = d.method.evidence.map((item) => `- \`${item}\``).join('\n');
  const rules = d.gate.rules.map((rule) => `- ${rule}`).join('\n');
  const failures = d.failureModes.map((item) => `- ${item}`).join('\n');
  const router = root ? `\n## Skill Graph Router\n\n1. Read project stage, domain, assurance profile, available tools, verified artifact hashes, active findings, and confirmed human decisions.\n2. Load metadata only; do not preload every skill body.\n3. Compute missing gate artifacts and hard-exclude quarantined, deprecated, conflicting, tool-incompatible, assurance-incompatible, and precondition-incomplete skills.\n4. Rank eligible skills by state match, artifact need, domain fit, assurance fit, historical utility, and context cost.\n5. Activate the smallest non-conflicting set that can produce the next gate-required evidence.\n6. Persist inclusion and exclusion reasons, context estimate, invalidation impact, and stop condition.\n7. Stop when the gate passes, a blocker is recorded, or a human decision is required.\n\n## Artifact Handoff\n\nEvery handoff is a typed envelope containing artifact IDs, schema versions, content hashes, producing skill and agent, consumed artifacts, decision IDs, evidence IDs, residual risks, validation state, invalidation targets, and stop condition. Free-form summaries are supplemental and never the source of truth.\n` : '';
  return `---
name: ${d.name}
description: "${description(d)}"
license: MIT
compatibility: "ForgeOS-compatible Agent Skills hosts; no provider-specific model required."
metadata:
  author: forgeos-community
  version: "${d.version}"
  pack: ${d.pack}
  kind: ${d.kind}
  status: ${d.status}
---

# ${title(d.name)}

## Overview

This skill owns one bounded responsibility: **${action(d.name)}**. Its focus is ${d.method.focus}. It converts declared inputs into typed artifacts and reproducible evidence without silently changing product scope.

## Trigger

Activate only when the project is in one of these stages: ${d.stages.map((s) => `\`${s}\``).join(', ')}, all contract preconditions pass, and the router identifies a missing output this skill can produce. Do not activate merely because the skill name resembles the user request.

## Required Inputs

${d.consumes.map((item) => `- \`${item}\``).join('\n')}
- Current gate result, open findings, artifact hashes, and invalidation state
- Confirmed human decisions relevant to this scope

## Method-Specific Protocol

${methodSteps}

## Procedure

${procedure}
${router}
## Verification Questions

${verification}

## Evidence Packet

Produce or reference all applicable evidence:

${evidence}

Evidence must identify the current artifact hash, command or method used, result, reviewer identity, timestamp, and limitations.

## Output Contract

Produce:
${d.produces.map((item) => `- \`${item}\``).join('\n')}

The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.

## Quality Gate

Reviewer: \`${d.gate.reviewerRole}\`

${rules}

Pass only when: ${d.gate.passCondition}

## Forbidden Shortcuts

- Do not infer a material requirement that the user has not confirmed.
- Do not replace a typed artifact with a long explanation.
- Do not approve work produced by the same agent identity.
- Do not hide a critical failure behind a high aggregate score.
- Do not load unrelated project history, files, references, or skill bodies.
- Do not mark evidence complete when it targets a different artifact hash or version.

## Failure Modes

${failures}

## Escalation and Invalidation

Stop and request a human decision when scope, risk acceptance, irreversible action, cost ceiling, privacy boundary, or product direction is materially ambiguous. When this artifact changes, invalidate only descendants named by the artifact graph; preserve unaffected verified branches.

## Handoff

- Next skill: \`${d.handoff.next}\`, selected by the graph router rather than hard-coded sequence.
- Required evidence: ${d.handoff.requiredEvidence.map((item) => `\`${item}\``).join(', ')}.
- Required envelope fields: ${d.handoff.requiredFields.map((item) => `\`${item}\``).join(', ')}.
- Stop condition: ${d.handoff.stopWhen}

## Token and Context Policy

Load at most ${d.context.maxArtifacts} direct artifacts and reference depth ${d.context.maxReferenceDepth}. Use stable IDs, hashes, signatures, and deltas instead of repeating full history. Use established domain terminology, state each requirement once, and spend context on decisions, code, tests, or evidence rather than narration.

## Reference Playbook

Load [${d.reference}](${path.relative(path.dirname(d.kind === 'core' ? `skills/core/${d.pack}/${d.name}/SKILL.md` : `skills/domains/${d.domain}/${d.name}/SKILL.md`), d.reference).replaceAll('\\','/')}) only when this skill needs pack-wide decision tables, evidence patterns, or cross-skill handoff rules.

See \`contract.json\` for the machine-readable contract.
`;
}

function referenceMarkdown(name, kind, names) {
  const label = title(name);
  const lifecycle = kind === 'core' ? (PACK_STAGE[name] ?? []).join(' → ') : 'product-definition → ux-design → architecture → planning → implementation → verification → release-readiness';
  return `# ${label} ${kind === 'core' ? 'Core Pack' : 'Domain Pack'} Playbook

This reference is loaded on demand by ForgeOS skills. It does not replace the selected skill's contract.

## Pack boundary

- Lifecycle coverage: ${lifecycle || 'cross-lifecycle'}
- Skills: ${names.map((item) => `\`${item}\``).join(', ')}
- Source of truth: typed artifacts, confirmed decisions, current hashes, findings, and evidence—not conversational memory.

## Decision discipline

For every owned decision, record the problem, constraints, alternatives, selected option, rejected options, assumptions, verification method, expiry condition, downstream consumers, and invalidation targets.

## State coverage matrix

Review normal, empty, boundary, invalid, unauthorized, duplicated, reordered, delayed, concurrent, partial-failure, dependency-failure, retry, cancellation, recovery, migration, rollback, abuse, and observability behavior whenever applicable.

## Evidence hierarchy

1. Executable deterministic checks against the current artifact hash.
2. Independent review and adversarial cases.
3. Primary or authoritative external evidence with freshness metadata.
4. Structured analysis with explicit assumptions.
5. Narrative explanation only as supporting context.

## Cross-skill bridge

A producer publishes a typed handoff envelope. The router validates inputs before activating the consumer. Upstream changes invalidate only graph descendants. Reviewers do not modify worker output; they open findings. Gatekeepers return only pass, fail, or blocked with rule IDs and evidence.

## Token discipline

Load direct dependencies first. Retrieve references, source excerpts, code symbols, and historical decisions by stable ID on demand. Do not preload this entire pack or repeat unchanged artifacts.
`;
}

const root = path.resolve('skills');
await rm(root, { recursive: true, force: true });
const definitions = [];
for (const [pack, names] of Object.entries(CORE_SKILLS)) definitions.push(...names.map((name) => definition(name, pack, 'core')));
for (const [domain, names] of Object.entries(DOMAIN_SKILLS)) definitions.push(...names.map((name) => definition(name, 'domain', 'domain', domain)));

for (const d of definitions) {
  const folder = d.kind === 'core' ? path.join(root, 'core', d.pack, d.name) : path.join(root, 'domains', d.domain, d.name);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'SKILL.md'), markdown(d), 'utf8');
  await writeFile(path.join(folder, 'contract.json'), `${JSON.stringify(d, null, 2)}\n`, 'utf8');
}
for (const [pack, names] of Object.entries(CORE_SKILLS)) {
  const file = path.join(root, 'references', 'core', `${pack}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, referenceMarkdown(pack, 'core', names));
}
for (const [domain, names] of Object.entries(DOMAIN_SKILLS)) {
  const file = path.join(root, 'references', 'domains', `${domain}.md`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, referenceMarkdown(domain, 'domain', names));
}
await writeFile(path.join(root, 'catalog.json'), `${JSON.stringify(definitions, null, 2)}\n`, 'utf8');
console.log(`Generated ${definitions.length} ForgeOS skills and ${Object.keys(CORE_SKILLS).length + Object.keys(DOMAIN_SKILLS).length} reference playbooks.`);
