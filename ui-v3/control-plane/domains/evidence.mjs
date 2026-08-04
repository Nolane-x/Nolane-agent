export function buildEvidenceView({ events = [], gaps = [], exports = [] } = {}) {
  return Object.freeze({ defaultView: 'timeline', filters: Object.freeze(['agent', 'tool', 'file', 'risk', 'time', 'receipt']), events: Object.freeze(events.map(({ raw, ...item }) => Object.freeze({ ...item, rawLoaded: false }))), gaps: Object.freeze(gaps.map((item) => Object.freeze({ ...item }))), exports: Object.freeze(exports.map((item) => Object.freeze({ ...item }))) });
}
export function renderEvidenceView(value) { return `<section><h1>Evidence</h1><p>${value.events.length} trace events · ${value.gaps.length} gaps</p></section>`; }
