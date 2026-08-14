const nonNegative = (value) => Math.max(0, Number(value) || 0);
export function buildOverviewView({ health = 'unknown', activeMissions = 0, pendingApprovals = 0, evidenceGaps = 0, providerFailures = 0, indexFreshness = 'unknown' } = {}) {
  const actions = [];
  if (nonNegative(pendingApprovals)) actions.push(Object.freeze({ kind: 'approval', count: nonNegative(pendingApprovals), route: '/control-plane/operations/queues' }));
  if (nonNegative(evidenceGaps)) actions.push(Object.freeze({ kind: 'evidence-gap', count: nonNegative(evidenceGaps), route: '/control-plane/evidence/gaps' }));
  if (nonNegative(providerFailures)) actions.push(Object.freeze({ kind: 'provider', count: nonNegative(providerFailures), route: '/control-plane/extensions/providers' }));
  return Object.freeze({ health: String(health), activeMissions: nonNegative(activeMissions), pendingApprovals: nonNegative(pendingApprovals), evidenceGaps: nonNegative(evidenceGaps), providerFailures: nonNegative(providerFailures), indexFreshness: String(indexFreshness), actions: Object.freeze(actions), actionRequired: actions.length > 0, decorativeCharts: false });
}
export function renderOverviewView(value) { return `<section><h1>System Overview</h1><p>${value.health} · ${value.activeMissions} active missions</p><p>${value.actions.length} action groups require attention</p></section>`; }
