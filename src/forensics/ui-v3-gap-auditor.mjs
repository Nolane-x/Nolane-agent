import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export const UI_V3_MASTER_PLAN_ITEMS = Object.freeze([
  { id: 'task-01-capability-inventory', title: 'Capability inventory and UI contract', paths: ['src/ui/capability-registry.mjs', 'scripts/audit-ui-capabilities.mjs', 'tests/ui-capability-registry.test.mjs'] },
  { id: 'task-02-performance-baseline', title: 'Performance and visual baseline', paths: ['scripts/capture-ui-performance-baseline.mjs', 'tests/ui-performance-budget.test.mjs', 'docs/ui-v3/performance-baseline.json'] },
  { id: 'task-03-isolated-ui-v3-build', title: 'Isolated UI v3 build and fallback switch', paths: ['ui-v3/index.html', 'ui-v3/app.mjs', 'scripts/build-ui-v3.mjs', 'tests/ui-v3-root-switch.test.mjs'] },
  { id: 'task-04-design-tokens', title: 'Three-layer design token system', paths: ['ui-v3/styles/tokens/primitive.css', 'ui-v3/styles/tokens/semantic.css', 'ui-v3/styles/tokens/component.css', 'scripts/validate-ui-tokens.mjs', 'tests/ui-v3-tokens.test.mjs'] },
  { id: 'task-05-shell-router', title: 'Lightweight AppShell and router', paths: ['ui-v3/core/router.mjs', 'ui-v3/core/ui-store.mjs', 'ui-v3/core/ui-bus.mjs', 'ui-v3/shell/app-shell.mjs', 'ui-v3/shell/global-rail.mjs', 'tests/ui-v3-router.test.mjs', 'tests/ui-v3-shell.test.mjs'] },
  { id: 'task-06-session-sidebar', title: 'Session Sidebar and project switcher', paths: ['ui-v3/shell/session-sidebar.mjs', 'ui-v3/shell/project-switcher.mjs', 'ui-v3/core/session-view-model.mjs', 'tests/ui-v3-session-sidebar.test.mjs'] },
  { id: 'task-07-home-composer', title: 'Home and Mission Composer', paths: ['ui-v3/views/home/home-view.mjs', 'ui-v3/views/home/mission-composer.mjs', 'ui-v3/core/intent-presets.mjs', 'tests/ui-v3-home.test.mjs'] },
  { id: 'task-08-incremental-mission', title: 'Incremental Mission Workspace', paths: ['ui-v3/views/mission/mission-view.mjs', 'ui-v3/views/mission/mission-header.mjs', 'ui-v3/views/mission/status-strip.mjs', 'ui-v3/views/mission/activity-timeline.mjs', 'ui-v3/views/mission/activity-item.mjs', 'ui-v3/views/mission/mission-composer.mjs', 'tests/ui-v3-mission-incremental.test.mjs'] },
  { id: 'task-09-risk-cards', title: 'Approval, permission, and recovery cards', paths: ['ui-v3/views/mission/approval-card.mjs', 'ui-v3/views/mission/permission-card.mjs', 'ui-v3/views/mission/recovery-card.mjs', 'ui-v3/core/risk-copy.mjs', 'tests/ui-v3-approval-flow.test.mjs'] },
  { id: 'task-10-artifact-dock', title: 'Contextual Artifact Dock', paths: ['ui-v3/views/mission/artifact-dock.mjs', 'ui-v3/views/mission/artifact-registry.mjs', 'ui-v3/views/mission/artifacts/plan-artifact.mjs', 'ui-v3/views/mission/artifacts/tests-artifact.mjs', 'ui-v3/views/mission/artifacts/preview-artifact.mjs', 'tests/ui-v3-artifact-dock.test.mjs'] },
  { id: 'task-11-review-ship', title: 'Review and Ship workflow', paths: ['ui-v3/views/review/review-view.mjs', 'ui-v3/views/review/change-navigator.mjs', 'ui-v3/views/review/diff-viewport.mjs', 'ui-v3/views/review/verification-summary.mjs', 'ui-v3/views/review/ship-actions.mjs', 'ui-v3/workers/diff-worker.mjs', 'tests/ui-v3-review-flow.test.mjs'] },
  { id: 'task-12-workroom-split', title: 'Workroom and administration split', paths: ['ui-v3/views/workroom/workroom-view.mjs', 'ui-v3/views/workroom/file-tree.mjs', 'ui-v3/views/workroom/editor-host.mjs', 'ui-v3/views/workroom/terminal-host.mjs', 'tests/ui-v3-workroom-lazy.test.mjs', 'tests/ui-v3-advanced-migration.test.mjs'] },
  { id: 'task-13-control-plane-shell', title: 'Control Plane shell and route registry', paths: ['ui-v3/control-plane/control-plane-shell.mjs', 'ui-v3/control-plane/route-registry.mjs', 'ui-v3/control-plane/overview/overview-view.mjs', 'tests/ui-v3-control-plane-shell.test.mjs'] },
  { id: 'task-14-runtime-operations-security', title: 'Runtime, operations, and security domains', paths: ['ui-v3/control-plane/domains/operations.mjs', 'ui-v3/control-plane/domains/runtime.mjs', 'ui-v3/control-plane/domains/trust-security.mjs'] },
  { id: 'task-15-context-evidence-intelligence', title: 'Context, evidence, and intelligence domains', paths: ['ui-v3/control-plane/domains/context-memory.mjs', 'ui-v3/control-plane/domains/evidence.mjs', 'ui-v3/control-plane/domains/intelligence.mjs', 'ui-v3/workers/graph-worker.mjs', 'ui-v3/workers/search-worker.mjs'] },
  { id: 'task-16-governance-autonomy-extensions-release', title: 'Governance, autonomy, extensions, and release domains', paths: ['ui-v3/control-plane/domains/governance.mjs', 'ui-v3/control-plane/domains/autonomy.mjs', 'ui-v3/control-plane/domains/extensions.mjs', 'ui-v3/control-plane/domains/release.mjs'] },
  { id: 'task-17-motion-performance-policy', title: 'Motion, visibility, and performance policies', paths: ['ui-v3/styles/motion.css', 'ui-v3/core/scheduler.mjs', 'ui-v3/core/visibility-policy.mjs', 'ui-v3/core/performance-observer.mjs', 'tests/ui-v3-motion-policy.test.mjs'] },
  { id: 'task-18-accessibility-release-gate', title: 'Accessibility, visual regression, and release gate', paths: ['scripts/audit-ui-v3-accessibility.mjs', 'scripts/capture-ui-v3-states.mjs', 'scripts/verify-ui-v3-release.mjs', 'tests/ui-v3-accessibility.test.mjs', 'tests/ui-v3-release-gate.test.mjs'] },
  { id: 'external-windows-8gb-certification', title: 'Real Windows 11 8 GB performance/accessibility certification', paths: [], external: true },
]);

