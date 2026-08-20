export const EXPERIENCE_LEVELS = Object.freeze([
  { id: 'everyday', label: 'Everyday', shortLabel: 'Everyday', rank: 0, description: 'Chat, projects, and simple AI tools.' },
  { id: 'workspace', label: 'Workspace', shortLabel: 'Workspace', rank: 1, description: 'Missions, approvals, and live progress.' },
  { id: 'studio', label: 'Studio', shortLabel: 'Studio', rank: 2, description: 'Files, terminal, diffs, and agent activity.' },
  { id: 'expert', label: 'Expert', shortLabel: 'Expert', rank: 3, description: 'The complete control plane and backend atlas.' },
]);

const ALIASES = Object.freeze({ standard: 'workspace', research: 'expert', consumer: 'everyday', advanced: 'studio' });
const MAP = new Map(EXPERIENCE_LEVELS.map((item) => [item.id, item]));
export function normalizeExperience(value = 'everyday') { const id = ALIASES[value] ?? value; return MAP.has(id) ? id : 'everyday'; }
export function legacyExperience(value = 'everyday') { return normalizeExperience(value) === 'expert' ? 'research' : 'standard'; }
export function experienceRank(value) { return MAP.get(normalizeExperience(value)).rank; }
export function canAccess(required, current) { return experienceRank(current) >= experienceRank(required); }
export function nextExperience(value) { const current = experienceRank(value); return EXPERIENCE_LEVELS[(current + 1) % EXPERIENCE_LEVELS.length].id; }
export function experienceMeta(value) { return MAP.get(normalizeExperience(value)); }
