# Checkpoint 11 Complete Delivery Guide

## Important outputs

- Enhanced source tree: this repository.
- Complete catalog: `release/model-intelligence/model-profile-catalog.json`.
- All full dossiers: `release/model-intelligence/model-profile-dossiers.json` and `.md`.
- Statistics and snapshot: `release/model-intelligence/model-profile-statistics.json` and `model-management-snapshot.json`.
- Full release matrix: `release/NolaneAgent-5.0.0-beta.6/full-release-matrix.json` and `.md` after execution.
- Merge and custody information: `release/checkpoint-11/merge-manifest.json` in the packaged delivery.

## Verification commands

```bash
npm run profiles:test
npm run models:manager:test
node scripts/verify-model-intelligence-control-plane.mjs .
npm run models:artifacts
npm run release:matrix
```

## Operational commands

```bash
npm run models:manage -- snapshot
npm run models:manage -- recommend --task large --require coding,toolCalling,structuredOutput
npm run models:manage -- portfolio
npm run models:manage -- dossier --model openai/gpt-5.3-codex --format markdown
```