async function exists(root, relativePath) {
  try { await access(path.join(root, relativePath)); return true; } catch { return false; }
}

async function detectDefaultUiVersion(root) {
  try {
    const source = await readFile(path.join(root, 'src', 'app.mjs'), 'utf8');
    const match = source.match(/get\(\s*['"]UI_VERSION['"]\s*,\s*['"](v[23])['"]\s*\)/);
    return match?.[1] ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function auditUiV3MasterPlan({ root = process.cwd(), requiredArtifacts = UI_V3_MASTER_PLAN_ITEMS } = {}) {
  if (!Array.isArray(requiredArtifacts)) throw new TypeError('requiredArtifacts must be an array');
  const defaultUiVersion = await detectDefaultUiVersion(root);
  const items = [];
  for (const item of requiredArtifacts) {
    if (!item?.id || !item?.title || !Array.isArray(item.paths)) throw new TypeError('Invalid UI master-plan item');
    if (item.external === true) {
      items.push(Object.freeze({ ...item, status: 'external-certification', presentPaths: [], missingPaths: [] }));
      continue;
    }
    const pathStates = await Promise.all(item.paths.map(async (relativePath) => ({ relativePath, present: await exists(root, relativePath) })));
    const presentPaths = pathStates.filter((entry) => entry.present).map((entry) => entry.relativePath);
    const missingPaths = pathStates.filter((entry) => !entry.present).map((entry) => entry.relativePath);
    const status = presentPaths.length === item.paths.length && item.paths.length > 0 ? 'implemented' : presentPaths.length > 0 ? 'partial' : 'missing';
    items.push(Object.freeze({ ...item, status, presentPaths, missingPaths }));
  }
  const summary = {
    implemented: items.filter((item) => item.status === 'implemented').length,
    partial: items.filter((item) => item.status === 'partial').length,
    missing: items.filter((item) => item.status === 'missing').length,
    externalCertification: items.filter((item) => item.status === 'external-certification').length,
    total: items.length,
  };
  const blockers = [];
  if (defaultUiVersion !== 'v3') blockers.push('UI v3 is not the default renderer');
  if (summary.partial > 0) blockers.push(`${summary.partial} UI master-plan items are partial`);
  if (summary.missing > 0) blockers.push(`${summary.missing} UI master-plan items are missing`);
  if (summary.externalCertification > 0) blockers.push(`${summary.externalCertification} UI items require external certification`);
  const sourceLocalComplete = defaultUiVersion === 'v3' && summary.partial === 0 && summary.missing === 0;
  return Object.freeze({
    schema: 'nolane.forensics.ui-v3-master-plan-gap-audit.v1',
    defaultUiVersion,
    sourceLocalComplete,
    complete: sourceLocalComplete && summary.externalCertification === 0,
    summary: Object.freeze(summary),
    blockers: Object.freeze(blockers),
    items: Object.freeze(items),
  });
}
