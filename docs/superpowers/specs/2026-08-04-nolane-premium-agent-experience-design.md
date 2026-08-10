# Nolane Premium Agent Experience — product and UX specification

Date: 2026-08-04  
Status: proposed implementation contract  
Audience: product owner, implementers, reviewers, and test agents

## 1. Product thesis

Nolane should be a **local-first agent operating cockpit**: one calm desktop surface where a user selects a real project, chooses an authenticated model deployment, attaches structured context, delegates work, watches actions, approves consequences, reviews changes, and resumes after interruption.

It should learn interaction quality from Codex and provider breadth from Hermes without cloning either product. Its differentiator is the combination of:

- provider-neutral agent harnesses;
- ForgeOS skill intelligence, trust, routing, evidence, and federation;
- visible project-local files, terminal, browser, changes, and receipts;
- progressive modes that reveal power without turning the UI into a raw API console.

## 2. Non-goals

- Do not copy Codex branding, layout, or private implementation.
- Do not add static provider/model names and call them discovery.
- Do not treat browser passwords, cookies, or tokens as ordinary prompt context.
- Do not expose all 426 backend routes as equivalent end-user features.
- Do not turn Everyday mode into a toy UI or Expert mode into raw JSON by default.
- Do not duplicate ForgeOS catalogs, routing, trust, or federation logic inside the UI.

## 3. Experience promise

For every agent task, a user can answer these questions without leaving the task:

1. Which project is active?
2. Which account, provider, model, effort, and execution mode are active?
3. What context, skills, plugins, and tools are attached?
4. What is the agent doing now, and why?
5. What has changed?
6. What needs my approval?
7. What evidence says the task is complete?
8. How do I undo, branch, retry, or resume?

## 4. Information architecture

### 4.1 Global rail

The rail contains only stable product destinations:

- Chat / Tasks
- Projects
- Search
- Reviews
- Skills & Extensions
- Browser
- Studio
- Settings

The active item uses one restrained accent marker. Labels appear on hover/focus and remain readable at 200% zoom.

### 4.2 Project/session sidebar

The sidebar is a project and session navigator, not a decorative empty state.

Top:

- Nolane identity and compact account/runtime status.
- New task.
- Search tasks/projects.

Body:

- Pinned tasks.
- Projects, each expandable to recent tasks.
- Background/running tasks with truthful state indicators.

Footer:

- Selected account identity.
- Runtime/provider health summary.
- Help/diagnostics entry.

The hamburger button toggles this sidebar at narrow widths and must cover the workspace beneath it with an opaque or sufficiently blurred scrim. It must never leave large hero text visually colliding through the panel.

### 4.3 Task workspace

The workspace has four composable regions:

- transcript / activity timeline;
- composer;
- artifact drawer for plan, changes, tests, browser screenshots, and evidence;
- optional Studio split pane for files, terminal, browser, or preview.

Regions may collapse, but their state persists per task and project.

## 5. Visual direction: “Nocturne Instrument”

Nolane should feel like a premium technical instrument: quiet, precise, dense enough for real work, and never sterile.

### 5.1 Character

- Deep neutral canvas with low-chroma layered surfaces.
- One configurable accent; lavender is the default, not a universal hard-coded purple.
- Crisp typography with modest display moments and highly legible work text.
- Soft geometry: 7, 10, 14, and 18 px semantic radii. Use 18 px for major floating surfaces, 10–14 px for controls/cards, and 7 px for dense rows. Do not round every container equally.
- Light and paper themes are first-class, not inverted afterthoughts.
- Shadows communicate elevation only; glow is reserved for focus/active agent state.

### 5.2 What to remove

- Giant generic hero copy that consumes the task area.
- Decorative ambient blobs behind text-heavy workflows.
- Native `<select>` menus that ignore theme and hierarchy.
- Excessive bordered cards nested inside bordered cards.
- Tiny 8–9 px functional text except nonessential metadata.
- Buttons that look enabled but have no action.

### 5.3 Typography

- UI text: Inter / Segoe UI Variable fallback, 12–14 px for controls and body.
- Page titles: 24–34 px, not 64–80 px on a desktop agent home.
- Code/IDs: Cascadia Code fallback, minimum 11 px for interactive or diagnostic content.
- Maintain a maximum readable line length of about 72 characters for narrative content.

### 5.4 Motion

