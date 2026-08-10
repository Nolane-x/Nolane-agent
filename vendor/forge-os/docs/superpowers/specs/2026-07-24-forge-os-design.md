# ForgeOS Design Specification

## Mission

ForgeOS is an open, provider-neutral product-engineering operating system for AI agents. It transforms a confirmed human intent into differentiated ideas, a selected product thesis, a typed product blueprint, an executable implementation graph, verified increments, and a release evidence dossier.

ForgeOS is designed for ChatGPT, Codex, Claude Code, Gemini CLI, OpenCode, Cursor, Cline, Roo Code, Windsurf, Continue, NolaneNative, OpenClaw, and custom agents through open protocols and portable Agent Skills.

## Product promise

ForgeOS does not promise defect-free software. It promises a reproducible process in which every material decision, generated artifact, implementation increment, quality gate, finding, and residual risk is traceable and independently reviewable.

## System boundaries

Version 0.1 provides:

- a deterministic project kernel and artifact graph;
- a risk-aware skill router;
- 146 core skills and 96 domain skills;
- machine-readable contracts for every skill;
- MCP 2025-11-25 compatible JSON-RPC tools and MCP Apps resources;
- A2A 1.0 compatible agent discovery and task exchange subset;
- portable Agent Skills folders;
- adapter manifests and installation instructions for major agent hosts;
- a standalone and ChatGPT-embedded Forge Studio dashboard;
- deterministic validation, security boundary tests, behavioral eval fixtures, and release evidence;
- an MIT-licensed public repository with localized README files.

Version 0.1 does not autonomously call a paid model. The connected host model executes the selected skills and calls ForgeOS tools. Provider adapters may be added without changing the kernel.

## Architectural principles

1. **Human intent before construction.** Material requirements must be confirmed, not inferred.
2. **Typed artifacts over conversational memory.** Skills exchange versioned artifacts with hashes and provenance.
3. **Graph routing over flat skill lists.** Only skills whose preconditions match current state are eligible.
4. **Independent verification.** A worker cannot approve its own artifact.
5. **Evidence before stage advancement.** Gates require machine-readable evidence.
6. **Progressive disclosure.** Skill metadata is indexed globally; full instructions and references load only when selected.
7. **Protocol neutrality.** Core APIs do not depend on OpenAI, Anthropic, Google, or any model vendor.
8. **Risk-proportional assurance.** Test depth is selected from product risk, not from a fixed checklist.
9. **Minimal sufficient implementation.** Code complexity and context growth are constrained by measurable budgets.
10. **Open extension model.** Domain packs, adapters, gates, and evaluators are versioned plug-ins.

## Product layers

### Forge Kernel

Owns projects, stages, decisions, artifacts, evidence, findings, risks, and transition history. Persistence is atomic and all public inputs are validated.

### Forge Graph

Indexes skill contracts, resolves dependencies, computes eligible skills, scores routes, detects conflicts, and invalidates downstream artifacts when an upstream decision changes.

### Forge Skills

Portable Agent Skills organized into kernel, research, creativity, product, UX, architecture, planning, implementation, quality, security, operations, and meta packs.

### Domain Packs

Specialized skills for SaaS, automation, developer tools, browser extensions, games, AI products, data platforms, mobile, desktop, e-commerce, enterprise, and API products.

### Novelty Engine

Separates divergent generation from evaluation; represents ideas as mechanism-level genomes; detects semantic duplicates and fake novelty; preserves useful disagreement until selection.

### Forge Proof

Runs deterministic gates and records test, security, UX, performance, compatibility, deployment, and release evidence. Critical findings cannot be hidden by aggregate scores.

### Forge Bridge

Exposes the same kernel through MCP, A2A, Agent Skills, HTTP, CLI manifests, and platform-specific adapter instructions.

### Forge Studio

Visualizes project state, idea clusters, artifact lineage, skill routing, gate status, findings, evidence, and release readiness. It runs standalone and as an MCP App widget.

### Forge Lab

Contains skill utility benchmarks, creativity cases, product-domain fixtures, router regression tests, and cross-model evaluation contracts.

## Workflow state machine

`intent -> discovery -> research -> divergence -> synthesis -> selection -> product-definition -> ux-design -> architecture -> planning -> implementation -> verification -> release-readiness -> released`

Each transition requires a gate result with `pass`, `fail`, or `blocked`, a score, failed rule IDs, remediation steps, and evidence references.

## Artifact protocol

Every artifact includes:

