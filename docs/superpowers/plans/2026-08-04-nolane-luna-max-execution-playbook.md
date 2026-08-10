# Nolane execution playbook for GPT-5.6 Luna Max

Date: 2026-08-04  
Purpose: let a literal, lower-cost implementation agent execute the Nolane premium-agent plan safely and repeatably.

## 0. Read this before doing anything

You are implementing one small task in an existing, heavily modified repository. You are not redesigning the plan, cleaning the tree, or finishing the whole product in one pass.

Repository:

```text
C:\Users\admin\AppData\Local\Temp\codex-nolane-cp14-019fcba5
```

Inspected baseline:

```text
branch: cp14-clean-snapshot
HEAD at plan time: 5a00670
live development URL at plan time: http://127.0.0.1:60420/ (historical; read the current
launcher log for the active URL and never copy its token into documentation)
```

The worktree already contains many user changes and regenerated `ui-dist` files. They belong to the user. Never run:

```text
git reset --hard
git clean
git checkout -- <path>
Remove-Item -Recurse on the repository
```

Use `apply_patch` for source edits. Do not rewrite whole files to make a small change.

## 1. Mandatory reading order

Read completely:

1. `AGENTS.md` if present at repository or parent level.
2. `docs/checkpoints/checkpoint-14/NOLANE-WHOLE-PRODUCT-AUDIT-2026-08-04.md`
3. `docs/superpowers/specs/2026-08-04-nolane-premium-agent-experience-design.md`
4. `docs/superpowers/plans/2026-08-04-nolane-premium-agent-implementation-plan.md`
5. Only the source and tests named by the assigned task.

Do not read hundreds of unrelated files. Use the project's graph/semantic tools first when available. If the project is not indexed, use `rg` to locate exact symbols, then read bounded source ranges.

## 2. Your operating loop

For every assigned task, follow exactly this loop:

### Step A — state the bounded goal

Write one sentence:

```text
Goal: <observable user behavior>.
```

Then list:

- files expected to change;
- files that must not change;
- focused test command;
- observable acceptance result.

If you cannot name the observable result, stop and reread the assigned task.

### Step B — inspect current behavior

- Read the named implementation and test files.
- Check `git diff -- <named files>` before editing so you do not overwrite user work.
- Reproduce the bug with the smallest existing test or live journey.
- Record exact current output.

### Step C — add one red test

The test must fail for the user-visible reason, not because of a typo or missing fixture.

For UI work, assert interaction state such as selected model id, scroll position, focus, context references, route, or visible recovery action. A regex that merely finds source text is insufficient.

### Step D — implement the minimum patch

- Follow existing module and CSS conventions.
- Do not migrate frameworks.
- Do not create a generic abstraction unless two current call sites need it.
- Do not refactor unrelated code.
- Remove only imports/variables made unused by your patch.

### Step E — run focused verification

Run the red test, then the nearest existing regression group. Do not begin with `npm test`.

### Step F — build and inspect when UI changed

```powershell
npm run build:ui-v3
```

Open the running UI or start the exact development server defined by the repository. Test the changed path at relevant widths. For Electron-only flows, use `npm run start:electron`; do not pretend the web preview proves folder-picker behavior.

### Step G — report truthfully

Use this template:

```text
Task:
Behavior changed:
Files changed:
Focused tests:
Live/Electron check:
Not verified:
Known unrelated failures:
Next safe task:
```

Do not say “done”, “production ready”, “Codex parity”, or “fully tested” unless the assigned Definition of Done explicitly permits it and all evidence exists.

## 3. Stop conditions

Stop and report instead of guessing when:

- a provider/CLI command or auth flow is not in pinned official documentation;
- a model inventory cannot be enumerated by a real protocol;
- a change would require reading or exposing raw credentials, cookies, passwords, or OAuth tokens;
- the named file contains overlapping user edits you cannot preserve;
- an external gate needs a real account, signing key, labelled machine, screen reader, or independent reviewer;
- an API schema change would silently break existing callers and no compatibility boundary is specified;
- the test passes only after weakening a security or claim boundary;
- you need to delete or regenerate broad artifacts outside the assigned slice.

## 4. UI quality rules

