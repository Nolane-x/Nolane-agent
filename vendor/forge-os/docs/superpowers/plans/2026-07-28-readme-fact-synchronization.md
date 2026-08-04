# README Fact Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize every public ForgeOS README with the verified v0.6.1 inventory and its universal-lane and execution-boundary documentation.

**Architecture:** `README.md` and `README-vn.md` remain the detailed maintained sources. The 21 localized templates remain the canonical source for their generated root README files; the generator makes only presentation-safe badge transformations. A focused Node test checks source-template/output parity and rejects the known obsolete public inventory claims.

**Tech Stack:** Node.js ESM, Node test runner, Markdown, existing localized README generator.

## Global Constraints

- Publish only verified facts: 60 schema-strict MCP tools, 250 skills (146 core and 104 domain), 1,299 built-in mappings, and 242 candidate procedural providers.
- Describe universal lanes as routing and advisory/workflow coverage, not an assertion of autonomous real-world execution.
- State that remote microVM isolation requires a configured compatible external provider; physical-world actions require human approval.
- Do not add locales, alter CLI/API behavior, claim certification, or mark candidate skills stable.

---

### Task 1: Add stale-fact and generated-output regression coverage

**Files:**

- Modify: `tests/localized-readmes-v06.test.mjs`
- Modify: `scripts/generate-localized-readmes-v06.mjs`

**Interfaces:**

- Consumes: the 21 `scripts/localized-readmes-v06/README-<locale>.md.txt` source templates.
- Produces: `renderLocalizedReadme(locale, content)` exported from the generator and deterministic root `README-<locale>.md` output.

- [ ] **Step 1: Write the failing test**

Add imports for `path`, `fileURLToPath`, and `renderLocalizedReadme`. For each locale, read the template and output and assert:

```js
assert.doesNotMatch(text, /MCP-58_tools|58 (?:public |schema-strict )?MCP|1[,.]291|234 candidate/u);
assert.match(text, /60/u);
assert.match(text, /1[,.]299/u);
assert.match(text, /UNIVERSAL-LANES\.md/u);
assert.equal(output, renderLocalizedReadme(locale, template));
```

Use locale-specific output only; Vietnamese is maintained separately and must be checked by its own current-fact assertions.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: FAIL because templates still contain 58-tool and 1,291 claims, and the generator does not export the renderer.

- [ ] **Step 3: Extract the minimal deterministic renderer**

In `scripts/generate-localized-readmes-v06.mjs`, export:

```js
export function renderLocalizedReadme(locale, content) {
  return locale === 'vn' ? content : content
    .replace(/(<h1 align="center">ForgeOS<\\/h1>\\r?\\n)<p align="center"><strong>[^<]*<\\/strong><\\/p>\\r?\\n/u, '$1')
    .replace('alt="60 MCP tools"', 'alt="MCP 60"');
}
```

Keep `generateLocalizedReadmes()` as the CLI entry point, call the renderer for every listed locale, and retain the current output file names.

- [ ] **Step 4: Run the focused test to verify the renderer behavior**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: the renderer export is reachable; stale-fact assertions still fail until the source documents are updated.

- [ ] **Step 5: Commit the test-first checkpoint**

```bash
git add tests/localized-readmes-v06.test.mjs scripts/generate-localized-readmes-v06.mjs
git commit -m "test: guard localized README facts"
```

### Task 2: Update detailed English and Vietnamese reader entry points

**Files:**

- Modify: `README.md`
- Modify: `README-vn.md`

**Interfaces:**

- Consumes: the verified inventory in `config/universal-lanes.json`, `skills/catalog.json`, `providers/built-in-providers.json`, and `docs/REMOTE-MICROVM-SANDBOX.md`.
- Produces: direct links to `docs/UNIVERSAL-LANES.md` and truthful public inventory/boundary prose.

- [ ] **Step 1: Correct the detailed-source assertions in the focused test**

Add explicit root-document expectations:

