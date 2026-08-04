const PHASES = Object.freeze({
  planning: Object.freeze({ label: 'Đang lập kế hoạch', short: 'Lập kế hoạch', tone: 'violet' }),
  understanding: Object.freeze({ label: 'Đang tìm hiểu dự án', short: 'Tìm hiểu', tone: 'blue' }),
  researching: Object.freeze({ label: 'Đang nghiên cứu', short: 'Nghiên cứu', tone: 'blue' }),
  building: Object.freeze({ label: 'Đang xây dựng', short: 'Xây dựng', tone: 'violet' }),
  running: Object.freeze({ label: 'Đang chạy công cụ', short: 'Thực thi', tone: 'amber' }),
  testing: Object.freeze({ label: 'Đang kiểm thử', short: 'Kiểm thử', tone: 'amber' }),
  reviewing: Object.freeze({ label: 'Đang kiểm tra độc lập', short: 'Review', tone: 'blue' }),
  waiting: Object.freeze({ label: 'Đang chờ', short: 'Tạm dừng', tone: 'muted' }),
  completed: Object.freeze({ label: 'Hoàn thành', short: 'Hoàn thành', tone: 'green' }),
  failed: Object.freeze({ label: 'Cần chú ý', short: 'Có lỗi', tone: 'red' }),
  'rolled-back': Object.freeze({ label: 'Đã hoàn tác', short: 'Hoàn tác', tone: 'muted' }),
});

export function phaseCopy(phase) {
  return PHASES[String(phase ?? '')] ?? PHASES.planning;
}

export function formatTokens(value, estimated = false) {
  const number = Math.max(0, Number(value) || 0);
  const prefix = estimated ? '~' : '';
  if (number < 1_000) return `${prefix}${Math.round(number).toLocaleString('vi-VN')} token`;
  if (number < 1_000_000) return `${prefix}${(number / 1_000).toFixed(number >= 100_000 ? 0 : 1).replace('.', ',')}K token`;
  return `${prefix}${(number / 1_000_000).toFixed(number >= 100_000_000 ? 0 : 1).replace('.', ',')}M token`;
}

export function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1_000));
  if (totalSeconds < 60) return `${totalSeconds} giây`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
}

export function deriveRunView(snapshot, now = Date.now()) {
  const mission = snapshot?.mission ?? {};
  const activities = snapshot?.activities ?? {};
  const tasks = Array.isArray(activities.tasks) ? activities.tasks : [];
  const phase = String(activities.currentPhase ?? (mission.status === 'completed' ? 'completed' : mission.status === 'failed' ? 'failed' : mission.status === 'rolled-back' ? 'rolled-back' : 'planning'));
  const copy = phaseCopy(phase);
  const createdAt = Date.parse(mission.createdAt ?? mission.updatedAt ?? new Date(now).toISOString());
  const terminal = ['completed', 'failed', 'stopped', 'cancelled', 'rolled-back'].includes(String(mission.status ?? ''));
  return Object.freeze({
    id: mission.id ?? null,
    title: String(mission.objective ?? 'Nhiệm vụ mới'),
    phase,
    statusLabel: copy.label,
    statusTone: copy.tone,
    activeTitle: String(activities.active?.title ?? copy.label),
    activeExplanation: String(activities.active?.explanation ?? 'Nolane Agent đang chuẩn bị bước tiếp theo.'),
    progress: Object.freeze({ done: tasks.filter((task) => task.status === 'done').length, total: tasks.length }),
    tokens: formatTokens(activities.usage?.totalTokens ?? 0, activities.usage?.estimated === true),
    elapsed: formatElapsed(Math.max(0, now - createdAt)),
    stale: activities.stale === true,
    terminal,
    running: snapshot?.running === true,
  });
}

export function relativeTime(value, now = Date.now()) {
  const time = Date.parse(value ?? '');
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.floor((now - time) / 1_000));
  if (seconds < 10) return 'vừa xong';
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(time));
}