- 120–200 ms for control feedback; 200–340 ms for panel transitions.
- No layout motion on settings control changes.
- Reduced-motion mode eliminates nonessential transforms, smooth scroll, glow pulses, and animated progress decorations.

## 6. Core screens

### 6.1 Home / New task

Replace the large hero with a compact cockpit:

- contextual greeting and active project status;
- one primary composer;
- recent/running tasks and blocked approvals below;
- optional starter cards only when the project has no recent task.

Composer header:

- Project picker with search, recent projects, New project, and “No project”.
- Provider readiness with an actionable status, not only “1 provider ready”.

Composer body:

- Multiline objective.
- Structured chips for files, symbols, URLs, tools, skills, agents, memory, browser tabs, and plugins.
- Attached file preview/removal; never dump entire attachment text invisibly into the objective.

Composer footer:

- Attach.
- `@` context browser.
- `/` command palette.
- intent/mode.
- model button showing model + effort + speed.
- send/stop.

### 6.2 Project picker

The picker is a custom accessible popover:

- search field;
- recent projects;
- projects grouped by pinned/other;
- name plus bounded path;
- selected check;
- New project action using Electron directory picker;
- “Don't work in a project” when the chosen task permits it.

On selection, update the canonical `WorkspaceContext`; do not encode project identity only in a form field.

### 6.3 Provider & Account Center

Sections:

- Connected accounts
- CLI harnesses
- API providers
- Local runtimes
- Model inventory
- Diagnostics

Each provider card shows:

- installed/available;
- account/auth state;
- connection health and last test;
- model inventory freshness and source;
- supported controls;
- sign in / configure / reauthenticate / test / disconnect actions;
- expandable redacted diagnostic details.

API setup is a stepper:

1. Provider kind.
2. Endpoint and account label.
3. Secret input into the credential vault.
4. Discover or manually enter an initial model when discovery is impossible.
5. Test connection.
6. Save and choose default.

Never echo a secret after submission. Show only a credential reference and last-updated metadata.

### 6.4 Model picker

Model choice is an exact deployment, not a provider label.

The trigger displays:

`model display name · effort` and an optional speed/service-tier badge.

Popover levels:

1. Recommended and recent deployments.
2. Model selection grouped by account/provider.
3. Effort options advertised by that model.
4. Speed/service tier when advertised.
5. Advanced: personality, modalities, context/capability truth, and source freshness.

Canonical identity:

```ts
type ModelDeploymentKey = {
  providerId: string;
  accountId: string | null;
  endpointId: string | null;
  modelId: string;
};
```

Do not show unsupported effort/speed options. If inventory is unknown, say “CLI-selected model; inventory unavailable” and provide a documented manual override instead of pretending discovery succeeded.

### 6.5 Slash command palette

`/` opens a searchable, keyboard-first palette. Commands are registry entries with availability predicates and typed execution behavior.

Core groups:

- Session: new, rename, fork, archive, compact, status, usage.
- Model: model, effort, speed, personality.
- Agent: plan, build, verify, review, agent/subagents, stop.
- Project: project, mention, files, diff, terminal.
- Tools: MCP, browser, skills, plugins, hooks, apps/integrations.
- Safety: permissions, approvals, sandbox.
- Support: diagnostics, feedback.

Commands that change local UI execute through a trusted local dispatcher. Backend commands call `/api/commands/:id` or the relevant typed service. Text insertion is only for commands explicitly defined as prompt macros.

### 6.6 `@` context browser

`@` returns structured results from a federated context index:

- project files/folders and symbols;
- open/recent files;
- model/provider/account;
- MCP tools/resources;
- installed skills and plugins;
- agent/subagent/session;
- memories/evidence/checkpoints;
- browser tabs and screenshots;
- optional connected apps.

Each selected result becomes a removable chip carrying type, stable id, label, scope, provenance, and permission state. The mission request contains a `contextRefs` array; prompt rendering happens at the trusted context boundary.

### 6.7 Skill Hub and Extensions

Nolane has one front door for skills and plugins, backed by distinct package types.

Tabs:

- Discover
- Installed
- Updates
- Sources
- Quarantine

Skill detail:

- publisher/source/commit/version/license;
- trigger description and anti-triggers;
- required tools and compatible harnesses;
- estimated context cost;
- maturity: discovered, quarantined, candidate, stable, certified, deprecated;
- scan/evaluation/evidence freshness;
- contents inventory without executing scripts;
- install/activate/update/rollback actions.

