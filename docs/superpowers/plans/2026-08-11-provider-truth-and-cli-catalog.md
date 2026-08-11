# Provider Truth and CLI Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings model surface truthful and add documented coding-agent CLIs without weakening execution safety.

**Architecture:** `CliProvider` remains the single source of CLI execution contracts. The Settings template receives only public provider facts and renders them with existing tokens. The connection service and routers continue rejecting `external-plan-config-required` entries.

**Tech Stack:** Node.js ESM, node:test, UI V3 template strings and CSS custom properties.

## Global Constraints

- Keep execution argv-only; never use a shell.
- Never claim an untested provider is ready or authenticated.
- Preserve themes with existing CSS tokens; add no raw colors.
- Do not package Electron locally or publish a release in this slice.
- Regenerate canonical evidence receipts after tracked source/test changes.

---

### Task 1: Render provider facts in Settings

**Files:**
- Modify: `ui-v3/views/settings/model-profiles-panel.mjs`
- Modify: `ui-v3/styles/pages/settings.css`
- Test: `tests/ui-v3-model-profiles.test.mjs`

**Interfaces:**
- Consumes: public provider data: `executionSafety`, `modelSelection`, `modelDiscovery`, `available`, `authenticated`, and `healthy`.
- Produces: `providerFacts(provider, lang)` markup with `data-provider-fact="execution|models|state"`.

- [ ] **Step 1: Verify the existing failing UI behavior test.**

Run: `node --test tests/ui-v3-model-profiles.test.mjs`

Expected: it fails because provider headings have no semantic facts, not because of a test syntax error.

- [ ] **Step 2: Implement the smallest fact renderer.**

```js
function providerFacts(provider, lang) {
  const facts = [
    ['execution', executionLabel(provider, lang)],
    ['models', modelCatalogLabel(provider, lang)],
    ['state', connectionStateLabel(provider, lang)],
  ];
  return `<ul class="provider-facts">${facts.map(([kind, value]) =>
    `<li data-provider-fact="${kind}">${escapeHtml(value)}</li>`).join('')}</ul>`;
}
```

Render it after the existing provider status. Branch execution on
`external-plan-config-required`; branch models on live discovery, CLI config,
or forwarded/manual models. Provide English and Vietnamese strings.

- [ ] **Step 3: Style facts with tokens and verify green.**

Run: `node --test tests/ui-v3-model-profiles.test.mjs`

Expected: every test passes, including Vietnamese and external-plan behavior.

### Task 2: Add documented CLI contracts

**Files:**
- Modify: `src/providers/provider-registry.mjs`
- Modify: `src/app.mjs`
- Test: `tests/provider-registry.test.mjs`

**Interfaces:**
- Produces: `auggie`, `amp`, `amazon-q`, `crush`, and `roo-code` provider IDs.
- Safety: only Auggie is `verified`; the other four remain `external-plan-config-required`.

- [ ] **Step 1: Write a failing registry contract test.**

```js
assert.deepEqual(ids.slice(-5), ['auggie', 'amp', 'amazon-q', 'crush', 'roo-code']);
assert.deepEqual(auggie.modelDiscoveryArgs, ['models', 'list', '--json']);
assert.equal(auggie.publicView().executionSafety, 'verified');
assert.equal(amp.publicView().executionSafety, 'external-plan-config-required');
assert.equal(amazonQ.publicView().modelSelection.mode, 'cli-config');
```

Run: `node --test tests/provider-registry.test.mjs`

Expected: failure because the five IDs do not exist.

- [ ] **Step 2: Add exact vendor-documented argv contracts.**

```js
{ id: 'auggie', executable: 'auggie', baseArgs: ['--print', '--quiet', '--output-format', 'json', '--dont-save-session', '--ask'], promptMode: 'arg', modelFlag: '--model', modelDiscoveryArgs: ['models', 'list', '--json'] }
{ id: 'amp', executable: 'amp', baseArgs: ['--execute', '--stream-json'], promptMode: 'arg', executionSafety: 'external-plan-config-required', modelSelection: 'cli-config' }
{ id: 'amazon-q', executable: 'q', baseArgs: ['chat', '--no-interactive'], promptMode: 'arg', executionSafety: 'external-plan-config-required', modelSelection: 'cli-config' }
{ id: 'crush', executable: 'crush', baseArgs: ['run'], promptMode: 'arg', executionSafety: 'external-plan-config-required', modelSelection: 'cli-config' }
{ id: 'roo-code', executable: 'roo', baseArgs: [], promptMode: 'arg', executionSafety: 'external-plan-config-required', modelSelection: 'cli-config' }
```

Give each a harness family and profile without `governed-actions`. Add all IDs
to provider sandboxes. Add only the documented Auggie `--version`/`login`
availability adapter; do not invent auth commands for other CLIs.

- [ ] **Step 3: Verify router safety.**

Run: `node --test tests/provider-registry.test.mjs tests/provider-connections.test.mjs tests/adaptive-router.test.mjs tests/outcome-aware-router.test.mjs`

Expected: all pass, and an external-plan provider remains ineligible.

### Task 3: Build UI and refresh evidence

**Files:**
- Generated: `ui-dist/**` when source build changes artifacts
- Generated: `docs/MASTER-ACCEPTANCE-LEDGER.md`
- Generated: `requirements/master-acceptance-ledger.json`
- Generated: `requirements/nolane-native-core-conformance.json`

- [ ] **Step 1: Validate the UI source.**

Run: `npm run build:ui-v3; npm run validate:ui-tokens; node scripts/verify-ui-v3-release.mjs`

Expected: artifacts match, and no unresolved tokens, token cycles, or raw colors appear.

- [ ] **Step 2: Refresh and verify evidence.**

Run: `node scripts/generate-native-core-contract-catalog.mjs; node scripts/generate-master-acceptance-ledger.mjs; node --test tests/nolane-beta2-release-gates.test.mjs; node scripts/verify-master-acceptance-ledger.mjs; node scripts/verify-native-core-parity.mjs; npm run forensics:master-assertions`

Expected: receipts are fresh; any remaining external gates are still reported.

- [ ] **Step 3: Inspect and commit only known paths.**

Run: `git diff --check; git status --short`

Expected: no whitespace error and no unrelated file is staged.
