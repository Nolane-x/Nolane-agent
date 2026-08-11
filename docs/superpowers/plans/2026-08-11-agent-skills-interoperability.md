# Agent Skills Interoperability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Nolane-owned local skill library discover and safely preview standard `SKILL.md` packages while retaining the existing `skill.json` format and the separate read-only Forge OS catalog.

**Architecture:** `NolaneSkillRegistry` becomes the only adapter for local skills. It accepts either a legacy Nolane `skill.json` package or a standard Agent Skills package with YAML frontmatter in `SKILL.md`, normalizes both to the existing catalog contract, hashes the exact skill body, and never executes bundled scripts. An optional `nolane-skill.json` sidecar adds local provenance, declared capabilities, and license information without changing the portable `SKILL.md` contract. `NolaneNativeOrchestrationService` reports the local catalog as `nolane`/`local`; the current skill page receives that data through its unchanged read-only API.

**Tech Stack:** Node.js ESM, Node test runner, `node:fs/promises`, `crypto`, existing UI v3 controller/API client. No third-party parser or runtime dependency.

## Global Constraints

- Do not run, install, source, or import scripts from any skill package.
- Local discovery roots stay bounded to `config.dataDir/nolane-skills`; Forge OS stays a distinct, read-only vendor catalog.
- A standard package needs `SKILL.md` with `name` and `description` frontmatter values; names follow `^[a-z0-9][a-z0-9-]{1,63}$`.
- The optional `nolane-skill.json` sidecar is metadata only and must have schema `nolane.agent.skill-provenance.v1`.
- Reject symlinks, escaped paths, duplicate IDs, malformed frontmatter, malformed sidecars, and content that changes after discovery.
- Default local capabilities are `[]`; declared capabilities are metadata only and do not grant execution.
- The catalog and preview API remain read-only. Keep semantic-token UI styling; do not package Electron locally.
- Public third-party repositories without an explicit license remain reference-only; do not copy their skill content into the repository.

---

## File Structure

- `src/nolane-native/skill-registry.mjs` — normalize legacy and standard local packages, validate provenance, and produce integrity receipts.
- `src/nolane-native/orchestration-service.mjs` — count and rank the normalized local catalog consistently with Forge OS skills.
- `ui-v3/views/skills/skills-view.mjs` — render local provenance fields and distinguish the local catalog without expanding permissions.
- `tests/nolane-skill-registry.test.mjs` — local package, malformed package, sidecar, integrity, and backward-compatibility contracts.
- `tests/ui-v3-skills-library.test.mjs` — local catalog filtering and safe provenance display contract.
- `docs/AGENT-SKILLS-SUPPLY-CHAIN.md` — user-facing source policy: Forge OS MIT catalog, local skills, and reference-only unlicensed catalogs.

---

### Task 1: Normalize standard local Agent Skills without breaking legacy packages

**Files:**

- Modify: `src/nolane-native/skill-registry.mjs`
- Test: `tests/nolane-skill-registry.test.mjs`

**Interfaces:**

- `NolaneSkillRegistry.discover()` returns local records with `source: 'nolane'`, `catalog: 'local'`, `id`, `sourceId`, `title`, `description`, `capabilities`, `license`, `sourceUrl`, `provenanceStatus`, `manifestSha256`, and `contentSha256`.
- `NolaneSkillRegistry.load(id, { grantedCapabilities })` preserves the legacy capability check and returns the same catalog/provenance fields plus exact `content` and a receipt hash.

- [x] **Step 1: Write failing standard-package tests**

