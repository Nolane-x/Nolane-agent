let identitySequence = 0;
const createIdentity = (type, id) => Object.freeze({ type, id, sequence: ++identitySequence });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function buildMissionProgress({ completed, total, phase = 'understanding' } = {}) {
  const numericTotal = Number(total);
  const numericCompleted = Number(completed);
  if (Number.isFinite(numericTotal) && numericTotal > 0 && Number.isFinite(numericCompleted) && numericCompleted >= 0) {
    const bounded = Math.min(numericCompleted, numericTotal);
    return Object.freeze({ kind: 'measured', completed: bounded, total: numericTotal, ratio: bounded / numericTotal });
  }
  return Object.freeze({ kind: 'phase', phase: String(phase || 'understanding') });
}

export function createMissionViewModel({ missionId, header = {} } = {}) {
  if (!missionId) throw new Error('Mission view requires missionId');
  let currentHeader = Object.freeze({ missionId: String(missionId), status: 'draft', ...header });
  let followMode = 'auto';
  const messages = new Map();
  const activities = new Map();
  const artifacts = new Map();
  const messageKeys = new Map();
  const activityKeys = new Map();
  const artifactKeys = new Map();

  const upsert = (target, keys, type, item) => {
    if (!item?.id) throw new Error(`${type} event requires id`);
    const id = String(item.id);
    const previous = target.get(id);
    target.set(id, Object.freeze({ ...(previous ?? {}), ...item, id }));
    if (!keys.has(id)) keys.set(id, createIdentity(type, id));
  };

  return Object.freeze({
    update({ headerPatch, messageEvents = [], activityEvents = [], artifactEvents = [] } = {}) {
      if (headerPatch) currentHeader = Object.freeze({ ...currentHeader, ...headerPatch, missionId: currentHeader.missionId });
      for (const item of messageEvents) upsert(messages, messageKeys, 'message', item);
      for (const item of activityEvents) upsert(activities, activityKeys, 'activity', item);
      for (const item of artifactEvents) upsert(artifacts, artifactKeys, 'artifact', item);
    },
    setFollowMode(mode) {
      if (!['auto', 'manual'].includes(mode)) throw new Error(`Unknown follow mode: ${mode}`);
      followMode = mode;
    },
    snapshot({ activityOffset = 0, activityLimit = 200, messageOffset = 0, messageLimit = 200 } = {}) {
      const allActivities = [...activities.values()];
      const allMessages = [...messages.values()];
      const visibleActivities = allActivities.slice(Math.max(0, activityOffset), Math.max(0, activityOffset) + Math.max(1, activityLimit));
      const visibleMessages = allMessages.slice(Math.max(0, messageOffset), Math.max(0, messageOffset) + Math.max(1, messageLimit));
      const groups = new Map();
      for (const activity of allActivities) {
        if (!activity.groupId) continue;
        if (!groups.has(activity.groupId)) groups.set(activity.groupId, []);
        groups.get(activity.groupId).push(activity);
      }
      return Object.freeze({
        missionId: currentHeader.missionId,
        header: currentHeader,
        followMode,
        messages: Object.freeze(visibleMessages),
        activities: Object.freeze(visibleActivities),
        artifacts: Object.freeze([...artifacts.values()]),
        totalMessages: allMessages.length,
        totalActivities: allActivities.length,
        messageKeys: new Map(messageKeys),
        activityKeys: new Map(activityKeys),
        artifactKeys: new Map(artifactKeys),
        activityGroups: new Map([...groups].map(([key, value]) => [key, Object.freeze(value)])),
        virtualized: allActivities.length > activityLimit || allMessages.length > messageLimit,
      });
    },
  });
}

export function renderMissionView(snapshot, { language = 'en' } = {}) {
  const vi = language === 'vi';
  const progress = buildMissionProgress(snapshot.header.progress ?? { phase: snapshot.header.phase });
  const status = progress.kind === 'measured' ? `${progress.completed}/${progress.total} ${vi ? 'bước' : 'steps'}` : progress.phase;
  const activities = snapshot.activities ?? snapshot.activity ?? [];
  return `<section class="mission-view" data-mission-id="${escapeHtml(snapshot.missionId)}"><header><h1>${escapeHtml(snapshot.header.title ?? (vi ? 'Nhiệm vụ' : 'Mission'))}</h1><p>${escapeHtml(snapshot.header.status)} · ${escapeHtml(status)}</p></header><div class="mission-activity" data-follow-mode="${escapeHtml(snapshot.followMode)}">${activities.map((item) => `<article data-activity-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.summary ?? item.type)}</strong></article>`).join('')}</div></section>`;
}
