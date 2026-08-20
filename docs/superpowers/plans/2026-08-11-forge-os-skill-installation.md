# Forge OS Skill Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Execution owner:** Codex implements this plan in the current workspace; this document is a verification checklist, not a handoff to Luna or another agent.

**Goal:** Let a user explicitly install a verified Forge OS Skill into the local Nolane Skill library without executing or authorizing it.

**Architecture:** The existing Forge catalogue owns hash-verified upstream reading; a focused installer owns allowlisted, atomic local copying; orchestration exposes the operation; the route requires confirmation; and the existing Skills view owns interaction state. Local copies remain loaded by the local registry with Forge-origin provenance.

**Tech Stack:** Node >=22.13 ESM, `node:fs/promises`, Node test runner, existing vanilla ES module UI/CSS, generated `ui-dist` assets.

## Global Constraints

- Never execute, `import`, spawn, or grant capabilities from a copied Skill.
- Never fetch remote content; install from the verified local Forge OS catalogue only.
- Copy only allowlisted regular UTF-8 files at bounded depth; reject symlinks, escapes, and existing destinations.
- Every mutation requires `{ confirmed: true }`; no GET mutates state.
- Write only below `skillRoots[0]`; do not package Electron.
- Preserve provenance, license, source/catal​og/manifest/content hashes, source commit, and upstream receipt.
- Use native button/status semantics and existing semantic UI tokens.

---

### Task 1: Produce a safe Forge OS install bundle

**Files:**

- Modify: `src/nolane-native/forgeos-skill-catalog.mjs`
- Modify: `tests/forgeos-skill-catalog.test.mjs`

**Interfaces:** `ForgeOsSkillCatalog.readInstallBundle(id)` returns frozen `{ skill, files }`. `skill` is `load(id)` data; every `files` item is `{ relativePath, content, contentSha256 }`. Valid paths are `SKILL.md`, `manifest.json`, and allowed text/data under `sections/`, `references/`, or `evaluators/`.

- [ ] **Step 1: Write the failing test**

```js
test('Forge OS install bundle preserves vetted documentation and omits scripts', async () => {
  const bundle = await catalog.readInstallBundle('forgeos:v2:writing-minimal-sufficient-code');
  assert.equal(bundle.skill.id, 'forgeos:v2:writing-minimal-sufficient-code');
  assert.ok(bundle.files.some((file) => file.relativePath === 'SKILL.md'));
  assert.ok(bundle.files.some((file) => file.relativePath === 'sections/procedure.md'));
  assert.ok(bundle.files.every((file) => !file.relativePath.startsWith('scripts/')));
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/forgeos-skill-catalog.test.mjs`

Expected: failure because `readInstallBundle` does not exist.

- [ ] **Step 3: Implement the minimal allowlisted reader**

```js
async readInstallBundle(id) {
  const skill = await this.load(id);
  // derive only from the discovered internal record
  // lstat + readdir({ withFileTypes: true }) each bounded allowed directory
  // skip symlinks, unsupported extensions and non-UTF-8 files
  // return frozen relative data; do not return absolute paths
}
```

Use the existing `inside` check on every candidate. The required `SKILL.md` must exist; all copied buffers must re-hash to their returned digest.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test tests/forgeos-skill-catalog.test.mjs`

Then commit only:

```powershell
git add -- src/nolane-native/forgeos-skill-catalog.mjs tests/forgeos-skill-catalog.test.mjs
git commit -m "feat: expose safe Forge OS skill bundles"
```

### Task 2: Atomically install provenance-preserving local Skills

**Files:**

- Create: `src/nolane-native/forgeos-skill-installer.mjs`
- Modify: `src/nolane-native/skill-registry.mjs`
- Create: `tests/forgeos-skill-installer.test.mjs`
- Modify: `tests/nolane-skill-registry.test.mjs`

**Interfaces:** `new ForgeOsSkillInstaller({ catalog, destinationRoot }).install(id)` returns frozen `{ schema: 'nolane.agent.forgeos-skill-install.v1', id, directoryName, files, provenanceStatus: 'forge-os-imported', receiptSha256 }`. Registry reads a schema-checked optional `import` sidecar object but preserves its existing capability gate.

- [ ] **Step 1: Write failing tests**

```js
test('install writes an origin-preserving local Skill with no capabilities', async () => {
  await installer.install('forgeos:v2:writing-minimal-sufficient-code');
  const skill = (await registry.discover()).find((entry) => entry.id === 'writing-minimal-sufficient-code');
  assert.equal(skill.provenanceStatus, 'forge-os-imported');
  assert.deepEqual(skill.capabilities, []);
  assert.equal(skill.import.source, 'forge-os');
});