Plugin detail additionally shows MCP servers, tools, commands, hooks, agents, and requested capabilities. Activation remains per project where appropriate.

The first-party source is “Nolane Registry”. ForgeOS is a pinned federated source and the intelligence/trust substrate. GitHub and other marketplaces enter through the same immutable, quarantine-first intake pipeline.

### 6.8 ForgeOS Intelligence Center

This surface reveals ForgeOS value without pretending all catalog entries are certified.

- Search/inspect 250 Agent Skills v1 and 128 deep technique contracts from the pinned upstream.
- Route preview: selected techniques, exclusions, anti-triggers, compatibility, token budget, and evidence.
- Context pack preview: exact sections and token estimate before injection.
- Federation sources: trust tier, pin, license, scan, quarantine, conflicts, revocation, sync.
- Evidence and maturity distribution.
- One-time approvals for protected execution paths.

The UI must preserve ForgeOS's claim boundary: current upstream documentation says zero of the 128 techniques satisfy its final certification definition. “Stable channel”, “candidate”, and “certified” are never visually conflated.

### 6.9 Browser workspace

The browser is project-scoped and uses a profile separate from the user's normal browser unless a dedicated connector is explicitly used.

Layout:

- toolbar: back/forward/reload, address, project/session, viewport, open/close;
- live screenshot or embedded view where supported;
- tab strip;
- action timeline showing click/type/find/snapshot;
- inspect drawer: DOM/accessibility, console, network, screenshots, journey assertions;
- permission drawer: allowed/blocked sites and consequential-action approvals.

Password and cookie rules:

- A user may sign in directly inside the isolated browser profile.
- Nolane does not show, export, or inject raw passwords/cookies into model context.
- Sensitive typing must use a dedicated secret/clarification request whose value is delivered to the action boundary and redacted from logs.
- Cookie/profile import, if ever added, requires an explicit platform-supported flow, user confirmation, data-scope preview, and reset controls.

### 6.10 Studio

Studio is a real project workbench:

- left: file tree/search;
- center: read/editor/diff/preview tabs;
- right: agent/terminal/activity;
- bottom: diagnostics/test output/status.

The first release may be read-mostly, but every visible button must work. If editing is not enabled, label it Preview/Read rather than “editor ready”. Changes originate from task events and are reviewable before ship.

### 6.11 Settings

Settings uses category routing, not a 15,000 px single page.

- The left navigation is stable.
- The main area renders one category at a time.
- Search renders matched settings with category breadcrumbs.
- Category, scroll, focus, disclosure, and dirty state survive changes and browser navigation.
- Save/reset scope actions remain visible without covering content.
- Provider/model setup may deep-link into Provider Center rather than duplicating complex forms.

### 6.12 Gate & Evidence Center

Do not show a single unexplained gate count. Present:

- ledger name and version;
- environment and generated time;
- verified/partial/external/missing counts;
- open requirements;
- evidence receipt and freshness;
- claim allowed / claim blocked;
- actions to run local checks or attach external receipts.

Historical 3.5, current beta6, and native waves 16–19 are separate views.

## 7. State and domain contracts

### 7.1 Workspace context

```ts
type WorkspaceContext = {
  projectId: string | null;
  workspaceRootRef: string | null;
  sessionId: string | null;
  taskId: string | null;
  deployment: ModelDeploymentKey | null;
};
```

One store owns it. URL, persisted session state, sidebar, composer, Studio, browser, and APIs consume the same snapshot.

### 7.2 Composer draft

```ts
type ComposerDraft = {
  objective: string;
  intent: 'ask' | 'plan' | 'build' | 'verify';
  workspace: WorkspaceContext;
  contextRefs: ContextReference[];
  command: CommandInvocation | null;
  permissionProfileId: string | null;
};
```

### 7.3 Provider adapter

Every harness implements a capability-advertised contract, not a loose command array:

```ts
interface HarnessAdapterV1 {
  detect(): Promise<HarnessDetection>;
  auth?: HarnessAuthAdapter;
  models?: HarnessModelInventoryAdapter;
  sessions: HarnessSessionAdapter;
  commands?: HarnessCommandCatalogAdapter;
  context?: HarnessContextAdapter;
  extensions?: HarnessExtensionAdapter;
}
```