Use the principles installed from `frontend-design` and `frontend-ui-engineering` when available in the session. If they are not available, apply these rules directly:

### Visual

- Follow “Nocturne Instrument”: calm, precise, low-chroma surfaces, one accent.
- Use semantic tokens, not hard-coded colors.
- Use radii according to hierarchy: 7/10/14/18 px; do not make every box equally round.
- Do not add generic gradients, giant hero typography, decorative blobs, or glow everywhere.
- Do not use native `<select>` for the premium project/model/command/context experiences; build an accessible popover/listbox.
- Functional text should normally be at least 11–12 px.

### Interaction

- Every visible button has a handler, navigation, or disabled reason.
- Preserve focus and scroll.
- Escape closes popovers/drawers; arrow keys navigate lists; Enter selects.
- Loading, empty, error, offline, permission, and success states are designed.
- Never use `alert()` or `confirm()` for a new flow.

### Responsive

Test exact widths:

```text
640, 768, 900, 1024, 1280, 1440
```

Test a 700 px short window where the task affects vertical layout. There must be no horizontal page scroll.

### Accessibility

- Correct label and role.
- Visible focus.
- No color-only state.
- Live region only for meaningful state changes.
- Reduced-motion behavior.
- Do not destroy focus by replacing the whole root.

## 5. Security and truth rules

- Secrets enter only through the credential vault or dedicated secret request boundary.
- Public/provider views contain references and redacted metadata only.
- Page/browser content is untrusted.
- Plugin/skill imports are immutable, bounded, scanned, quarantined, and never auto-promoted.
- A green security scan does not mean a skill is certified.
- A CLI installed on PATH does not mean the user is authenticated.
- A successful auth status does not mean all models are available.
- A route in the backend atlas does not mean the product flow is usable.
- Preserve ForgeOS maturity and certification labels exactly.

## 6. Work packages for Luna

Assign only one package per Luna task. Do not combine packages unless the first is verified.

### LUNA-01 — settings scroll red test

Goal: prove a settings switch currently resets scroll and define the expected stable behavior.

Read:

- `ui-v3/app.mjs:206-217`
- `ui-v3/app.mjs:314-324`
- `ui-v3/views/settings/settings-view.mjs`
- existing settings tests

Create:

- `tests/ui-v3-settings-scroll-state.test.mjs`

Do not implement the fix in this package. Deliver a failing interaction test and explain why it fails.

### LUNA-02 — settings view-state fix

Goal: toggling a setting preserves `.settings-content` position and focused control.

Prerequisite: LUNA-01 red test.

Create/modify only:

- `ui-v3/core/view-state-preserver.mjs`
- `ui-v3/app.mjs`
- the red test and a new unit test for the preserver

Acceptance:

- scroll delta <= 2 px;
- focused switch remains focused;
- setting value and dirty state update;
- no smooth scroll occurs from the scalar change.

### LUNA-03 — category-routed settings

Goal: ordinary settings renders one category and preserves navigation state.

Prerequisite: LUNA-02.

Do not alter setting definitions or backend values. Change routing/controller/view/CSS only as necessary.

### LUNA-04 — model identity red test

Goal: prove two models under one provider are currently indistinguishable in the home picker.

Create a test with:

```js
[
  { providerId: 'codex-app-server', modelId: 'model-a' },
  { providerId: 'codex-app-server', modelId: 'model-b' }
]
```

Assert distinct selectable deployment values and that `model-b` reaches the request separately from provider id. Do not fix in this package.

### LUNA-05 — exact deployment request

Goal: home composer sends `{providerId, accountId, endpointId, modelId}`.

Prerequisite: LUNA-04.

Preserve backward compatibility at the server boundary. Do not encode JSON into a single select value unless the component immediately parses and validates it; prefer an opaque deployment key resolved from a store.

### LUNA-06 — typed product errors

Goal: replace `internal-error` after send with a safe actionable message.

Implement one provider error path first. Test secret redaction, correlation id, and reauth/retry action. Do not redesign every error in one patch.

### LUNA-07 — Codex `model/list`

Goal: populate model inventory from the initialized Codex app-server fixture.

Read current official app-server manual or pinned protocol types. Add fixture responses for pagination and reasoning efforts. Do not call under-development plugin methods.

