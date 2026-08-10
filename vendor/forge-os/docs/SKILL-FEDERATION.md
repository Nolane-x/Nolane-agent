# Skill Federation

ForgeOS does not equate a folder count with expertise. The federation layer separates a typed **capability** from the providers that may satisfy it. A provider can be a first-party Agent Skill, an external pinned skill snapshot, or a reference-only knowledge mapping. Each provider has an immutable digest, source coordinate, license mode, tenant scope, lifecycle status, trust findings, compatibility constraints, materialization policy, and measured utility.

## Admission pipeline

External repositories begin as discovery records. Synchronization resolves an immutable commit, retrieves bounded paths, places the provider in quarantine, and produces a snapshot digest. No archive or script is executed during import. Security scanning checks instruction override, hidden executables, traversal, credential patterns, private network targets, and pipe-to-shell behavior. License policy determines whether content may be vendored, must remain link-only, or is blocked. Evaluation uses the fixed corpus and seed matrix; promotion consumes a trusted receipt from the Eval Store and human federation-admin approval.

## Capability resolution

The resolver first chooses a capability contract, then selects the smallest compatible set of providers: at most one procedural provider, one knowledge provider, and one MCP provider. Stable state, tenant visibility, tool compatibility, current scans, assurance, token budget, conflicts, and measured utility participate in selection. Candidate and quarantined providers are never silently enabled.

An execution bundle freezes capability and provider hashes, source coordinates, evidence obligations, required approvals, token budget, conflict report, and stop conditions. The materializer rechecks every digest and loads only bounded safe text. Scripts remain inert; knowledge remains reference-only; MCP credentials remain secret references.

## Honest coverage

The built-in release contains 275 first-party procedural provider mappings and 1,024 knowledge mappings for 1,024 capability contracts. Only 33 procedural providers are stable. The audit deliberately reports 832 missing procedural providers and 978 missing stable procedural providers. These are contribution targets, not numbers hidden behind knowledge coverage.

## Provider lifecycle

`discovered → quarantined → candidate → stable → deprecated/quarantined`

Every transition is append-only and policy checked. A blocker dominates popularity. A stale source, changed digest, expired scan, quality regression, license change, or adversarial finding can remove a provider from resolution until reevaluated.
