# Forge Studio 2.16.0 release

## Adaptive Runtime Microkernel

This release responds to an adversarial review of startup weight, memory pressure, event polling, UI rendering and release size. It reduces eager application composition without replacing the proven mission, policy, tool, evidence or completion cores.

### Added

- Runtime profiles: Lite, Balanced, Performance and automatic selection by total system memory.
- System-resource sampler and pressure/brownout/emergency policies based on available host memory.
- Runtime module lifecycle: unloaded, loading, active, idle, suspended and unloaded.
- On-demand enterprise/cloud module with lazy OIDC, SCIM, queue, sandbox and autoscaling stores.
- Event-driven durable SSE with five-second reconciliation and fifteen-second heartbeat.
- Runtime-driven UI reduced-effects policy and 30 FPS terminal batching in constrained states.
- Separate verified NolaneNative optional pack and lean Core source/desktop/update artifacts.
- Required Full Release Matrix gate `adaptive-microkernel`.

### Measured source movement

- `src/app.mjs` static imports: 171 → 157.
- `src/app.mjs` constructor expressions: 192 → 177.
- Five enterprise/cloud SQLite files are absent after ordinary local startup and appear only after first enterprise/cloud activation.
- NolaneNative archive removed from Core artifacts: 67,431,284 source bytes moved to an optional pack.
- SSE durable-store polling changed from four queries per second per client to event push plus slow reconciliation.

### Audit

The 790-item audit remains 734 verified source+test, 0 partial, 56 external gate and 0 not implemented. This release improves architecture and operational behavior behind already-covered requirements; it does not invent checklist movement.