- stable project-scoped ID;
- type and schema version;
- content hash;
- producing skill and agent identity;
- consumed artifact IDs and decision IDs;
- creation and supersession timestamps;
- validation state;
- gate state;
- evidence references;
- residual risks;
- invalidation relationships.

Artifact states are `draft`, `review`, `verified`, `superseded`, and `invalidated`.

## Skill contract

Every skill folder contains:

- `SKILL.md` compliant with the Agent Skills specification;
- `contract.json` containing pack, version, triggers, inputs, outputs, preconditions, invalidations, tools, assurance level, procedure phases, gate rules, handoff, and token/context policy.

A skill is eligible only when all required inputs exist and all preconditions are satisfied. Router scores include state match, artifact need, domain match, risk match, tool availability, historical utility, context cost, and conflict penalties.

## Skill utility lifecycle

Skill versions move through `experimental`, `candidate`, `stable`, `deprecated`, or `quarantined` states. A skill is quarantined when it repeatedly decreases task success, violates output schemas, increases context without measurable utility, or triggers security policy violations.

## Agent roles and gates

- **Orchestrator:** routes work and records state; does not author product artifacts.
- **Worker:** produces one contracted artifact.
- **Reviewer:** checks contract and domain quality independently.
- **Adversarial reviewer:** searches for failure modes, abuse paths, and hidden assumptions.
- **Gatekeeper:** returns a deterministic gate result; does not edit the artifact.
- **Human decision owner:** confirms intent, selects product direction, accepts material residual risk, and approves irreversible actions.

## Assurance profiles

- `A0 experimental`: prototype and learning evidence.
- `A1 product`: unit, integration, critical-flow E2E, accessibility, dependency and basic security checks.
- `A2 high-trust`: property, mutation, fuzz, load, tenant-isolation, rollback, and independent review requirements.
- `A3 mission-critical`: line-by-line critical-module review, model-based tests, fault injection, migration rehearsal, red team, signed provenance, and canary evidence.
- `A4 regulated`: organization-defined controls and external assurance mapped into Forge Proof policies.

## Security model

- all external inputs are untrusted and size-bounded;
- project IDs and paths are constrained to prevent traversal;
- dangerous object keys are rejected;
- secrets are forbidden in artifacts and UI structured content;
- irreversible actions require explicit human confirmation;
- tools expose accurate read-only, destructive, and idempotency annotations;
- rendered content is escaped and widgets use a restrictive CSP;
- agent output cannot directly invoke shell commands through the protocol layer;
- audit events record actor, tool, target, decision, and result;
- adapter and skill bundles are validated before activation.

## Protocol targets

- MCP stable revision `2025-11-25`, JSON Schema 2020-12, structured tool results, resources, prompts, deterministic tool ordering, and Streamable HTTP-compatible POST handling.
- Forward-compatibility hooks for stateless MCP and extensions without depending on unreleased behavior.
- A2A 1.0 discovery through an Agent Card and JSON-RPC task/message subset.
- Agent Skills directory format with progressive disclosure.
- MCP Apps UI with `text/html;profile=mcp-app`, host feature detection, and standalone fallback.

## Documentation and public release

The repository includes:

- a visually strong English README grounded in implemented behavior;
- localized README files for major developer communities;
- architecture, protocol, adapter, security, contributing, governance, and release documentation;
- MIT License;
- reproducible quickstart commands;
- generated architecture and dashboard visuals;
- a project manifest listing every artifact exposed in the release bundle.

## Acceptance criteria for version 0.1

1. `npm test` exits zero.
2. skill validation confirms exactly 242 unique skills, 146 core and 96 domain.
3. every skill has valid frontmatter and a valid machine-readable contract.
4. router tests prove eligibility, deterministic ordering, conflict handling, and invalidation behavior.
5. MCP tests cover initialize, discovery, resources, prompts, tool calls, structured output, invalid input, and unknown methods.
6. A2A tests cover Agent Card discovery and task/message exchange.
7. dashboard tests cover escaping, accessibility landmarks, host bridge behavior, and standalone rendering.
8. security tests cover traversal, prototype pollution, oversized payloads, injection rendering, and irreversible-action confirmation.
9. behavioral eval fixtures cover at least twelve product domains.
10. a headless browser smoke test captures a real dashboard image.
11. validation, tests, smoke checks, file hashes, and known residual risks are recorded in `evidence/verification-report.json`.
12. the downloadable archive and `project-manifest.json` contain only files created or changed for this release.
