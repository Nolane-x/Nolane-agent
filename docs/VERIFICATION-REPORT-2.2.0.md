# Forge Studio 2.2.0 verification contract

A 2.2.0 release is valid only when the complete Full Release Matrix runs from gate 1 on a clean committed tree and every required gate passes.

## Mission-state progress governance gate

`mission-state-progress-governance` must prove:

- authenticated user and stable public repository identity;
- completion criteria and hypothesis projection from durable records;
- test run/pass/fail totals and verification commands;
- token and USD usage accounting;
- projected-cost limit enforcement;
- sanitized sandbox, approval, capability-grant, and subagent state;
- deduplicated durable milestones;
- activity-without-progress detection;
- redaction and content-addressed receipts;
- authenticated principal-bound API;
- application wiring and lazy-loaded Mission State Center;
- inclusion in source reconstruction and release packaging.

Evidence is written to `release/matrix-2.2.0/` and bound to the exact Git commit. Every non-verified checklist item must appear exactly once in `docs/REMAINING-GAPS-2.2.0.md` and the machine-readable remaining-gaps report.