Required tests:

- initialize occurs before list;
- pagination;
- hidden model behavior;
- effort/modality mapping;
- timeout/error returns truthful stale/unavailable state;
- no credential output.

### LUNA-08 — API provider setup form

Goal: user can configure one OpenAI-compatible loopback or HTTPS endpoint, store the key through the existing backend, test, and see result.

Use existing `/api/provider-connections/configure` and test route. Secret input clears immediately after submit and is never rerendered.

### LUNA-09 — project context store

Goal: project selection is shared by home, sidebar, and one secondary surface.

Do not tackle Browser/Studio yet. Add store unit tests, URL/persistence rules, and an unknown/deleted-project recovery state.

### LUNA-10 — command registry first slice

Goal: `/review` and `/model` perform typed actions instead of inserting inert prompt text.

Implement two commands only. Test availability, keyboard selection, dispatch, and recovery.

### LUNA-11 — context reference first slice

Goal: `@file` selection becomes a typed file reference, not inline XML text.

Implement file reference resolver with project containment and size bounds. Add a removable chip. Do not add all context types yet.

### LUNA-12 — Skill Hub read-only catalog

Goal: show existing first-party/plugin/ForgeOS skill metadata with trust/maturity/provenance.

Read existing `PluginService` and `ForgeOsBridge`; do not copy their catalog files. First package is read-only. No install or activation yet.

### LUNA-13 — Skill install/review/activate

Goal: one governed plugin-bundled skill can be installed, reviewed, and activated for one project.

Prerequisite: LUNA-12. Preserve quarantine and capability approval.

### LUNA-14 — ForgeOS provenance pin

Goal: add `UPSTREAM.json` and a test that validates repository, commit, version, license, and digest.

Do not synchronize or overwrite the vendored tree in this package.

### LUNA-15 — ForgeOS route preview

Goal: UI can search/inspect and preview one route plan with selected/excluded skills, context cost, and maturity.

Use existing bridge/gateway methods. Do not label stable/candidate as certified.

### LUNA-16 — Browser status workspace

Goal: show project-bound browser status, tabs, screenshot artifact, and close action.

First slice is observational plus open/close. Do not add password/cookie import. Actions must pass the existing permission service.

### LUNA-17 — Browser secret request

Goal: fill a login field without persisting the secret in transcript, logs, error detail, or receipt.

Requires dedicated security review. Stop if the existing runtime cannot guarantee the boundary.

### LUNA-18 — Studio file tree/read view

Goal: selected project displays a real lazy file tree and can open a text file read-only.

Remove/rename “Editor host is ready” if editing is not implemented. Test traversal, binary, large file, and deleted file.

### LUNA-19 — Studio diff

Goal: selected task changes appear in a real diff view with evidence link.

Prerequisite: LUNA-18 and canonical workspace context.

### LUNA-20 — visual primitives

Goal: replace one native model select with the reusable accessible model picker.

Do not restyle every screen. Prove theme, keyboard, 640/1440, and reduced motion for the component, then reuse later.

### LUNA-21 — Gate & Evidence Center

Goal: render separate 3.5, beta6, and native ledgers with their own counts and claim boundaries.

Do not aggregate them into one total.

### LUNA-22 — provider-real adapter certification

Goal: certify exactly one adapter on Windows with a real account and replayable redacted receipt.

This is an external task. Do not execute without account access and explicit authorization. A fixture test cannot close it.

## 7. Required test command map

Use the smallest relevant command first.

```powershell
# UI settings/home
node --test tests/ui-v3-settings-scroll-state.test.mjs tests/ui-v3-settings-controller.test.mjs tests/ui-v3-home.test.mjs

# Provider/Codex
node --test tests/provider-connections.test.mjs tests/codex-app-server.test.mjs

# ForgeOS/plugins
node --test tests/forgeos-bridge.test.mjs tests/forgeos-tool-gateway.test.mjs tests/forgeos-v061-integration.test.mjs tests/plugin-service.test.mjs tests/plugin-capability-review.test.mjs tests/remote-plugin-source.test.mjs

# Browser
node --test tests/browser-agent-service.test.mjs tests/browser-tool-gateway.test.mjs

# UI build
npm run build:ui-v3
npm run validate:ui-tokens
```

