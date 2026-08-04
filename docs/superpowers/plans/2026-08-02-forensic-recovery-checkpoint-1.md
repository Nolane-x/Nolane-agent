# Forensic Recovery Checkpoint 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed forensic verification foundation that inventories Nolane at symbol level, records unavailable NolaneNative evidence honestly, removes VerifierMesh fail-open behavior, audits UI v3 against the master plan, and publishes a reproducible recovery checkpoint.

**Architecture:** Add a bounded `src/forensics/` subsystem with deterministic archive classification, source custody, symbol extraction, provisional NolaneNative-ledger import, and a strict truth ledger. Reuse existing release/evidence infrastructure but add a new checkpoint gate that cannot pass complete parity when canonical NolaneNative bytes or real-environment receipts are missing.

**Tech Stack:** Node.js ESM, built-in `node:test`, `crypto`, `fs`, `path`, `zlib`, system `unzip`/`tar` through the existing process runner where needed, current JavaScript parser dependencies already present in the repository, JSON/JSONL/CSV/Markdown evidence outputs.

## Global Constraints

- No requirement is verified because a file merely exists.
- No `docs/*` file may be a production entrypoint.
- Every newly implemented behavior uses RED → GREEN → refactor.
- Missing NolaneNative source bytes must remain `upstream-source-unavailable`; they may not be inferred as parity.
- A verifier without a callable evaluator may not be registered.
- Verifier exceptions, invalid decisions, abstentions, or missing observations may never default to pass.
- Mocks prove protocol shape only; they do not prove provider/platform behavior.
- Complete parity, comparative superiority, Windows certification, and provider-real certification remain false.
- Generated outputs are deterministic and content-addressed.
- The official product version is not promoted by this recovery checkpoint.

---

## File map

### New production modules

- `src/forensics/source-custody.mjs` — immutable source/artifact identity and availability records.
- `src/forensics/archive-classifier.mjs` — deterministic entry classification.
- `src/forensics/archive-decomposer.mjs` — archive inventory, nested-archive detection, fair size totals.
- `src/forensics/stable-id.mjs` — stable IDs for files, symbols, surfaces, and mappings.
- `src/forensics/symbol-inventory/javascript-symbol-extractor.mjs` — JS/TS functions, classes, methods, exports, commands, routes, events, schemas, config keys, and UI actions.
- `src/forensics/symbol-inventory/repository-symbol-inventory.mjs` — repository traversal and aggregate inventory.
- `src/forensics/nolane-native-ledger-importer.mjs` — imports historical transformation JSONL as provisional upstream records.
- `src/forensics/truth-ledger.mjs` — strict mapping states and parity blockers.
- `src/forensics/evidence-quality-auditor.mjs` — assertion-level evidence rules and reuse limits.
- `src/forensics/ui-v3-gap-auditor.mjs` — master-plan implementation/gap registry.
- `src/forensics/recovery-claim-policy.mjs` — frozen claim flags and unlock conditions.

### New scripts

- `scripts/generate-forensic-source-custody.mjs`
- `scripts/decompose-source-archives.mjs`
- `scripts/generate-symbol-surface-inventory.mjs`
- `scripts/generate-forensic-truth-ledger.mjs`
- `scripts/audit-forensic-evidence-quality.mjs`
- `scripts/audit-ui-v3-master-plan-gaps.mjs`
- `scripts/verify-forensic-recovery-checkpoint-1.mjs`
- `scripts/package-forensic-recovery-checkpoint-1.mjs`

### New generated evidence

- `requirements/forensic-source-custody.json`
- `requirements/nolane-symbol-surface-inventory.jsonl`
- `requirements/nolane-native-provisional-source-inventory.jsonl`
- `requirements/nolane-native-function-parity-ledger.jsonl`
- `requirements/ui-v3-master-plan-gap-registry.json`
- `docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md`
- `docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json`

### Tests

- `tests/forensic-source-custody.test.mjs`
- `tests/forensic-archive-decomposer.test.mjs`
- `tests/forensic-symbol-inventory.test.mjs`
- `tests/forensic-nolane-native-ledger-importer.test.mjs`
- `tests/forensic-truth-ledger.test.mjs`
- `tests/forensic-evidence-quality.test.mjs`
- `tests/small-model-verifier-mesh-fail-closed.test.mjs`
- `tests/forensic-ui-v3-gap-audit.test.mjs`
- `tests/forensic-recovery-checkpoint-1.test.mjs`

