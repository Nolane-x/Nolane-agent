# Novelty Forge Design Specification

## Mission

Novelty Forge is a provider-neutral creativity-to-production operating system for AI agents. It converts a user's intent into differentiated concepts, lets the user select one, and then drives the selected concept through product specification, implementation planning, construction, evidence-based verification, and release readiness.

## Non-negotiable properties

1. User intent is recorded explicitly; the agent must not invent material requirements.
2. Divergence and evaluation are separate stages.
3. Ideas are compared by mechanisms, not names or wording.
4. Every stage transition is guarded by machine-readable evidence.
5. A selected idea can immediately become a product specification and implementation plan.
6. The same core works through ChatGPT MCP Apps, Claude Code plugins, Agent Skills clients, A2A agents, and generic MCP clients.
7. Output uses domain terminology and concise structured artifacts rather than conversational filler.
8. Code and architecture optimize for extension, small modules, stable contracts, and observable state.
9. Verification covers contracts, features, security, cost risk, UX, regressions, and release evidence.
10. The system never claims 100% or 99.99% defect freedom; it reports measured evidence and residual risk.

## Architecture

### Forge Core

A deterministic, provider-neutral state machine manages projects, artifacts, ideas, scores, gates, and evidence. The core has no LLM dependency. Models reason through skills and call core tools.

### Skill System

Thirty Agent Skills form an ordered workflow. Each skill has a narrow trigger, required inputs, outputs, forbidden shortcuts, quality gate, and handoff contract. The root skill selects the next skill from project state.

### Protocol Layer

- MCP Streamable HTTP endpoint at `/mcp` for ChatGPT and generic MCP clients.
- MCP app resource `ui://novelty-forge/dashboard-v1` for an interactive ChatGPT widget.
- A2A Agent Card at `/.well-known/agent-card.json` and JSON-RPC endpoint at `/a2a`.
- Agent Skills-compatible `skills/*/SKILL.md` bundle.
- Claude Code manifest, commands, agents, and `.mcp.json` template.
- Adapter manifests and installation guidance for Codex, OpenCode, Cursor, Windsurf, Cline, Roo Code, Continue, Gemini CLI, and custom agents.

## Workflow states

`intent -> brief -> research -> divergence -> synthesis -> selection -> specification -> plan -> build -> verification -> release`

A stage may advance only when its gate passes. Gates return `pass`, `fail`, or `blocked`, a numeric score, failed rules, and required remediation.

## Project contract

Each project stores:

- immutable project ID and timestamps,
- current stage and transition history,
- user-confirmed intent answers,
- creative brief,
- candidate ideas and fingerprints,
- scorecards and pairwise decisions,
- selected idea,
- versioned artifacts,
- evidence records,
- gate results,
- residual risks.

## Idea contract

An idea contains a title, thesis, target user, hidden problem, mechanism, interface, value model, distribution path, assumptions, closest known pattern, meaningful differences, cheapest experiment, failure modes, and an idea fingerprint.

## Gate model

Every gate uses observable rules. Examples:

- Intent gate: required questions answered and explicit confirmation recorded.
- Divergence gate: minimum number of mechanism-distinct clusters and no forbidden-solution leakage.
- Selection gate: novelty, usefulness, feasibility, evidence quality, and pairwise preference recorded.
- Specification gate: core capabilities, non-goals, user journeys, interfaces, data model, extension points, and failure behavior complete.
- Build gate: planned tasks mapped to commits or artifacts; no skipped acceptance criteria.
- Verification gate: tests, security review, cost-risk review, UX evidence, and residual-risk report present.
- Release gate: all critical findings closed or explicitly accepted by the user.

## ChatGPT app experience

The widget shows project stage, gate status, idea cards, score vectors, artifact timeline, evidence, and the next recommended action. UI actions call MCP tools. The server also works tool-only when the host does not support widgets.

## Security model

- Strict JSON input validation and bounded payload sizes.
- Path traversal prevention and project ID validation.
- Atomic file persistence.
- Read-only/destructive annotations match tool behavior.
- No shell execution from tool arguments.
- No secrets stored in project artifacts.
- Explicit confirmation before release-affecting or external write actions.
- Content rendered in the widget is escaped and treated as untrusted.

## Verification strategy

- Unit tests for stages, contracts, scoring, gates, persistence, and security.
- Protocol tests for MCP and A2A request/response contracts.
- Workflow integration tests from intent through release.
- Property-style randomized tests for malformed payloads and transition invariants.
- Skill linter for frontmatter, trigger quality, handoffs, forbidden shortcuts, and gate sections.
- Static adapter validation.
- Browser smoke test and screenshot evidence for the dashboard.
- Behavioral eval case set for cross-model regression runs when providers are available.

## Initial release boundary

Version 0.1.0 provides a fully runnable local MCP/A2A server, interactive dashboard, deterministic project engine, 30 skill documents, adapter templates, tests, and documentation. It does not autonomously call paid models; the connected host model executes the skills and uses the tools.
