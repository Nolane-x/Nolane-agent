import { t } from '../../core/i18n.0e5a2126d9bc.mjs';
const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
export function buildOperationsView({ missions = [], agents = [], queues = [], recoveries = [] } = {}) {
  return Object.freeze({
    missions: freezeList(missions),
    agents: Object.freeze(agents.map((item) => Object.freeze({ ...item, actions: Object.freeze(['pause', 'stop', 'inspect']) }))),
    queues: freezeList(queues),
    recoveries: Object.freeze(recoveries.map((item) => Object.freeze({ ...item, actions: Object.freeze(['inspect', 'restore']) }))),
  });
}
export function renderOperationsView(value, { language = 'en' } = {}) { return `<section><h1>${t('control.domain.operations', language)}</h1><p>${value.missions.length} ${t('control.missions', language)} · ${value.agents.length} ${t('control.agents', language)}</p></section>`; }