---

### Task 1: Freeze claims and establish source custody

**Files:**
- Create: `src/forensics/source-custody.mjs`
- Create: `src/forensics/recovery-claim-policy.mjs`
- Create: `scripts/generate-forensic-source-custody.mjs`
- Create: `tests/forensic-source-custody.test.mjs`
- Create: `requirements/forensic-source-custody.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `createSourceCustodyRecord({ id, kind, path, expectedSha256, expectedBytes, origin, required })`.
- Produces: `verifySourceCustodyRecord(record, { root })` returning `{ status, actualSha256, actualBytes, blocker }`.
- Produces: `evaluateRecoveryClaims({ custody, truthLedger, uiAudit, externalReceipts })` returning all protected claims as booleans plus blocker arrays.

- [ ] **Step 1: Write the failing custody tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceCustodyRecord, verifySourceCustodyRecord } from '../src/forensics/source-custody.mjs';
import { evaluateRecoveryClaims } from '../src/forensics/recovery-claim-policy.mjs';

test('required missing upstream source becomes an explicit blocker', async () => {
  const record = createSourceCustodyRecord({
    id: 'nolane-native-canonical', kind: 'upstream-source', path: 'missing.zip',
    expectedSha256: '1ac5fcb20630d6556f6169cb836dda73298b2371f7c0a6ed23bcc5d6eaf41cd9',
    expectedBytes: 67431284, origin: 'historical-manifest', required: true,
  });
  const result = await verifySourceCustodyRecord(record, { root: process.cwd() });
  assert.equal(result.status, 'missing');
  assert.match(result.blocker, /canonical upstream source/i);
});

test('recovery claims remain locked without canonical upstream and external receipts', () => {
  const claims = evaluateRecoveryClaims({ custody: [{ id: 'nolane-native-canonical', status: 'missing' }], truthLedger: [], uiAudit: {}, externalReceipts: [] });
  assert.equal(claims.completeParityClaimAllowed, false);
  assert.equal(claims.comparativeSuperiorityClaimAllowed, false);
  assert.equal(claims.windowsUiCertified, false);
  assert.equal(claims.providerRealCertified, false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/forensic-source-custody.test.mjs`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement immutable custody records and claim policy**

The implementation must validate SHA-256 format, non-negative byte counts, and explicit origin. Missing required files return `status: 'missing'`; hash or size mismatch returns `status: 'mismatch'`; neither condition may throw away the blocker record.

- [ ] **Step 4: Add generator script and package commands**

Add:

```json
"forensics:custody": "node scripts/generate-forensic-source-custody.mjs"
```

The generator records the current repository HEAD, source tree root, available forensic audit artifacts, and the expected canonical NolaneNative archive identity from historical manifests. It must not claim the archive exists when only a manifest exists.

- [ ] **Step 5: Run tests and generator**

Run: `node --test tests/forensic-source-custody.test.mjs && npm run forensics:custody`
Expected: PASS; generated JSON includes a missing/unavailable NolaneNative canonical-source blocker if the archive is absent.

- [ ] **Step 6: Commit**

```bash
git add src/forensics/source-custody.mjs src/forensics/recovery-claim-policy.mjs scripts/generate-forensic-source-custody.mjs tests/forensic-source-custody.test.mjs requirements/forensic-source-custody.json package.json
git commit -m "feat(forensics): freeze claims and establish source custody"
```

### Task 2: Decompose and classify every available archive entry

**Files:**
- Create: `src/forensics/archive-classifier.mjs`
- Create: `src/forensics/archive-decomposer.mjs`
- Create: `scripts/decompose-source-archives.mjs`
- Create: `tests/forensic-archive-decomposer.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `classifyArchiveEntry({ path, bytes, mode, magic })` returning one of `production-source`, `test`, `documentation`, `asset`, `vendor-dependency`, `generated-data`, `binary-build-output`, `nested-archive`, or `unknown` with reasons.
- Produces: `decomposeArchive({ archivePath, expectedSha256 })` returning entries, duplicate groups, nested archives, category totals, compression totals, and unknown entries.

- [ ] **Step 1: Write failing classification and decomposition tests**

Use a deterministic fixture ZIP containing `src/a.mjs`, `tests/a.test.mjs`, `docs/readme.md`, `assets/logo.png`, `dist/app.exe`, and `nested.zip`. Assert 100% classification, nested-archive detection, compressed/uncompressed totals, and duplicate SHA grouping.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/forensic-archive-decomposer.test.mjs`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement classifier and ZIP/TAR adapters**