```js
assert.match(await readFile('README.md', 'utf8'), /242 candidates/u);
assert.match(await readFile('README.md', 'utf8'), /UNIVERSAL-LANES\.md/u);
assert.match(await readFile('README-vn.md', 'utf8'), /1\.299/u);
assert.match(await readFile('README-vn.md', 'utf8'), /UNIVERSAL-LANES\.md/u);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: FAIL because the English candidate count is 234, the Vietnamese repository tree shows 1.291, and neither detailed README links the universal lane registry.

- [ ] **Step 3: Make the minimal factual Markdown changes**

Correct the English candidate count to 242 and Vietnamese tree inventory to 1.299. Add one compact section in each document that links to `docs/UNIVERSAL-LANES.md`, names all-lane coverage as controlled routing, and links to `docs/REMOTE-MICROVM-SANDBOX.md` for the external-provider boundary. The Vietnamese text also states that hardware, manufacturing, and robotics outputs require human approval before physical action.

- [ ] **Step 4: Run the focused test to verify it passes for detailed README facts**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: detailed-source assertions pass; template assertions may still fail until Task 3.

- [ ] **Step 5: Commit the detailed-source checkpoint**

```bash
git add README.md README-vn.md tests/localized-readmes-v06.test.mjs
git commit -m "docs: synchronize primary README facts"
```

### Task 3: Synchronize localized templates and regenerate outputs

**Files:**

- Modify: `scripts/localized-readmes-v06/README-*.md.txt`
- Regenerate: `README-ar.md`, `README-cn.md`, `README-de.md`, `README-es.md`, `README-fa.md`, `README-fr.md`, `README-he.md`, `README-hi.md`, `README-id.md`, `README-it.md`, `README-ja.md`, `README-ko.md`, `README-nl.md`, `README-pl.md`, `README-pt-br.md`, `README-ru.md`, `README-sv.md`, `README-th.md`, `README-tr.md`, `README-tw.md`, and `README-uk.md`.

**Interfaces:**

- Consumes: the generator renderer from Task 1 and the template documents.
- Produces: root localized README files that exactly equal generated template output and contain the current inventory/boundary reference.

- [ ] **Step 1: Update all source templates by the same factual contract**

Replace obsolete MCP and mapping values in each template, update all internal 60-tool architecture references, and append a concise native-language universal-lanes paragraph linking to `docs/UNIVERSAL-LANES.md`. It must state that the lane registry does not grant autonomous physical execution and that remote microVM isolation is provider-configured. Preserve native headings, links, commands, and the language selector.

- [ ] **Step 2: Regenerate the 21 root localized README outputs**

Run: `node scripts/generate-localized-readmes-v06.mjs`

Expected: 21 root `README-<locale>.md` files are written from templates.

- [ ] **Step 3: Run the focused regression test**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: PASS; every output matches its renderer result, no stale claims remain, and all current facts/links are present.

- [ ] **Step 4: Verify generator idempotence and Markdown links**

Run:

```bash
node scripts/generate-localized-readmes-v06.mjs
git diff --exit-code -- README-*.md
npm run lint:docs
```

Expected: no second-generation diff and documentation lint exits zero.

- [ ] **Step 5: Commit the localized documentation checkpoint**

```bash
git add scripts/generate-localized-readmes-v06.mjs scripts/localized-readmes-v06 README-*.md tests/localized-readmes-v06.test.mjs
git commit -m "docs: synchronize localized README facts"
```

### Task 4: Run release-proportional verification and publish

**Files:**

- Verify: all files changed in Tasks 1–3

**Interfaces:**

- Consumes: the source/templates/generator/test contracts completed above.
- Produces: a clean `main` commit pushed to `origin/main`.

- [ ] **Step 1: Run the relevant tests and documentation lint**

Run:

```bash
node --test tests/localized-readmes-v06.test.mjs
npm run lint:docs
npm test
```

Expected: every command exits zero; full test output reports zero failures.

- [ ] **Step 2: Inspect the exact release diff**

Run:

```bash
git diff HEAD~3..HEAD --check
git status --short
git log --oneline -4
```

Expected: no whitespace errors and no uncommitted source changes.

- [ ] **Step 3: Push the verified main branch and verify its SHA**

Run:

```bash
git push origin main
git ls-remote --heads origin main
git rev-parse HEAD
```

Expected: the remote `main` SHA equals local `HEAD`.