Unsupported members are absent and rendered as unsupported. They are not emulated through unverified shell guesses.

### 7.4 Error envelope

```ts
type ProductError = {
  code: string;
  userMessage: string;
  retryable: boolean;
  action?: 'retry' | 'reauth' | 'open-settings' | 'choose-model' | 'choose-project';
  providerId?: string;
  taskId?: string;
  correlationId: string;
  safeDetail?: string;
};
```

Secrets and raw auth payloads never enter `safeDetail`.

## 8. Provider and harness roadmap

Priority is based on protocol depth and user value, not the number of logos.

1. Codex app-server: auth, `model/list`, threads/turns, approvals, skills/plugins/MCP status.
2. Claude Code: official auth status/login/logout, model/config inventory when documented, session streaming, approvals.
3. Gemini CLI: documented auth and model/config inventory, session events.
4. OpenCode: replace generic-local handling with a real adapter where its documented protocol allows it.
5. Hermes: ACP or TUI gateway integration plus `/api/model/options`; use its command/model catalog, not screen scraping.
6. GitHub Copilot CLI / ACP-compatible clients.
7. Cline, Roo Code, Windsurf, Continue, Cursor, OpenClaw, Pi through MCP/ACP/A2A or supported native protocols.

An adapter is “supported” only after install detection, auth state, model selection, one real session, cancellation, error mapping, and a provider-real receipt pass on Windows.

## 9. Responsive modes

| Width | Mode | Required behavior |
|---|---|---|
| 1440+ | Wide desktop | Sidebar + workspace + optional artifact/Studio pane |
| 1024–1439 | Standard desktop | Sidebar + workspace; secondary pane overlays or resizes |
| 768–1023 | Narrow desktop/tablet | Rail + workspace; sidebar and artifacts are modal overlays |
| 640–767 | Compact | No persistent two-column settings; single primary region with drawers |

Test exact 640, 768, 900, 1024, 1280, and 1440 widths and short heights 520/700. No horizontal document scroll. Panels must be reachable by keyboard and dismissible with Escape.

## 10. Accessibility contract

- WCAG 2.2 AA target.
- Full keyboard operation for project/model/context/command/plugin pickers.
- Roving active descendant or listbox semantics; no focus loss after rerender.
- Visible focus with at least 3:1 contrast against adjacent color.
- Minimum 24x24 pointer targets in dense mode and 40x40 in touch/compact mode.
- Announce task state, provider failures, save state, and approvals through scoped live regions.
- No color-only status.
- 200% zoom and forced-colors coverage.
- Reduced motion and no surprise scroll.

## 11. Definition of product completeness

A surface is complete only when all are true:

- empty/loading/error/success/offline/permission states exist;
- primary and recovery actions work;
- keyboard and screen-reader semantics are tested;
- project/provider/model identity reaches the backend correctly;
- no secret enters DOM logs or error detail;
- interaction survives rerender/navigation/restart as designed;
- a browser journey proves the result;
- capability truth and external limitations are visible;
- responsive/theme matrices pass;
- release ledger points to the evidence receipt.

## 12. Primary research used

- OpenAI Codex/App model selection: <https://learn.chatgpt.com/docs/models.md>
- OpenAI browser and Computer Use boundaries: <https://learn.chatgpt.com/docs/browser.md>
- OpenAI Codex slash commands: <https://learn.chatgpt.com/docs/developer-commands.md?surface=cli>
- OpenAI skills concept: <https://developers.openai.com/plugins/concepts/skills.md>
- OpenAI Codex app-server protocol: <https://learn.chatgpt.com/docs/app-server.md>
- Hermes provider/account/model setup: <https://github.com/NousResearch/hermes-agent/blob/main/website/docs/integrations/providers.md>
- Hermes ACP, gateway, HTTP API, and full model options: <https://github.com/nousresearch/hermes-agent/blob/main/website/docs/developer-guide/programmatic-integration.md>
- ForgeOS current catalog, trust, adapters, and claim boundary: <https://github.com/Nolane-x/forge-os>
- Anthropic frontend-design skill: <https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md>
- Addy Osmani frontend-ui-engineering skill: <https://github.com/addyosmani/agent-skills/blob/main/skills/frontend-ui-engineering/SKILL.md>
