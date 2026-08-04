# Mission State & Progress Ledger 2.2.0 Design

## Goal

Create one server-owned, receipt-bound state projection that reports mission identity, repository identity, completion criteria, hypotheses, verification state, cost, sandbox, approvals, subagents, and actual progress without trusting model-authored status text.

## Architecture

`MissionStateProgressService` reads only durable Forge sources: StudioStore missions/tasks/runs/events/evidence/interrupts, environment supervisor public state, and capability approval records. It normalizes those sources into a bounded snapshot and calculates progress from distinct completed/verified milestones rather than tool-call count. Cost limits are enforced by a separate `assertWithinCostLimit` boundary before another provider action is admitted.

The service exposes authenticated project/mission APIs and a lazy Mission State Center UI. Every snapshot and cost decision has a canonical SHA-256 receipt. No prompts, hidden reasoning, environment values, raw credentials, absolute paths, or unrestricted metadata are returned.

## State contract

The snapshot contains:

- authenticated user ID;
- repository ID derived from project ID and repository fingerprint, never the absolute workspace path;
- mission/task IDs and statuses;
- task-contract completion criteria;
- bounded hypotheses from structured plan/replanning events;
- tests run, passed, and still failing from verification evidence;
- accumulated token and USD usage;
- configured cost limit and remaining allowance;
- sandbox state from the environment supervisor public view;
- pending/approved/denied approval state;
- subagent tasks grouped by role and state;
- progress milestones, progress epoch, duplicate/no-progress indicators, and a deterministic status.

## Progress semantics

A progress milestone is accepted only when backed by a new durable fingerprint: task transition, passing verification receipt, new artifact receipt, accepted review, or completed checkpoint. Repeated tool calls or repeated identical errors do not increase progress. `stalled` is reported when activity continues without a new milestone beyond the configured threshold.

## Cost semantics

Cost is summed from structured run/evidence usage. A mission can define `costLimitUsd` in metadata or task contract. The service fails closed before another paid action when the projected cost would exceed the limit. Unknown cost does not become zero-confidence success; it is reported separately.

## UI

Mission State Center is lazy-loaded and shows identity, completion criteria, hypotheses, verification matrix, cost meter, sandbox, approvals, subagents, and progress timeline. It is read-only except for existing approval links; state changes remain server-owned.

## Verification

TDD covers projection, progress fingerprints, cost enforcement, redaction, API principal binding, app wiring, UI, audit evidence, release verifier, source reconstruction, and a complete Full Release Matrix run.
