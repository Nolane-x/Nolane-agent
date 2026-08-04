# ForgeOS v0.6 Skill System

ForgeOS ships two compatible skill generations:

- **250 Agent Skills v1 folders** preserve broad compatibility and the existing lifecycle catalog, including candidate visual, interactive-3D, physical-product, and physical-AI skills.
- **128 deep Skill Contract v2 techniques** provide section-level loading, anti-triggers, hybrid execution programs, evaluator bindings, policy inheritance, and explicit many-to-many mappings.

The v2 kernel is divided into 32 L0 and 96 L1 techniques. Thirty-three procedural providers are stable; 242 are candidate. Candidate does not mean broken—it means the available evidence is insufficient for stable routing under every supported context. The eight new cross-domain skills are intentionally candidate-only and are not materialized as stable v2 packages.

## Package structure

```text
skills-v2/<tier>/<skill-id>/
├── manifest.json
├── SKILL.md
├── sections/
├── references/
├── evaluators/
└── scripts/          # never auto-executed during materialization
```

Each section has a digest and token accounting record. Shared constraints live in versioned policy profiles. A package must have a method-specific procedure, failure model, verification, evaluator fixtures, and RED baseline evidence; generated prose alone is not accepted.

## Hybrid execution

A technique may declare deterministic nodes, agent nodes, reflection nodes, joins, gates, retry, and rollback. Rules and hooks enforce what can be encoded mechanically. Skills are reserved for conditional judgment. Agent roles are separate authority/context boundaries.

## Contribution gate

A new technique needs precise discovery metadata, anti-triggers, typed artifacts, explicit tools, independent evaluation, depth and boilerplate audits, token/materialization tests, and a maturity decision. Stable or certified status cannot be assigned by the author.

See [Skill Intelligence](SKILL-INTELLIGENCE.md), [Deterministic Fabric](DETERMINISTIC-SKILL-FABRIC-V06.md), and [Contributing](../CONTRIBUTING.md).
