# Forge Studio 2.29.0 — Release Notes

Forge Studio 2.29.0 introduces a bounded World Development Plane. It selects domain world models using reliability and cost, decides when simulation is worth its resource cost, compares counterfactual candidates, falls back to real probes, and validates predictions against observed receipts. The same lazy plane maintains a verified self-model and sandbox-only developmental curriculum.

## Delivered

- WorldModelRegistry, ForesightController, CounterfactualSimulator and SimulationReceiptLedger.
- VerifiedSelfModel with domain capability, limits, permissions, stale evidence, tool trust and responsibility.
- DevelopmentalGoalEngine with ZPD, learning-progress scoring, teacher challenge labels and novelty/mission guards.
- DevelopmentalStageController with autonomy ceilings, metaplasticity, future-self, rollback, held-out transfer, regression and human-policy gates.
- Lazy DecisionPlane integration with no direct `app.mjs` imports.
- Two mandatory release gates: `world-model-portfolio` and `developmental-agent-learning`.

## Honest boundaries

Simulation is not observed evidence. World models cannot commit files, execute commands or write durable memory. Developmental policy remains shadow-only. No AGI or competitor-superiority claim is made.

See `docs/feature-audit-2.29.0.json`, `docs/REMAINING-GAPS-2.29.0.md`, and `docs/LIMITATIONS-2.29.0.md`.
