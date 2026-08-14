const OPTION_LABELS = Object.freeze({
  'allow-once': 'Allow once', 'allow-project': 'Always for this project', deny: 'Deny', approve: 'Approve', cancel: 'Cancel', revise: 'Request changes', retry: 'Retry safely',
});

export function createAttentionCard({ kind = 'approval', action, why, impact, scope = [], reversible = true, options = [], technical = {} } = {}) {
  const cleanAction = String(action ?? '').trim();
  const cleanWhy = String(why ?? '').trim();
  const cleanImpact = String(impact ?? '').trim();
  if (!cleanAction) throw new Error('Attention card action is required');
  if (!cleanWhy) throw new Error('Attention card reason is required');
  if (!cleanImpact) throw new Error('Attention card impact is required');
  if (!Array.isArray(scope) || scope.length === 0) throw new Error('Attention card scope is required');
  const normalizedOptions = [...new Set(options.map(String))];
  if (!reversible && !normalizedOptions.some((id) => ['deny', 'cancel'].includes(id))) throw new Error('Irreversible action requires a deny or cancel option');
  if (normalizedOptions.length === 0) throw new Error('Attention card options are required');
  return Object.freeze({
    schema: 'nolane.agent.attention-card.v1', kind, requiresAction: true, action: cleanAction, why: cleanWhy, impact: cleanImpact,
    scope: Object.freeze(scope.map(String)), reversibility: reversible ? 'reversible' : 'irreversible',
    summary: `${cleanAction}. ${cleanWhy}. ${cleanImpact}.`,
    options: Object.freeze(normalizedOptions.map((id) => Object.freeze({ id, label: OPTION_LABELS[id] ?? id }))),
    technicalDetails: Object.freeze({ expanded: false, data: Object.freeze({ ...technical }) }),
  });
}

export function renderAttentionCard(card) {
  return `<aside class="attention-card" data-kind="${card.kind}"><h2>${card.action}</h2><p>${card.why}</p><p>${card.impact}</p><ul>${card.scope.map((item) => `<li>${item}</li>`).join('')}</ul><div>${card.options.map((option) => `<button data-attention-action="${option.id}">${option.label}</button>`).join('')}</div></aside>`;
}