Use archive listing metadata without extracting executable files. Normalize paths, reject traversal (`../`, absolute paths, drive prefixes), hash entry bytes, and retain `unknown` rather than guessing.

- [ ] **Step 4: Add decomposition script**

Add:

```json
"forensics:archives": "node scripts/decompose-source-archives.mjs"
```

The script decomposes the current source ZIP when provided by `NOLANE_SOURCE_ARCHIVE`, plus the canonical NolaneNative archive only when `NOLANE_NATIVE_SOURCE_ARCHIVE` exists and its hash matches custody metadata.

- [ ] **Step 5: Verify tests and a real current-source run**

Run: `node --test tests/forensic-archive-decomposer.test.mjs && NOLANE_SOURCE_ARCHIVE=<current-source.zip> npm run forensics:archives`
Expected: PASS; report separates source, tests, docs, assets, vendor, generated, binaries, and nested archives.

- [ ] **Step 6: Commit**

```bash
git add src/forensics/archive-classifier.mjs src/forensics/archive-decomposer.mjs scripts/decompose-source-archives.mjs tests/forensic-archive-decomposer.test.mjs package.json
git commit -m "feat(forensics): decompose and classify source archives"
```

### Task 3: Generate symbol, command, route, schema, config, event, and UI-action inventory

**Files:**
- Create: `src/forensics/stable-id.mjs`
- Create: `src/forensics/symbol-inventory/javascript-symbol-extractor.mjs`
- Create: `src/forensics/symbol-inventory/repository-symbol-inventory.mjs`
- Create: `scripts/generate-symbol-surface-inventory.mjs`
- Create: `tests/forensic-symbol-inventory.test.mjs`
- Create: `requirements/nolane-symbol-surface-inventory.jsonl`
- Modify: `package.json`

**Interfaces:**
- Produces: `stableForensicId(namespace, value)`.
- Produces: `extractJavaScriptSymbols({ sourceText, relativePath, fileSha256 })` returning symbol and surface records.
- Produces: `inventoryRepositorySymbols({ root, include, exclude })` returning files, symbols, surfaces, parse failures, and hashes.

- [ ] **Step 1: Write failing extractor tests**

Fixture source must include exported functions/classes, class methods, an HTTP route registration, command registration, event subscription, schema definition, configuration key, and UI click action. Assert stable IDs and exact line ranges.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/forensic-symbol-inventory.test.mjs`
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement AST extraction and explicit fallback reporting**

The extractor may use the repository’s installed parser, but every parse fallback must be recorded as `parserMode: 'fallback'`. A file with an unrecoverable parse error must appear in `parseFailures` and block complete inventory.

- [ ] **Step 4: Add repository generator**

Add:

```json
"forensics:symbols": "node scripts/generate-symbol-surface-inventory.mjs"
```

Inventory `src/`, `ui/`, `ui-v3/`, `vscode-extension/`, and executable scripts while excluding generated evidence, packaged outputs, dependencies, and vendored upstream code.

- [ ] **Step 5: Run on the real repository and require deterministic output**

Run generator twice and compare SHA-256. Expected: identical bytes; zero silent parse failures; JSONL sorted by stable ID.

- [ ] **Step 6: Commit**

```bash
git add src/forensics/stable-id.mjs src/forensics/symbol-inventory scripts/generate-symbol-surface-inventory.mjs tests/forensic-symbol-inventory.test.mjs requirements/nolane-symbol-surface-inventory.jsonl package.json
git commit -m "feat(forensics): inventory production symbols and surfaces"
```

### Task 4: Import historical NolaneNative entries without fabricating parity

**Files:**
- Create: `src/forensics/nolane-native-ledger-importer.mjs`
- Create: `tests/forensic-nolane-native-ledger-importer.test.mjs`
- Create: `requirements/nolane-native-provisional-source-inventory.jsonl`
- Modify: `scripts/generate-symbol-surface-inventory.mjs`

**Interfaces:**
- Produces: `importNolaneNativeTransformationLedger({ jsonlText, expectedArchiveSha256, canonicalSourceAvailable })`.
- Every record includes `evidenceClass: 'historical-path-ledger'`, `sourceAvailability`, and `allowedParityStates`.

- [ ] **Step 1: Write failing importer tests**

Assert that a historical `status: 'not_implemented'` entry remains unresolved and that `canonicalSourceAvailable: false` restricts allowed states to `upstream-source-unavailable`, `external-unverified`, or `excluded-with-reason`.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/forensic-nolane-native-ledger-importer.test.mjs`
Expected: FAIL because the importer does not exist.