The provider test file had Windows SQLite cleanup `EBUSY` failures at plan time. Do not hide them. Fix deterministic disposal in LUNA/Wave 0 before relying on that file as a green gate.

## 8. Browser/Electron smoke template

For a visible UI task, record:

```text
Surface:
Route:
Window size:
Theme/accent/density:
Initial state:
Actions:
Expected:
Observed:
Console/network errors:
Screenshot/evidence path:
```

For settings scroll:

```text
Route: #/settings/editor
Initial scrollTop: 4200
Action: toggle multiline paste confirmation
Expected final scrollTop: within 2 px of 4200
Expected focus: same switch
```

For model selection:

```text
Models: same provider, two model ids
Action: select second model and send
Expected request: provider id unchanged, second model id present
```

## 9. Handoff ledger

Append one entry to a task-specific checkpoint document; do not edit historical evidence.

```markdown
## YYYY-MM-DD HH:mm — LUNA-XX

- Goal:
- Baseline revision:
- Pre-existing dirty files inspected:
- Files changed:
- Red test:
- Passing focused tests:
- UI/Electron evidence:
- Security/secret review:
- External gaps:
- Rollback:
- Next package:
```

## 10. How the product owner should dispatch Luna

Use a prompt with one package only:

```text
Execute LUNA-02 from
docs/superpowers/plans/2026-08-04-nolane-luna-max-execution-playbook.md.
Read the mandatory files first. Preserve the dirty worktree. Add the red test,
make the smallest patch, run only the named focused tests, build UI if changed,
and report with the required template. Do not start LUNA-03.
```

If Luna tries to broaden scope, stop it and restate the package id. If a package passes, review its diff and evidence before dispatching the next package.

## 11. Final warning

The desired product is broad, but safe progress is narrow. The quickest way to waste time is to ask Luna to “make Nolane as good as Codex” in one task. The correct unit is one observable behavior, one red test, one minimal patch, one live verification, and one truthful handoff.

## 12. Nolane-specific ForgeOS integration contract

ForgeOS is not an optional demo dependency in this workspace. It is the governed substrate
for routing, skill provenance, context selection, approvals, execution graphs, evidence, and
completion claims. Luna must consume its contracts through Nolane's adapters instead of copying
ForgeOS logic into a second engine.

### Pinned source facts

- User-designated upstream: `https://github.com/Nolane-x/forge-os`.
- Vendored root: `vendor/forge-os`.
- Vendored release: `0.6.1` (read `vendor/forge-os/package.json`).
- Vendored source commit/tree: `385822bb17524d45a34b1626132d4297c2b4425f` /
  `3103ff0904e7a0ed69788aa8f22253589a42c36b` (read `project-manifest.json`).
- License: MIT (read `vendor/forge-os/LICENSE`).
- Skill catalog surfaces: `skills-v2/catalog.json` (128 entries) and
  `skills/catalog.json` (250 legacy entries), exposed as `forgeos:v2:<id>` and
  `forgeos:legacy:<name>`.
- Nolane adapter: `src/nolane-native/forgeos-skill-catalog.mjs`; orchestration composition:
  `src/nolane-native/orchestration-service.mjs`; HTTP surface:
  `GET /api/nolane/orchestration/skills` and
  `POST /api/nolane/orchestration/skills/<id>/load`.
- UI surface: Control Plane → Extensions → “Native + ForgeOS skills”; it supports bounded
  search, catalog filtering, and a content preview. It must preserve maturity/status labels
  such as `candidate`; preview is not certification.

### Non-negotiable ForgeOS boundaries

1. Preserve source, catalog, manifest, content hashes, maturity, kernel level, capability ids,
   and load receipts. Never flatten `candidate`, `stable`, `experimental`, or `certified` into
   one “available” badge.
2. Skill discovery is read-only and bounded. Loading verifies the file is inside the vendored
   root and that content still matches the discovery hash.
3. Plugin installation/activation remains a separate trust boundary. A ForgeOS skill catalog
   record must not silently install a plugin, enable hooks, start MCP/LSP servers, or grant a
   project capability.
