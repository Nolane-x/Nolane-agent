# NUI v10 host-sidecar design

## Purpose

Integrate Nolane UI Intelligence into Nolane-agent as a cognition/control contract without copying NUI's canonical skill graph and without giving NUI authority over host sandbox, approvals, tool policy, filesystem, browser, network, MCP or image permissions.

The reviewed upstream is `Nolane-x/Nolane-UI-Intelligence@719981b7a2cf0e8406672d20ce1840e7a26ef5b8`. The host projection is NUI's `generic-cli` bridge. This matches the upstream rule that one canonical cognition graph is projected through thin host surfaces.

## Boundary

`canonical NUI cognition graph → externally produced bounded projection/task routing → Nolane host sidecar → ContextBuilder → model`

The sidecar is data/control-plane code. It does not spawn NUI, browse, fetch, execute shell commands, change tool permissions, approve actions, or mark material UI work verified. The host remains the only execution authority.

## Bootstrap integrity

Material UI work produces a normalized task profile containing product surface, user job, visual ambition, risk, modalities, platform, evidence capabilities, named sources, hard constraints and unresolved facts. A SHA-256 checksum binds that profile. Any material source-constraint change changes the checksum and invalidates downstream artifacts that rely on the old profile.

Routing produces an auditable ledger: selected owners record their trigger; plausible high-impact inactive owners record why they remain inactive. Material tasks also require an omission declaration. Missing evidence capability is represented as `UNKNOWN`, never promoted to `PASS`.

## Flagship obligations

For `flagship`, `exceptional` or `experiential` work, the host envelope compiles the upstream flagship synthesis gate: at least three materially divergent directions, explicit hierarchy, resolved craft systems, domain-linked signature and restraint, generic-transfer resistance, structural responsive evidence, and at least two closed critique/correction cycles.

Generation has a hard ceiling at `CRITIQUED`. The generator cannot transition itself to `VERIFIED`; independent verification remains required.

## Context integration

`ContextBuilder` accepts an optional, validated `nuiEnvelope` and adds a compact stable-tier directive. This is intentionally outside `agent-loop.mjs`. The directive carries provenance, task checksum, capability boundary, flagship minimums and completion ceiling while the existing execution contract continues to state that model claims are not proof of completion.

## Recovery

Invalid provenance, authority escalation, generator self-certification, missing material route justification or missing omission declaration fail closed before the envelope enters model context. A changed task checksum requires rerouting from the earliest affected lifecycle state rather than silently reusing stale UI decisions.
