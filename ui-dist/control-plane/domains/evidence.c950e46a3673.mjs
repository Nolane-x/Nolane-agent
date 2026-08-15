import { t } from '../../core/i18n.d970c3c10b9e.mjs';
export function buildEvidenceView({ events = [], gaps = [], exports = [] } = {}) {
  return Object.freeze({ defaultView: 'timeline', filters: Object.freeze(['agent', 'tool', 'file', 'risk', 'time', 'receipt']), events: Object.freeze(events.map(({ raw, ...item }) => Object.freeze({ ...item, rawLoaded: false }))), gaps: Object.freeze(gaps.map((item) => Object.freeze({ ...item }))), exports: Object.freeze(exports.map((item) => Object.freeze({ ...item }))) });
}
export function renderEvidenceView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.evidence', language)}</h1><p>${value.events.length} ${t('control.evidenceEvents', language)} · ${value.gaps.length} ${t('control.gaps', language)}</p></section>`; }
