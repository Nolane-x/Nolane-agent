# Forge Studio 2.0.0 release notes

## Agent Modes & Autonomy Profiles

Forge Studio 2.0.0 adds twenty canonical operating modes whose boundaries are enforced by the runtime rather than described only in prompts.

Each mode defines read/write access, approval policy, network policy, local-provider requirements, background permission, commit policy, child-agent permission, required capabilities, admitted and denied tool groups, routing mode, turn/task/token/context limits, and verification depth.

The mode resolver accepts only narrowing overrides. A caller may lower budgets, deny network access, disable child agents, remove tools or capabilities, and make commit or approval policy stricter. It cannot add permissions or raise a built-in limit.

## Runtime integration

- Mission creation resolves one canonical mode policy and receipt.
- Every planned task inherits the same mode identifier, policy, and receipt.
- The autonomy broker denies actions outside the mode at the tool boundary.
- Read-only modes cannot mutate project state.
- Offline mode selects only a healthy local provider and blocks network-dependent installs.
- Allowed tool receipts include the active mode identifier.

## Agent Modes Center

The lazy-loaded Control Center displays all twenty profiles, their tools, capabilities, network and commit rules, autonomy level, budgets, provider constraint, and verification depth. Mission creation uses the authenticated API and the server resolves the policy again before execution.

## Release gate

The Full Release Matrix adds `agent-modes-governance`, which proves the canonical registry, narrowing-only resolver, mission/task propagation, broker enforcement, offline-provider boundary, receipt binding, authenticated API, future UI, tests, and matrix integration.