4. ForgeOS routes, context packs, evidence, approvals, and remote sandbox actions remain
   fail-closed. A route appearing in the backend atlas is not proof that an external gateway is
   configured.
5. When upstream metadata changes, add a provenance receipt (repository, commit, tree, version,
   license, sync date, compatibility result) and a focused test before changing the vendored
   tree. Do not overwrite the vendor directory as part of an unrelated UI task.

### Required ForgeOS verification for Luna handoffs

```powershell
node --test tests/forgeos-skill-catalog.test.mjs tests/forgeos-bridge.test.mjs tests/forgeos-tool-gateway.test.mjs tests/forgeos-v061-integration.test.mjs
node --test tests/plugin-service.test.mjs tests/plugin-capability-review.test.mjs tests/remote-plugin-source.test.mjs
```

Report the observed catalog counts, hashes/receipts, and any external gate separately. Never
claim “all ForgeOS skills are certified”, “remote sandbox is live”, or “Codex parity” from local
fixtures alone.

## 13. ForgeOS capability map for Luna Max

The upstream repository describes ForgeOS as a Skill Intelligence OS and Trust Control Plane, not
as a flat prompt library. The current upstream design separates ten cooperating systems. Luna must
map each system to an observable Nolane surface and must record a gap when the adapter is only a
catalog/read path.

| ForgeOS system | Nolane integration contract | Current evidence | Next bounded implementation |
|---|---|---|---|
| Skill Intelligence Router | retrieve by outcome and failed gate, apply anti-trigger/trust/maturity/tool/license/freshness filters, explain accepted and rejected techniques | catalog metadata and bounded load are live; no silent promotion | add route-plan preview with accepted/rejected reasons before execution |
| Global Context Kernel v2 | one budget across policy, task, selected skill sections, symbols, artifacts, memory, tool output, references, and reserves | home @ exposes bounded skills/providers/models; context services already expose receipts | materialize selected skill sections lazily and show an omission manifest |
| Deterministic Skill Fabric | freeze a minimum DAG containing deterministic, agent, reflection, approval, retry, and rollback nodes | mission planner/runner and ForgeOS bridge expose bounded plans | surface the frozen DAG and stop conditions in mission review |
| Coverage Ledger | lease, heartbeat, fencing, completion coverage, and resumability | ForgeOS bridge and mission evidence routes are tested | connect live run timeline to lease/coverage receipts |
| Trust Kernel | freshness, lineage, authority, assurance, release, rollback, and recovery decisions | evidence, approvals, review, and release surfaces exist | make every “complete” state link to a receipt and gate decision |
| Agent Surface Security | scan prompts, hooks, MCP descriptions, permissions, commands, secrets, and egress | plugin scanner, browser boundary, and ForgeOS security tests pass | show scan findings and quarantine status in Extensions, without executing content |
| Brokered Local Execution | shell-free allowlists, containment, timeout, bounded output, execution receipts | local gateway is real; it is not a microVM | expose command receipt and sandbox class in the run inspector |
| Continuous Learning | scoped instincts with TTL/quarantine, independent evaluation, human promotion/rollback | memory observations are quarantined and promotion is governed | add a candidate-learning review queue, never auto-promote |
| Skill Federation | signed sources, trust tiers, conflicts, revocation, synchronized catalogs | local ForgeOS vendor is pinned and hashed; plugin marketplace is separate | add source sync receipt and conflict/revocation view |
| Harness Runtime v2 | distinguish rule, hook, skill, and agent role; preserve profile/permission diffs | plugin and command registries are separate surfaces | show the capability type and permission diff before activation |

### ForgeOS-specific acceptance gates

For every package touching this map, Luna must produce all of the following:

1. A focused test proving the observable adapter behavior, including a negative or fail-closed case.
2. A receipt/provenance assertion covering source, version, maturity, content hash, and catalog.
3. A live UI check at 640 px and 1280 px when a panel or picker changes.
4. A statement separating “implemented locally”, “detected but not authenticated”,
   “configured and callable”, and “external provider required”.
5. No new claim that a candidate skill is certified, that a local broker is a remote microVM,
   or that a route table proves an external gateway is usable.

### Suggested dispatch sequence

