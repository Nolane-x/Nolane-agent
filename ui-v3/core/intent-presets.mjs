export const INTENT_PRESETS = Object.freeze({
  ask: Object.freeze({ id: 'ask', readProject: true, writeFiles: false, executeChanges: false, runVerification: false, expandScope: false }),
  plan: Object.freeze({ id: 'plan', readProject: true, writeFiles: false, executeChanges: false, runVerification: true, expandScope: false }),
  build: Object.freeze({ id: 'build', readProject: true, writeFiles: true, executeChanges: true, runVerification: true, expandScope: false }),
  verify: Object.freeze({ id: 'verify', readProject: true, writeFiles: false, executeChanges: false, runVerification: true, expandScope: false }),
});

export function createMissionRequest({ objective, projectId, intent = 'build', modelChoice = 'auto', attachments = [], options = {}, providerState = 'ready' } = {}) {
  const cleanObjective = String(objective ?? '').trim();
  const cleanProject = String(projectId ?? '').trim();
  if (!cleanObjective) throw new Error('Mission objective is required');
  if (!cleanProject) throw new Error('Project is required');
  if (providerState === 'unavailable') throw new Error('Selected provider is unavailable');
  const preset = INTENT_PRESETS[intent];
  if (!preset) throw new Error(`Unknown mission intent: ${intent}`);
  return Object.freeze({
    schema: 'nolane.agent.mission-request.v1', product: 'Nolane Agent', objective: cleanObjective, projectId: cleanProject,
    intent, modelChoice: String(modelChoice || 'auto'), attachments: Object.freeze([...attachments]), options: Object.freeze({ ...options }), boundaries: preset,
  });
}
