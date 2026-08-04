const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item })));
export function buildOperationsView({ missions = [], agents = [], queues = [], recoveries = [] } = {}) {
  return Object.freeze({
    missions: freezeList(missions),
    agents: Object.freeze(agents.map((item) => Object.freeze({ ...item, actions: Object.freeze(['pause', 'stop', 'inspect']) }))),
    queues: freezeList(queues),
    recoveries: Object.freeze(recoveries.map((item) => Object.freeze({ ...item, actions: Object.freeze(['inspect', 'restore']) }))),
  });
}
export function renderOperationsView(value) { return `<section><h1>Operations</h1><p>${value.missions.length} missions · ${value.agents.length} agents</p></section>`; }