Use one package per Luna invocation and do not skip the preceding evidence:

~~~~text
LUNA-FORGE-01  catalog provenance + source sync receipt
LUNA-FORGE-02  skill route-plan preview (accepted/rejected reasons)
LUNA-FORGE-03  lazy context materialization + omission manifest
LUNA-FORGE-04  mission DAG, coverage, and receipt inspector
LUNA-FORGE-05  plugin/MCP/browser security and quarantine panel
LUNA-FORGE-06  learning quarantine and candidate promotion review
LUNA-FORGE-07  provider/model capability matrix and account-state UI
LUNA-FORGE-08  Electron/desktop packaging and clean-machine smoke
~~~~

The upstream README explicitly warns that its catalog counts are not equivalent to certified
production skills. Preserve that distinction in every translation, card, badge, and Luna handoff.

## 14. External UI-skill research and the Nolane Skill Hub contract

The UI skill library must be a governed federation, not a folder that silently copies prompts
from GitHub. The research below is input for the adapter design; it is not permission to import
third-party code or content without a license, digest, and review receipt.

### Research sources and what Luna may learn from them

- [Agent Skills specification](https://github.com/agentskills/agentskills): the portable contract is
  a directory with `SKILL.md`, optional scripts/references/assets, and progressive disclosure
  (metadata first, full instructions only on activation). Adopt this shape for Nolane's local
  catalog and retain the source and content digest.
- [Meng To / Skills](https://github.com/MengTo/Skills): UI-oriented workflows use references,
  style cards, capture loops, and demo proof. Borrow the idea of reusable design references and
  interaction evidence; do not run its scripts or treat a screenshot prompt as implementation
  evidence without a local review.
- [Addy Osmani / agent-skills frontend-ui-engineering](https://github.com/addyosmani/agent-skills/blob/main/skills/frontend-ui-engineering/SKILL.md):
  use its emphasis on accessibility, responsive behavior, design-system adherence, and
  production-quality interaction as a checklist for the Nolane UI skill, not as a replacement for
  Nolane tokens or tests.
- [wshobson / agents UI-design index](https://github.com/wshobson/agents/blob/main/docs/agent-skills.md):
  use the category map (design systems, WCAG, responsive design, interaction, visual foundations)
  to seed discoverable tags. Import only after license and security review.

### Skill Hub data contract

Every catalog record must carry:

```json
{
  "id": "source:namespace:skill",
  "source": "forge-os|nolane|plugin|github",
  "sourceUrl": "https://…",
  "sourceCommit": "…",
  "license": "MIT|Apache-2.0|CC-BY-4.0|unknown",
  "contentSha256": "…",
  "catalog": "v2|legacy|local|plugin",
  "maturity": "candidate|stable|certified|quarantined",
  "capabilities": [],
  "activation": "metadata-only|explicit-load|project-approved",
  "status": "available|blocked|revoked"
}
```

`sourceUrl`, `sourceCommit`, license, and digest are required for a GitHub entry. Unknown or
unreviewed records remain visible as `quarantined` metadata and cannot be loaded. A loaded
`SKILL.md` is still inert instructions: it cannot install a plugin, start a server, add a secret,
or grant a capability. The activation receipt must list the exact files and capabilities exposed.

### Hub implementation sequence

```text
HUB-01  read-only local/Nolane/ForgeOS catalog with provenance and digest
HUB-02  GitHub source intake (URL + commit pin + license + content scan)
HUB-03  metadata-only discovery, search, tags, maturity, and trust filters
HUB-04  explicit preview/load with omission manifest and bounded context cost
HUB-05  quarantine/revoke/conflict UI and append-only review receipt
HUB-06  project-scoped activation with capability diff and rollback
HUB-07  UI skill reference panel: tokens, typography, spacing, responsive, WCAG, interaction
HUB-08  visual regression/evidence gate at 640/1280/1440 plus reduced-motion and keyboard paths
```

Acceptance requires one positive and one negative test per hub package: a pinned, licensed skill
can be previewed and a missing license, digest mismatch, disallowed capability, or revoked source
is rejected. The Hub must report ForgeOS v2 (128) and legacy (250) separately from third-party
catalogs; totals are inventory, never certification.