test('install refuses to overwrite an existing local Skill', async () => {
  await installer.install('forgeos:v2:writing-minimal-sufficient-code');
  await assert.rejects(() => installer.install('forgeos:v2:writing-minimal-sufficient-code'), /already installed/i);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/forgeos-skill-installer.test.mjs tests/nolane-skill-registry.test.mjs`

Expected: failure because installer/import metadata do not exist.

- [ ] **Step 3: Implement the smallest atomic installer**

```js
const stage = await mkdtemp(path.join(destinationRoot, '.nolane-skill-'));
try {
  await writeAllowedFiles(stage, bundle.files);
  await writeFile(path.join(stage, 'nolane-skill.json'), JSON.stringify(sidecar, null, 2));
  if (await exists(destination)) throw alreadyInstalled(id);
  await rename(stage, destination);
} catch (error) {
  await rm(stage, { recursive: true, force: true });
  throw error;
}
```

Normalize destination from the standard `SKILL.md` name, prove it is inside the configured root, and set `capabilities: []`. The catch block may remove only its own unique staging directory. Validate import strings/hashes before the registry exposes them; do not modify `load` capability checks.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
node --test tests/forgeos-skill-installer.test.mjs tests/nolane-skill-registry.test.mjs tests/agent-loop-selected-skills.test.mjs
```

Then commit only:

```powershell
git add -- src/nolane-native/forgeos-skill-installer.mjs src/nolane-native/skill-registry.mjs tests/forgeos-skill-installer.test.mjs tests/nolane-skill-registry.test.mjs
git commit -m "feat: install Forge OS skills locally with provenance"
```

### Task 3: Add a confirmed service, API, and accessible UI action

**Files:**

- Modify: `src/nolane-native/orchestration-service.mjs`
- Modify: `src/server/routes.mjs`
- Modify: `tests/nolane-native-orchestration-service.test.mjs`
- Modify: `tests/nolane-native-orchestration-http-wiring.test.mjs`
- Modify: `ui-v3/views/skills/skills-view.mjs`
- Modify: `ui-v3/app.mjs`
- Modify: `ui-v3/styles/pages/skills.css`
- Modify: `tests/ui-v3-skills-library.test.mjs`
- Generated: `ui-dist/**`

**Interfaces:** `installForgeOsSkill(id)` calls only the installer then refreshes `this.skills`. `POST /api/skills/catalog/:id/install` requires `{ confirmed: true }`, a Forge ID, and responds `201` with no filesystem path. UI adds `installSelectedSkill()`, renders `button[data-action="install-skill"]` only for `preview.source === 'forge-os'`, and reloads after success.

- [ ] **Step 1: Write failing service/route/UI tests**

```js
const denied = await post('/api/skills/catalog/forgeos%3Av2%3Arepair/install', {});
assert.equal(denied.status, 400);
const installed = await post('/api/skills/catalog/forgeos%3Av2%3Arepair/install', { confirmed: true });
assert.equal(installed.status, 201);

await controller.selectSkill('forgeos:v2:repair');
await controller.installSelectedSkill();
assert.match(renderSkillsLibrary(controller.snapshot()), /data-action="install-skill"/);
```

Also assert a local preview has no install button, only the expected POST body is sent, and success reloads `/api/skills/catalog?limit=500`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/nolane-native-orchestration-service.test.mjs tests/nolane-native-orchestration-http-wiring.test.mjs tests/ui-v3-skills-library.test.mjs
```

Expected: failure because the service, confirmed route, and controller action do not exist.

- [ ] **Step 3: Implement the constrained flow**

```js
async installSelectedSkill() {
  if (state.preview?.source !== 'forge-os') return patch({ installError: copy.unavailable });
  const receipt = await api.post(`/api/skills/catalog/${encodeURIComponent(state.preview.id)}/install`, { confirmed: true });
  await this.load();
  return patch({ installStatus: receipt, installError: null });
}
```

The server must reject absent confirmation with `SKILL_INSTALL_CONFIRMATION_REQUIRED` and non-Forge IDs with `SKILL_INSTALL_SOURCE_UNSUPPORTED`. UI uses native labelled button, disabled/busy state, `aria-live="polite"` status, source/license/hash text, and existing semantic tokens. Do not use browser confirmation, raw colors, or unlabelled icons.

- [ ] **Step 4: Verify GREEN, generate assets, and commit**

Run:

```powershell
node --test tests/nolane-native-orchestration-service.test.mjs tests/nolane-native-orchestration-http-wiring.test.mjs tests/ui-v3-skills-library.test.mjs tests/ui-v3-accessibility.test.mjs tests/ui-v3-home.test.mjs
npm run validate:ui-tokens
npm run build:ui-v3
npm run audit:ui-quality
npm run verify:ui-v3-release
```

Then commit only named code/tests/UI/generated assets.

### Task 4: Refresh evidence and obtain current-SHA proof

**Files:**

- Generated: `requirements/nolane-native-core-conformance.json`
- Generated: `requirements/master-acceptance-ledger.json`
- Generated: `docs/MASTER-ACCEPTANCE-LEDGER.md`
- Generated when affected: `requirements/runtime-purity-summary.json`

- [ ] **Step 1: Regenerate receipts**

Run:

```powershell
node scripts/generate-nolane-program.mjs
node scripts/generate-native-core-contract-catalog.mjs
node scripts/generate-master-acceptance-ledger.mjs
node scripts/generate-nolane-native-wave-checkpoint.mjs
```

- [ ] **Step 2: Verify local release-sensitive behavior**

Run:

```powershell
node --test --test-concurrency=1 tests/nolane-beta2-release-gates.test.mjs tests/forgeos-skill-catalog.test.mjs tests/forgeos-skill-installer.test.mjs tests/nolane-native-orchestration-http-wiring.test.mjs tests/ui-v3-skills-library.test.mjs
npm run audit:evidence-freshness
```

- [ ] **Step 3: Commit/push exact evidence and wait for GitHub Actions**

```powershell
git add -- docs/MASTER-ACCEPTANCE-LEDGER.md requirements/master-acceptance-ledger.json requirements/nolane-native-core-conformance.json requirements/runtime-purity-summary.json
git commit -m "chore: refresh skill installation evidence"
git push https://github.com/Nolane-x/Nolane-agent.git HEAD:refs/heads/codex/external-gate-evidence
```

Confirm `Nolane Agent CI`, `External gate evidence`, and `UI runtime visual evidence` are green for that exact SHA. Inspect failed logs before any follow-up change.

## Self-review

The plan covers user-visible installation and preserves the existing secure mission attachment model. It intentionally excludes network marketplace/import, automatic update, deletion, credentials, execution, capability approval, and Electron packaging because those require broader authorization and lifecycle design.
