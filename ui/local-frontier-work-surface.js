const VIEW_ORDER = ['code', 'diff', 'terminal', 'browser', 'test', 'timeline'];
const ROLES = ['builder', 'reviewer', 'operator'];

export function createLocalFrontierWorkSurface({ missionId, missing = [], pressure = 'normal' } = {}) {
  const absent = new Set(missing.map(String));
  const reduce = pressure === 'high' || pressure === 'critical';
  return Object.freeze({
    schema: 'nolane.agent.local-frontier-work-surface.v1',
    missionId: String(missionId ?? ''),
    views: Object.freeze(VIEW_ORDER.map((id) => Object.freeze({ id, state: absent.has(id) ? 'missing' : 'ready' }))),
    roles: Object.freeze([...ROLES]),
    commandPalette: Object.freeze(['open-device-doctor', 'show-mission-state', 'review-evidence', 'playback-journey']),
    effects: Object.freeze({ animation: !reduce, blur: false, transitionsMs: reduce ? 0 : 120 }),
  });
}
