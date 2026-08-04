# Native Localized READMEs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every localized ForgeOS README a full native-language document with no inherited English narrative.

**Architecture:** `scripts/generate-localized-readmes-v06.mjs` remains the single generator, but its English shared prose is replaced by full locale-owned document bodies. The generator writes each root `README-<locale>.md`; a regression test protects the output from the old English template and confirms every configured locale is substantive.

**Tech Stack:** Node.js 22+, `node:test`, Markdown, existing documentation-link validator.

## Global Constraints

- Preserve factual claims, commands, source paths, URLs, version numbers, and product limits.
- Preserve code blocks and standard protocol/product identifiers; translate all explanatory prose, headings, table labels, navigation labels, and link labels.
- Cover all 22 localized README files. Do not replace them with abbreviated summaries.
- Do not alter `README.md`, product behavior, APIs, or the immutable `v0.6.1` release tag.

---

### Task 1: Add a regression contract for native localized documents

**Files:**
- Create: `tests/localized-readmes-v06.test.mjs`
- Modify: `scripts/generate-localized-readmes-v06.mjs`

**Interfaces:**
- Consumes: the locale identifiers declared by `scripts/generate-localized-readmes-v06.mjs`.
- Produces: a test that reads `README-<locale>.md` and rejects English prose inherited from the previous shared template.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const locales = ['ar','cn','de','es','fa','fr','he','hi','id','it','ja','ko','nl','pl','pt-br','ru','sv','th','tr','tw','uk','vn'];
const inheritedEnglish = [
  'ForgeOS separates **outcomes, techniques, providers',
  'ForgeOS is not only a prompt collection.',
  'Release verification checks state and fencing invariants',
  'Contributions are evaluated by behavior, not persuasive prose.',
];

test('localized READMEs are substantive native documents without the English shared template', async () => {
  for (const locale of locales) {
    const text = await readFile(`README-${locale}.md`, 'utf8');
    assert.ok(text.length > 12_000, `${locale} README must remain complete`);
    for (const phrase of inheritedEnglish) assert.doesNotMatch(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: FAIL because every non-Vietnamese README still includes the English shared-template paragraphs.

- [ ] **Step 3: Keep the locale registry explicit**

Update the generator so the registry includes all 22 locale codes and its output loop is the only path that writes `README-<locale>.md`. Retain `README.md` as the untouched English source.

- [ ] **Step 4: Run test to verify the registry remains complete**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: still FAIL only for untranslated output; this preserves a red baseline while the document bodies are replaced in Task 2.

- [ ] **Step 5: Commit**

```bash
git add tests/localized-readmes-v06.test.mjs scripts/generate-localized-readmes-v06.mjs
git commit -m "test: guard native localized README output"
```

### Task 2: Replace the shared English body with complete locale-owned documents

**Files:**
- Modify: `scripts/generate-localized-readmes-v06.mjs`
- Modify: `README-ar.md`
- Modify: `README-cn.md`
- Modify: `README-de.md`
- Modify: `README-es.md`
- Modify: `README-fa.md`
- Modify: `README-fr.md`
- Modify: `README-he.md`
- Modify: `README-hi.md`
- Modify: `README-id.md`
- Modify: `README-it.md`
- Modify: `README-ja.md`
- Modify: `README-ko.md`
- Modify: `README-nl.md`
- Modify: `README-pl.md`
- Modify: `README-pt-br.md`
- Modify: `README-ru.md`
- Modify: `README-sv.md`
- Modify: `README-th.md`
- Modify: `README-tr.md`
- Modify: `README-tw.md`
- Modify: `README-uk.md`
- Modify: `README-vn.md`

**Interfaces:**
- Consumes: per-locale document bodies and the common factual product inventory.
- Produces: one complete Markdown document per locale, with native navigation, headings, explanations, tables, limits, and contribution guidance.

- [ ] **Step 1: Define full document coverage for every locale**

Each locale-owned body must include the following native-language sections in this order: product overview, verified inventory, five-minute quick start, system flow, ten major subsystems, ecosystem comparison, user and developer paths, expert verification, repository structure, appropriate uses, non-goals, production limits, and contribution guidance.

- [ ] **Step 2: Translate every explanatory field into its locale**

Replace all prose in the current `common()` template, including table headers, flow labels, command explanations, component descriptions, comparison rows, caveats, repository comments, and link labels. Retain only commands, paths, code, URLs, protocol names, and product names in their canonical spelling.

- [ ] **Step 3: Generate all localized README files**

Run: `node scripts/generate-localized-readmes-v06.mjs`

Expected: all 22 output files change; no English shared-template paragraph remains outside code/identifier contexts.

- [ ] **Step 4: Run the localization regression test**

Run: `node --test tests/localized-readmes-v06.test.mjs`

Expected: PASS with all 22 README files above the completeness threshold and no old English narrative.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-localized-readmes-v06.mjs README-*.md
git commit -m "docs: fully localize README variants"
```

### Task 3: Verify reproducibility, links, and document quality

**Files:**
- Modify only if a verifier exposes a factual/link defect: `scripts/generate-localized-readmes-v06.mjs` or the affected `README-<locale>.md`.

**Interfaces:**
- Consumes: the generated README set from Task 2.
- Produces: reproducible output and documentation-validation evidence.

- [ ] **Step 1: Verify generator idempotence**

Run:

```bash
node scripts/generate-localized-readmes-v06.mjs
git diff --exit-code -- README-*.md
```

Expected: exit code 0 after the second generation.

- [ ] **Step 2: Validate all documentation links**

Run: `npm run lint:docs`

Expected: exit code 0 with all Markdown links valid.

- [ ] **Step 3: Run focused documentation tests**

Run: `node --test tests/localized-readmes-v06.test.mjs tests/documentation-v04.test.mjs`

Expected: 0 failures.

- [ ] **Step 4: Manually review each locale**

Read the language selector, first two explanatory sections, component table, and closing contribution section in every output. Confirm there are no inherited English sentences and right-to-left files render with their native headings.

- [ ] **Step 5: Commit corrections, if any**

```bash
git add scripts/generate-localized-readmes-v06.mjs README-*.md tests/localized-readmes-v06.test.mjs
git commit -m "docs: correct localized README quality findings"
```

### Task 4: Publish the documentation correction

**Files:**
- Modify: no source files expected after Task 3.

**Interfaces:**
- Consumes: clean, verified commits from Tasks 1–3.
- Produces: pushed `main` branch containing the localized README correction.

- [ ] **Step 1: Verify release-tag boundary**

Run: `git show-ref --verify refs/tags/v0.6.1`

Expected: the existing release tag remains unchanged; this documentation correction is published as a new `main` commit, not by moving the old tag.

- [ ] **Step 2: Push verified commits**

Run: `git push origin main`

Expected: remote `main` equals local `HEAD`.

- [ ] **Step 3: Confirm remote commit**

Run:

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: the two SHA values match.
