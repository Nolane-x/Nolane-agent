# Forge Studio 2.0.0 verification contract

A 2.0.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Agent Modes governance gate

`agent-modes-governance` must prove:

- exactly twenty immutable canonical mode definitions;
- typed policies for approvals, network, commits, tools, capabilities, budgets, child agents, background work, providers, and verification;
- narrowing-only run overrides;
- mission and task policy propagation;
- broker-boundary denial for disallowed state changes and tools;
- local-provider and network denial in offline mode;
- mode identifiers in action receipts;
- authenticated list, resolve, and run APIs;
- lazy-loaded Agent Modes Center;
- inclusion in source reconstruction and release packaging.

## Release evidence

Evidence is written to `release/matrix-2.0.0/` and bound to the exact Git commit. Each gate records status, command, exit code, duration, redacted stdout/stderr digests, log path, and receipt SHA-256.

Every non-verified checklist item must appear exactly once in `REMAINING-GAPS-2.0.0.md` and the machine-readable remaining-gaps report, with status, reason, current evidence, and completion condition.