```js
await writeFile(path.join(root, 'browser-audit', 'SKILL.md'), `---\nname: browser-audit\ndescription: Review browser flows without exposing credentials.\n---\n# Browser audit\n`);
const skills = await new NolaneSkillRegistry({ roots: [root] }).discover();
assert.deepEqual(skills.map((skill) => skill.id), ['browser-audit']);
assert.equal(skills[0].source, 'nolane');
assert.equal(skills[0].catalog, 'local');
assert.equal(skills[0].capabilities.length, 0);
assert.equal(skills[0].description, 'Review browser flows without exposing credentials.');
```

- [x] **Step 2: Run the focused test to prove the current registry skips `SKILL.md` packages**

Run: `node --test --test-concurrency=1 tests/nolane-skill-registry.test.mjs`

Expected: FAIL because the current discovery loop requires `skill.json`.

- [x] **Step 3: Add a bounded frontmatter/sidecar parser and normalizer**

```js
function standardSkillRecord({ directory, source }) {
  const skillFile = path.join(directory, 'SKILL.md');
  const frontmatter = parseSkillFrontmatter(await readFile(skillFile, 'utf8'));
  const sidecar = await readOptionalSidecar(path.join(directory, 'nolane-skill.json'));
  return normalizeLocalSkill({ id: frontmatter.name, title: sidecar?.title ?? frontmatter.name, description: frontmatter.description, entrypoint: skillFile, sidecar, source });
}
```

`parseSkillFrontmatter` must require a leading `---` section, reject duplicate `name` or `description` values, unquote only matching single/double quotes, and reject multiline/YAML aliases rather than guessing. `readOptionalSidecar` must reject symlinks and require the exact Nolane provenance schema when present.

- [x] **Step 4: Add failure and compatibility tests**

```js
await assert.rejects(() => registry.discover(), /frontmatter|duplicate skill id|provenance/i);
await writeFile(path.join(root, 'legacy', 'skill.json'), JSON.stringify({ schema: 'nolane.agent.skill.v1', id: 'legacy', title: 'Legacy', entrypoint: 'guide.md', capabilities: ['repo:read'] }));
assert.equal((await registry.discover()).find((skill) => skill.id === 'legacy').capabilities[0], 'repo:read');
```

Cover malformed delimiter, an invalid name, a symlinked `SKILL.md`, malformed sidecar, a standard/legacy duplicate ID, changed bytes after discover, and missing declared capabilities on `load`.

- [x] **Step 5: Run focused registry tests**

Run: `node --test --test-concurrency=1 tests/nolane-skill-registry.test.mjs`

Expected: PASS with standard and legacy packages both represented, and every unsafe fixture rejected.

- [x] **Step 6: Commit**

```bash
git add src/nolane-native/skill-registry.mjs tests/nolane-skill-registry.test.mjs
git commit -m "feat: discover standard local agent skills"
```

### Task 2: Preserve source truth through the skill hub

**Files:**

- Modify: `src/nolane-native/orchestration-service.mjs`
- Test: `tests/nolane-native-orchestration-service.test.mjs`

**Interfaces:**

- `skillCatalog({ source: 'nolane', catalog: 'local' })` returns only normalized local skills and `counts.bySource.nolane` / `counts.byCatalog.local`.
- `loadSkill(localId, options)` returns the same source/catalog/provenance contract as catalog discovery.

- [x] **Step 1: Write failing hub filtering assertions**

```js
const hub = await service.skillCatalog({ source: 'nolane', catalog: 'local', limit: 20 });
assert.equal(hub.readOnly, true);
assert.equal(hub.counts.bySource.nolane, 1);
assert.equal(hub.skills[0].catalog, 'local');
```

- [x] **Step 2: Run the focused orchestration test to reproduce missing normalized source fields**

Run: `node --test --test-concurrency=1 tests/nolane-native-orchestration-service.test.mjs`

Expected: FAIL until local record source/catalog fields reach the hub.

- [x] **Step 3: Rank and filter local records explicitly**

```js
const sourceRank = (skill) => skill.source === 'nolane' ? 0 : skill.catalog === 'v2' ? 1 : 2;
const catalogKey = String(skill.catalog ?? 'uncategorized');
```

Do not infer a source from an ID prefix. Preserve the existing Forge OS ordering and load dispatch.

- [x] **Step 4: Run orchestration and HTTP contract tests**

Run: `node --test --test-concurrency=1 tests/nolane-native-orchestration-service.test.mjs tests/nolane-native-orchestration-http-wiring.test.mjs`

Expected: PASS; `/api/skills/catalog` remains a bounded read-only response.

- [x] **Step 5: Commit**

```bash
git add src/nolane-native/orchestration-service.mjs tests/nolane-native-orchestration-service.test.mjs
git commit -m "feat: expose local agent skills in the skill hub"
```

### Task 3: Make provenance legible in the Skills Workspace

**Files:**

- Modify: `ui-v3/views/skills/skills-view.mjs`
- Modify: `ui-v3/styles/pages/skills.css`
- Test: `tests/ui-v3-skills-library.test.mjs`

**Interfaces:**

- `createSkillsLibraryController` accepts catalog records with `source: 'nolane'` and `catalog: 'local'`.
- The rendered card shows source, catalog, license or `Local`, provenance status, and content hash; dynamic values remain escaped.

- [x] **Step 1: Write a failing local-card render test**

```js
controller.setCatalog([{ id: 'browser-audit', source: 'nolane', catalog: 'local', title: 'Browser audit', description: 'Review flows', provenanceStatus: 'local-user-supplied', contentSha256: 'a'.repeat(64) }]);
controller.selectSkill('browser-audit');
assert.match(renderSkillsLibrary(controller.snapshot()), /Nolane local/i);
assert.match(renderSkillsLibrary(controller.snapshot()), /local-user-supplied/);
```

- [x] **Step 2: Run the UI test to prove local terminology is not rendered**

Run: `node --test --test-concurrency=1 tests/ui-v3-skills-library.test.mjs`

Expected: FAIL until local source/catalog copy and metadata are rendered.

- [x] **Step 3: Render honest source/trust metadata with existing semantic tokens**

```js
const sourceLabel = skill.source === 'nolane' ? copy.nolaneLocal : skill.catalog === 'v2' ? copy.v2 : copy.legacy;
const trustLabel = skill.provenanceStatus ?? copy.localUserSupplied;
```

Do not add install, execute, permission-grant, or remote-fetch controls. Use a compact definition list in the preview card and the existing narrow one-column behavior below 900px.

- [x] **Step 4: Run UI, accessibility, and token checks**

Run: `node --test --test-concurrency=1 tests/ui-v3-skills-library.test.mjs tests/ui-v3-accessibility.test.mjs && npm run validate:ui-tokens`

Expected: PASS with no raw color or unescaped dynamic content finding.

- [x] **Step 5: Build generated UI only after source checks pass**

Run: `npm run build:ui-v3 && node scripts/verify-ui-v3-release.mjs`

Expected: PASS. Do not run Electron packaging.

- [x] **Step 6: Commit**

```bash
git add ui-v3/views/skills/skills-view.mjs ui-v3/styles/pages/skills.css ui-dist tests/ui-v3-skills-library.test.mjs
git commit -m "feat: show skill source provenance in workspace"
```

### Task 4: Document the supply-chain boundary and verify all evidence

**Files:**

- Create: `docs/AGENT-SKILLS-SUPPLY-CHAIN.md`
- Modify: `docs/superpowers/plans/2026-08-11-workspace-skill-library.md`
- Test: `tests/nolane-skill-registry.test.mjs`

**Interfaces:**

- The documentation lists source categories: Nolane local (`SKILL.md` + optional sidecar), Forge OS MIT vendor catalog, and reference-only unlicensed external repositories.
- It states that catalog/preview is non-executing and that user-owned local skill packages are discovered from the Nolane data directory.

- [x] **Step 1: Write a documentation contract assertion**

```js
const policy = await readFile('docs/AGENT-SKILLS-SUPPLY-CHAIN.md', 'utf8');
assert.match(policy, /does not execute bundled scripts/i);
assert.match(policy, /Agent Skills/i);
assert.match(policy, /Forge OS.*MIT/is);
```

- [x] **Step 2: Add the source policy document**

Include the exact supported package shape, sidecar schema, source/trust statuses, rejected package conditions, and the rule that unlicensed third-party catalogs are not copied or automatically imported.

- [x] **Step 3: Mark the older Workspace plan tasks complete only if runtime tests and generated UI pass**

```markdown
- [x] Commit: `feat: add workspace skill library view` after all route, styling, and generated release assets are verified.
```

Do not mark external certification complete; it remains evidence outside this implementation.

- [x] **Step 4: Run full relevant verification and evidence regeneration**

Run: `node --test --test-concurrency=1 tests/nolane-skill-registry.test.mjs tests/forgeos-skill-catalog.test.mjs tests/nolane-native-orchestration-service.test.mjs tests/nolane-native-orchestration-http-wiring.test.mjs tests/ui-v3-skills-library.test.mjs tests/ui-v3-accessibility.test.mjs && npm run audit:evidence-freshness && git diff --check`

Expected: PASS with no stale evidence or whitespace errors. Run `node scripts/generate-nolane-program.mjs` and dependent ledger generators if the freshness verifier reports a hashed requirement update.

- [x] **Step 5: Commit and push the verified scope**

```bash
git add docs/AGENT-SKILLS-SUPPLY-CHAIN.md docs/superpowers/plans/2026-08-11-workspace-skill-library.md docs/superpowers/plans/2026-08-11-agent-skills-interoperability.md
git commit -m "docs: define Nolane skill supply-chain policy"
git push https://github.com/Nolane-x/Nolane-agent.git HEAD:codex/external-gate-evidence
```

## Self-review

Coverage: Task 1 adds portable local skills and hard input boundaries; Task 2 preserves normalized state through the API; Task 3 turns that truth into a visible, responsive UI without execution controls; Task 4 documents provenance and runs evidence/CI gates. The plan does not vendor unlicensed third-party content, fetch arbitrary remote repositories, or expand Electron scope.
