const COPY = Object.freeze({
  en: Object.freeze({ scope:'Scope', reversibility:'Reversibility', reversible:'Can be reversed', irreversible:'Cannot be undone', technical:'Technical details', options:Object.freeze({ 'allow-once':'Allow once', 'allow-project':'Always for this project', deny:'Deny', approve:'Approve', cancel:'Cancel', revise:'Request changes', retry:'Retry safely', queue:'Queue' }) }),
  vi: Object.freeze({ scope:'Phạm vi', reversibility:'Khả năng hoàn tác', reversible:'Có thể hoàn tác', irreversible:'Không thể hoàn tác', technical:'Chi tiết kỹ thuật', options:Object.freeze({ 'allow-once':'Cho phép một lần', 'allow-project':'Luôn cho phép trong dự án này', deny:'Từ chối', approve:'Phê duyệt', cancel:'Hủy', revise:'Yêu cầu chỉnh sửa', retry:'Thử lại an toàn', queue:'Đưa vào hàng đợi' }) }),
});
const languageKey = (value='en') => String(value).toLowerCase().startsWith('vi') ? 'vi' : 'en';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

export function createAttentionCard({ language='en', kind = 'approval', action, why, impact, scope = [], reversible = true, options = [], technical = {} } = {}) {
  const cleanAction = String(action ?? '').trim();
  const cleanWhy = String(why ?? '').trim();
  const cleanImpact = String(impact ?? '').trim();
  if (!cleanAction) throw new Error('Attention card action is required');
  if (!cleanWhy) throw new Error('Attention card reason is required');
  if (!cleanImpact) throw new Error('Attention card impact is required');
  if (!Array.isArray(scope) || scope.length === 0) throw new Error('Attention card scope is required');
  const lang = languageKey(language);
  const normalizedOptions = [...new Set(options.map(String))];
  if (!reversible && !normalizedOptions.some((id) => ['deny', 'cancel'].includes(id))) throw new Error('Irreversible action requires a deny or cancel option');
  if (normalizedOptions.length === 0) throw new Error('Attention card options are required');
  return Object.freeze({
    schema: 'nolane.agent.attention-card.v1', language:lang, kind:String(kind), requiresAction: true, action: cleanAction, why: cleanWhy, impact: cleanImpact,
    scope: Object.freeze(scope.map(String)), reversibility: reversible ? 'reversible' : 'irreversible',
    summary: `${cleanAction}. ${cleanWhy}. ${cleanImpact}.`,
    options: Object.freeze(normalizedOptions.map((id) => Object.freeze({ id, label: COPY[lang].options[id] ?? id }))),
    technicalDetails: Object.freeze({ expanded: false, data: Object.freeze({ ...technical }) }),
  });
}

export function renderAttentionCard(card) {
  const lang = languageKey(card?.language);
  const copy = COPY[lang];
  const technicalEntries = Object.entries(card?.technicalDetails?.data ?? {}).filter(([key]) => !/(token|secret|password|credential|api[-_]?key|authorization)/i.test(key));
  return `<aside class="attention-card" data-kind="${esc(card.kind)}" data-reversibility="${esc(card.reversibility)}"><h2>${esc(card.action)}</h2><p>${esc(card.why)}</p><p>${esc(card.impact)}</p><dl class="attention-card__truth"><div><dt>${esc(copy.scope)}</dt><dd><ul>${card.scope.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></dd></div><div><dt>${esc(copy.reversibility)}</dt><dd>${esc(card.reversibility === 'irreversible' ? copy.irreversible : copy.reversible)}</dd></div></dl>${technicalEntries.length ? `<details><summary>${esc(copy.technical)}</summary><dl>${technicalEntries.map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${esc(typeof value === 'object' ? JSON.stringify(value) : value)}</dd></div>`).join('')}</dl></details>` : ''}<div>${card.options.map((option) => `<button type="button" data-attention-action="${esc(option.id)}">${esc(option.label)}</button>`).join('')}</div></aside>`;
}