- [ ] **Step 3: Implement strict JSONL validation**

Reject duplicate source-path/hash pairs, archive-hash mismatches, missing source hashes, path traversal, and records that attempt to mark unavailable source as exact parity.

- [ ] **Step 4: Generate provisional inventory from the recovered historical ledger**

The output must clearly state that it is not a function inventory and cannot unlock complete parity.

- [ ] **Step 5: Verify and commit**

```bash
node --test tests/forensic-nolane-native-ledger-importer.test.mjs
git add src/forensics/nolane-native-ledger-importer.mjs tests/forensic-nolane-native-ledger-importer.test.mjs scripts/generate-symbol-surface-inventory.mjs requirements/nolane-native-provisional-source-inventory.jsonl
git commit -m "feat(forensics): import NolaneNative history as provisional evidence"
```

### Task 5: Build the strict counterpart truth ledger and evidence-quality audit

**Files:**
- Create: `src/forensics/truth-ledger.mjs`
- Create: `src/forensics/evidence-quality-auditor.mjs`
- Create: `scripts/generate-forensic-truth-ledger.mjs`
- Create: `scripts/audit-forensic-evidence-quality.mjs`
- Create: `tests/forensic-truth-ledger.test.mjs`
- Create: `tests/forensic-evidence-quality.test.mjs`
- Create: `requirements/nolane-native-function-parity-ledger.jsonl`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateTruthLedgerRecord(record)`.
- Produces: `summarizeTruthLedger(records)`.
- Produces: `auditEvidenceBindings({ requirements, inventory, bindings, policy })`.

- [ ] **Step 1: Write failing ledger tests**

Test duplicate upstream ownership, invalid state transitions, `exact` without upstream bytes, `superset` without compatibility evidence, and `excluded-with-reason` without a concrete exclusion category.

- [ ] **Step 2: Write failing evidence-quality tests**

Test that `docs/*.json` as the only production entrypoint fails, verified behavior without a direct positive assertion fails, safety/error behavior without a negative assertion fails, and one generic test reused beyond the configured bounded threshold is reported as over-broad rather than silently accepted.

- [ ] **Step 3: Run tests and confirm RED**

Run: `node --test tests/forensic-truth-ledger.test.mjs tests/forensic-evidence-quality.test.mjs`
Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement truth ledger and evidence rules**

Default every unmapped provisional NolaneNative entry to `upstream-source-unavailable`. Never infer symbol mappings from similar names. Mapping records require explicit Nolane symbol IDs, tests, production wiring, positive assertions, and negative assertions where the behavior has a failure/safety branch.

- [ ] **Step 5: Add generators and package scripts**

```json
"forensics:truth-ledger": "node scripts/generate-forensic-truth-ledger.mjs",
"forensics:evidence-quality": "node scripts/audit-forensic-evidence-quality.mjs"
```

- [ ] **Step 6: Verify and commit**

```bash
node --test tests/forensic-truth-ledger.test.mjs tests/forensic-evidence-quality.test.mjs
npm run forensics:truth-ledger
npm run forensics:evidence-quality
git add src/forensics/truth-ledger.mjs src/forensics/evidence-quality-auditor.mjs scripts/generate-forensic-truth-ledger.mjs scripts/audit-forensic-evidence-quality.mjs tests/forensic-truth-ledger.test.mjs tests/forensic-evidence-quality.test.mjs requirements/nolane-native-function-parity-ledger.jsonl package.json
git commit -m "feat(forensics): add fail-closed truth and evidence ledgers"
```

### Task 6: Eliminate VerifierMesh fail-open behavior

**Files:**
- Modify: `src/small-model/verifier-mesh.mjs`
- Modify: `tests/small-model-verifier-mesh.test.mjs`
- Create: `tests/small-model-verifier-mesh-fail-closed.test.mjs`

**Interfaces:**
- `register(definition)` requires `typeof definition.evaluate === 'function'`.
- Evaluator output is exactly `{ pass: true|false, ... }`, `{ abstain: true, reason }`, or an evaluator exception converted to `{ error: true, reason }`.
- Aggregate statuses: `pass`, `fail`, `disagreement`, `abstain`, or `error`.

- [ ] **Step 1: Write failing regression tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { VerifierMesh } from '../src/small-model/verifier-mesh.mjs';

test('VerifierMesh refuses a verifier without an evaluator', () => {
  const mesh = new VerifierMesh();
  assert.throws(() => mesh.register({ id: 'missing', soundnessScope: ['unit'], readOnly: true, independent: true }), /evaluate/);
});

test('VerifierMesh converts evaluator failure into error and never pass', async () => {
  const mesh = new VerifierMesh();
  mesh.register({ id: 'broken', soundnessScope: ['unit'], readOnly: true, independent: true, evaluate: async () => { throw new Error('boom'); } });
  const receipt = await mesh.verify({ candidateId: 'c1' });
  assert.equal(receipt.status, 'error');
  assert.equal(receipt.decisions[0].pass, false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/small-model-verifier-mesh-fail-closed.test.mjs`
Expected: first test fails because registration currently succeeds; second fails because errors escape or invalid default behavior persists.

- [ ] **Step 3: Implement the minimal fail-closed behavior**

Remove the `?? { pass: true }` fallback. Normalize evaluator results, require explicit decisions, capture exceptions without leaking secrets, and compute aggregate status conservatively.

- [ ] **Step 4: Update existing tests to register real evaluators**

The existing registration/reliability test must use `evaluate: () => ({ pass: true })`; this preserves its original intent without accepting an incomplete verifier.

- [ ] **Step 5: Run direct and integration regression**

Run:

```bash
node --test tests/small-model-verifier-mesh.test.mjs tests/small-model-verifier-mesh-fail-closed.test.mjs
node --test tests/small-model-foundation*.test.mjs tests/decision-plane*.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/small-model/verifier-mesh.mjs tests/small-model-verifier-mesh.test.mjs tests/small-model-verifier-mesh-fail-closed.test.mjs
git commit -m "fix(verification): make VerifierMesh fail closed"
```

### Task 7: Audit UI v3 against the supplied master plan

**Files:**
- Create: `src/forensics/ui-v3-gap-auditor.mjs`
- Create: `scripts/audit-ui-v3-master-plan-gaps.mjs`
- Create: `tests/forensic-ui-v3-gap-audit.test.mjs`
- Create: `requirements/ui-v3-master-plan-gap-registry.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `auditUiV3MasterPlan({ root, capabilityRegistry, requiredArtifacts, defaultUiVersion })`.
- Status values: `implemented`, `partial`, `missing`, `external-certification`.

- [ ] **Step 1: Write failing gap-audit tests**

Use a fixture tree with one implemented module, one partial surface, one missing worker, and one Windows-only certification item. Assert UI v3 default false is reported and missing files cannot be treated as implementation.

- [ ] **Step 2: Run tests and confirm RED**

Run: `node --test tests/forensic-ui-v3-gap-audit.test.mjs`
Expected: FAIL because the auditor does not exist.

- [ ] **Step 3: Encode the master-plan registry**

Include all 18 master-plan tasks and required architectural artifacts: shell/router/store, session sidebar, mission workspace, approval cards, Artifact Dock, Review & Ship, Workroom split, Control Plane domains, workers, scheduler/visibility policy, performance observer, accessibility scripts, visual regression scripts, release verifier, and Windows 8 GB measurements.

- [ ] **Step 4: Generate the real repository report**

Add:

```json
"forensics:ui-v3-gaps": "node scripts/audit-ui-v3-master-plan-gaps.mjs"
```

The report must distinguish same-purpose implementations at different paths as `partial` until interface/behavior tests prove equivalence.

- [ ] **Step 5: Verify and commit**

```bash
node --test tests/forensic-ui-v3-gap-audit.test.mjs
npm run forensics:ui-v3-gaps
git add src/forensics/ui-v3-gap-auditor.mjs scripts/audit-ui-v3-master-plan-gaps.mjs tests/forensic-ui-v3-gap-audit.test.mjs requirements/ui-v3-master-plan-gap-registry.json package.json
git commit -m "feat(forensics): audit UI v3 against the master plan"
```

### Task 8: Add Checkpoint 1 release gate and package artifacts

**Files:**
- Create: `scripts/verify-forensic-recovery-checkpoint-1.mjs`
- Create: `scripts/package-forensic-recovery-checkpoint-1.mjs`
- Create: `tests/forensic-recovery-checkpoint-1.test.mjs`
- Create: `docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.md`
- Create: `docs/checkpoints/NOLANE-FORENSIC-RECOVERY-CHECKPOINT-1.json`
- Modify: `src/release/full-release-matrix.mjs`
- Modify: `tests/nolane-beta6-release-gates.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `verifyForensicRecoveryCheckpoint1({ custody, symbolInventory, provisionalNolaneNative, truthLedger, evidenceAudit, verifierReceipt, uiAudit, claims })`.
- The gate passes when local recovery infrastructure is complete and all unresolved external/upstream items are explicitly blocking claims; it does not require false parity.

- [ ] **Step 1: Write failing checkpoint test**

Assert the gate rejects missing inventory output, silent parse failures, `exact` mappings without upstream bytes, a passing claim flag, VerifierMesh fail-open behavior, or an absent UI gap registry.

- [ ] **Step 2: Run test and confirm RED**

Run: `node --test tests/forensic-recovery-checkpoint-1.test.mjs`
Expected: FAIL because verifier script/module is missing.

- [ ] **Step 3: Implement deterministic checkpoint verifier and reports**

The Markdown and JSON reports include counts, blockers, claim flags, source hashes, parse failures, over-broad evidence bindings, UI gaps, and next checkpoint entry criteria.

- [ ] **Step 4: Add the required release-matrix gate**

Add one lane named `forensic-recovery-checkpoint-1`. Update the gate-count test by requiring the new lane by name, not only increasing the integer count.

- [ ] **Step 5: Add package commands**

```json
"forensics:checkpoint-1": "node scripts/verify-forensic-recovery-checkpoint-1.mjs",
"package:forensics-checkpoint-1": "node scripts/package-forensic-recovery-checkpoint-1.mjs"
```

Package source, change-set, evidence JSON/JSONL/CSV/Markdown, verification report, manifest, and SHA-256 sums. Do not bundle unavailable NolaneNative bytes.

- [ ] **Step 6: Run targeted checkpoint suite**

```bash
node --test tests/forensic-*.test.mjs tests/small-model-verifier-mesh*.test.mjs
npm run forensics:custody
npm run forensics:symbols
npm run forensics:truth-ledger
npm run forensics:evidence-quality
npm run forensics:ui-v3-gaps
npm run forensics:checkpoint-1
```

Expected: PASS with complete-parity and superiority claims false.

- [ ] **Step 7: Run full regression and release matrix from a clean commit**

```bash
npm test
npm run test:go
npm run release:matrix
```

Expected: all required gates pass. External certification remains unresolved and visible.

- [ ] **Step 8: Commit and package**

```bash
git add scripts/verify-forensic-recovery-checkpoint-1.mjs scripts/package-forensic-recovery-checkpoint-1.mjs tests/forensic-recovery-checkpoint-1.test.mjs docs/checkpoints src/release/full-release-matrix.mjs tests/nolane-beta6-release-gates.test.mjs package.json
git commit -m "feat(recovery): certify forensic checkpoint one"
npm run package:forensics-checkpoint-1
```

---

## Final verification checklist

- [ ] `git diff --check` passes.
- [ ] Git working tree is clean before release matrix.
- [ ] All targeted forensic and verifier tests pass.
- [ ] Full Node, Go, Python/SDK, ForgeOS, packaging, clean-room, reconstruction, and archive-integrity lanes pass where supported by the existing matrix.
- [ ] Generated outputs are byte-identical across two consecutive runs.
- [ ] Every archive passes `unzip -t` or equivalent.
- [ ] SHA-256 manifest validates every delivered artifact.
- [ ] Checkpoint report explicitly states canonical NolaneNative source availability.
- [ ] `completeParityClaimAllowed=false`.
- [ ] `comparativeSuperiorityClaimAllowed=false`.
- [ ] `windowsUiCertified=false` until real receipt exists.
- [ ] `providerRealCertified=false` until real receipt exists.
