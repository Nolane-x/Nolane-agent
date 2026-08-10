# Universal ForgeOS Lanes

ForgeOS has a machine-validated registry of 12 lanes spanning strategy and research, product/UX/UI, visual media and 3D, software, data/AI, agents, security, operations, commerce, education, hardware manufacturing, and robotics/physical AI.

Use the read-only MCP tool `forge_universal_lanes_list` to inspect every lane's capability domains, native skill IDs, upstream source IDs, and execution boundary. The registry refuses an unknown skill, capability domain, source ID, duplicate lane, or unsupported boundary.

## What lane coverage means

A lane is a truthful routing and governance surface. It does not claim a universal executor or grant new permissions. Each lane declares one of these boundaries:

- `advisory-only`: plans, analysis, and review artifacts only.
- `verified-artifact`: ForgeOS can produce a typed artifact whose checks and evidence are explicitly recorded.
- `human-approved-executor`: any external, production, financial, safety, or physical action needs a separately authorized executor and human approval.

The hardware-and-manufacturing and robotics-and-physical-AI lanes are always `human-approved-executor`. Their native skills produce design, calibration, safety, test, evidence, and rollback artifacts; they do not actuate equipment, purchase components, certify a product, or authorize a field deployment.

## Candidate skills added for cross-domain work

The following original ForgeOS skills are intentionally `candidate`, not stable:

- `designing-production-visual-systems`
- `validating-visual-asset-delivery`
- `designing-interactive-3d-experiences`
- `testing-interactive-3d-performance`
- `engineering-manufacturable-products`
- `validating-physical-product-safety`
- `designing-simulation-to-reality-workflows`
- `testing-physical-ai-deployment-boundaries`

They have typed procedures, verification questions, evidence requirements, and explicit failure modes. Candidate status means they cannot be materialized as stable v2 instructions and are not a claim of independent performance evidence, product certification, or live-device reliability.

## Upstream research and intake

The lane registry records the Agent Skills specification, Vercel Agent Skills, NVIDIA Skills, and existing ForgeOS sources as provenance pointers. Third-party repositories remain discovery-only:

1. A human invokes source synchronization.
2. ForgeOS resolves and records an immutable upstream commit.
3. It retrieves only bounded skill and license paths, then imports providers to quarantine.
4. Static scan, evaluation receipt, and a one-time human promotion are required before a provider is eligible.

No repository script is executed at intake, no unpinned body is auto-activated, and sources with unknown licensing remain link-only. This is especially important for any skill that mentions CAD, GPU runtimes, simulators, or robotics tooling.

The initial research snapshot recorded on 2026-07-28 used the pinned upstream revisions `agentskills/agentskills@38a2ff82958afee88dadf4831509e6f7e9d8ef4e`, `vercel-labs/agent-skills@7c180d9044c9ae2b442b567aad4e42a28dd5ed62`, and `NVIDIA/skills@de4e4498c91a600d12d9155e016012fc7ea80d74`. Refreshing an upstream remains a new discovery event, not a promotion.

## Evidence limits

The registry proves internal references are consistent; it does not prove every skill works in every environment. Stable promotion still needs independent evaluation evidence, and physical systems require qualified engineering, safety review, jurisdiction-specific compliance work, controlled testing, and an accountable human operator.
