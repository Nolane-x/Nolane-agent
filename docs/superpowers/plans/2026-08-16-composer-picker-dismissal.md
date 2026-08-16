# Composer Picker Dismissal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent home-composer model, intent, and effort menus from remaining open over unrelated content after an outside click.

**Architecture:** Composer picker DOM state is shared by the home route and app document. A small component helper decides whether an event target is inside a composer picker and closes all composer menus. The application-level click handler uses it, so every pointer interaction outside Home—not merely inside the route root—has identical dismissal behavior without a second state store.

**Tech Stack:** Browser DOM events, native Node test runner, existing UI V3 rendering.

## Global Constraints

- Reuse existing semantic CSS tokens and do not restyle the composer.
- Keep existing Escape, Tab, search, option selection, and project picker behavior.
- Do not add dependencies, package Electron locally, or modify generated `ui-dist` directly.

---

### Task 1: Close an open composer picker after an outside interaction

**Files:**
- Create: `ui-v3/components/composer-picker.mjs`
- Modify: `ui-v3/app.mjs:1-40,283-310`
- Modify: `tests/ui-v3-home.test.mjs`

**Interfaces:**
- Consumes: `EventTarget.closest`, `[data-composer-picker]`, and `[data-composer-picker-menu]`.
- Produces: `isComposerPickerInteraction(target)` and `closeComposerPickers(root)`; the application click handler uses them to close menus only for targets outside a composer picker.

- [ ] **Step 1: Write the failing test**

```js
test('composer picker helpers distinguish inside interactions and close every menu', () => {
  const trigger = { setAttribute() {} };
  const picker = { querySelector() { return trigger; } };
  const menu = { hidden: false, closest() { return picker; } };
  closeComposerPickers({ querySelectorAll() { return [menu]; } });
  assert.equal(menu.hidden, true);
  assert.equal(isComposerPickerInteraction({ closest() { return picker; } }), true);
  assert.equal(isComposerPickerInteraction({ closest() { return null; } }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ui-v3-home.test.mjs`

Expected: the new test fails because the shared composer-picker module does not yet exist.

- [ ] **Step 3: Write the minimal implementation**

```js
export function isComposerPickerInteraction(target) {
  return Boolean(target?.closest?.('[data-composer-picker]'));
}
export function closeComposerPickers(root = globalThis.document) { /* close menus and reset aria-expanded */ }
// In the existing application document click handler:
if (!isComposerPickerInteraction(event.target)) closeComposerPickers(document);
```

Keep the existing Home option-selection, keyboard, and project-picker branches unchanged; replace its duplicated route-local close helper with the shared helper.

- [ ] **Step 4: Run focused verification**

Run: `node --test tests/ui-v3-home.test.mjs tests/ui-v3-project-picker.test.mjs tests/ui-v3-accessibility.test.mjs`

Expected: all selected tests pass and custom picker contracts remain intact.

- [ ] **Step 5: Build the canonical UI output and inspect the patch**

Run: `npm run build:ui-v3` then `git diff --check`

Expected: the UI build succeeds and the diff has no whitespace errors. Stage only intentional source, test, and plan/spec files; never stage `.serena/`.

- [ ] **Step 6: Commit and push after fresh verification**

Run: `git add ui-v3/components/composer-picker.mjs ui-v3/app.mjs tests/ui-v3-home.test.mjs docs/superpowers/specs/2026-08-16-composer-picker-dismissal-design.md docs/superpowers/plans/2026-08-16-composer-picker-dismissal.md && git commit -m "fix(ui): dismiss composer pickers on outside click"`

Then push the detached worktree HEAD to `refs/heads/codex/external-gate-evidence` and allow GitHub Actions to record the external UI regression evidence.
