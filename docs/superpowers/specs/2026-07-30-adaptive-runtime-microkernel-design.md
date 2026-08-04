# Forge Studio Adaptive Runtime Microkernel Design

## Goal

Make Forge Studio safe and responsive for an 8 GB local machine without removing advanced capability. Optional capability must activate on demand, yield under system pressure, and leave durable evidence of lifecycle decisions.

## Scope

Forge Studio 2.16.0 implements:

1. runtime profiles: `auto`, `lite`, `balanced`, `performance`;
2. a system-aware resource governor with `emergency` state;
3. an adaptive module manager with explicit lifecycle;
4. event-driven SSE backed by durable SQLite catch-up;
5. renderer performance policy for motion/blur/live graphs;
6. optional release packs, beginning with NolaneNative;
7. current architecture/security inventories and adversarial matrix receipts.

It does not claim to complete dynamic swarm, remote PR/CI, polyglot grammar fleets, deterministic review coverage, or browser journey verification.

## Runtime profiles

`auto` resolves from total system memory unless explicitly overridden:

- `lite`: total memory <= 12 GiB;
- `balanced`: >12 GiB and <=24 GiB;
- `performance`: >24 GiB.

Lite defaults: one agent, two terminals, four editor models, 256 KiB terminal frame, 512 KiB terminal queue, 2,000 in-memory events, 256 KiB tool output, no background indexing, zero idle browser sessions, reduced effects.

Balanced defaults: two agents, four terminals, eight editor models, 512 KiB terminal frame, 1 MiB queue, 5,000 events, 512 KiB tool output, incremental indexing, one browser session.

Performance defaults: four agents, six terminals, sixteen editor models, 1 MiB terminal frame, 2 MiB queue, 10,000 events, 1 MiB tool output, background indexing, two browser sessions.

Explicit numeric overrides remain authoritative.

## System-aware resource states

Metrics include process RSS, event-loop delay, queues/output, total system memory, available system memory and available ratio.

States:

- `normal`;
- `pressure`;
- `brownout`;
- `emergency`.

Emergency disables new agents, background indexing, previews and browser activation; reduces terminal/editor limits; requests optional modules to suspend; coalesces output; and emits a durable transition receipt. Recovery requires hysteresis.

## Module lifecycle

Each optional module descriptor declares:

- id and dependencies;
- profiles in which it may auto-activate;
- estimated idle memory;
- activate/suspend/resume/unload callbacks;
- idle timeout;
- whether unloading is reversible.

States are `unloaded`, `loading`, `active`, `idle`, `suspended`, `failed`. Activation is single-flight. Circular dependencies and activation during emergency fail closed. Lifecycle events carry canonical SHA-256 receipts.

2.16.0 must prove real lazy construction for the enterprise/cloud module and optional NolaneNative vendor/runtime pack. Other capabilities may register lifecycle hooks without claiming their JavaScript source is no longer parsed.

## Durable event hub

`StudioStore.appendEvent()` persists first, then publishes the committed event through an in-process event hub. SSE clients perform one database catch-up, subscribe to pushes, receive periodic comment heartbeats, and run a slow reconciliation catch-up rather than a 250 ms poll. Backpressure closes a client instead of accumulating unbounded data.

## UI performance policy

The backend exposes profile and governor state. The renderer applies profile classes and respects `prefers-reduced-motion`. Lite/pressure/brownout/emergency disable backdrop blur, animated backgrounds and live graph animation. The activity feed must remain bounded.

## Packaging

The source and portable core no longer require the embedded NolaneNative archive. Release tooling produces a separate NolaneNative pack with provenance and SHA-256. Runtime reports NolaneNative unavailable until the pack is installed; absence is not an application startup failure.

## Testing

TDD covers profile resolution, emergency transitions, module lifecycle/single-flight/failure, lazy enterprise activation, event push and reconciliation, renderer policy, optional NolaneNative packaging, version/document coherence, startup/RSS receipts and full release reconstruction.
