import { redactSecrets } from '../security/redaction.mjs';

const PROVIDER_LABELS = Object.freeze({
  codex: 'Codex',
  'codex-app-server': 'Codex',
  claude: 'Claude',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  nolane_native: 'NolaneNative',
});

function providerLabel(value) {
  const id = String(value ?? '').trim();
  if (!id) return 'AI';
  return PROVIDER_LABELS[id] ?? id.split(/[-_.]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function taskLabel(store, event) {
  const task = event.refs?.taskId ? store.getTask(event.refs.taskId) : null;
  return task?.title ?? 'nhiệm vụ';
}

function targetLabel(payload) {
  const target = String(payload?.target ?? payload?.path ?? '').trim();
  if (!target || target.length > 160) return null;
  return target.replaceAll('\\', '/');
}

function activity(event, values) {
  const safe = redactSecrets(values);
  return Object.freeze({
    id: event.id,
    seq: event.seq ?? null,
    eventType: event.type,
    time: event.time,
    phase: safe.phase,
    status: safe.status,
    title: safe.title,
    explanation: safe.explanation ?? '',
    target: safe.target ?? null,
    providerId: safe.providerId ?? null,
    tokenUsage: safe.tokenUsage ?? null,
    details: safe.details && typeof safe.details === 'object' ? Object.freeze({ ...safe.details }) : null,
    taskId: event.refs?.taskId ?? null,
  });
}

function mapToolStarted(event) {
  const tool = String(event.payload?.tool ?? '');
  const target = targetLabel(event.payload);
  if (tool === 'fs.read') return { phase: 'understanding', status: 'active', title: target ? `Đang đọc ${target}` : 'Đang đọc mã nguồn', explanation: 'Forge đang lấy phần mã cần thiết.', target };
  if (tool === 'fs.write' || tool === 'fs.patch' || tool === 'fs.patchSet') return { phase: 'building', status: 'active', title: target ? `Đang cập nhật ${target}` : 'Đang cập nhật mã nguồn', explanation: 'Thay đổi đang được thực hiện trong worktree cô lập.', target };
  if (tool === 'process.run') return { phase: 'running', status: 'active', title: target ? `Đang chạy ${target}` : 'Đang chạy lệnh phát triển', explanation: 'Output và mã thoát sẽ được ghi lại để kiểm chứng.', target };
  if (tool.startsWith('mcp.')) return { phase: 'researching', status: 'active', title: 'Đang dùng công cụ kết nối', explanation: 'Forge đang gọi một tích hợp đã được cấp quyền.', target };
  return { phase: 'building', status: 'active', title: `Đang chạy ${tool || 'công cụ'}`, explanation: 'Công cụ đang hoạt động dưới sự kiểm soát của ForgeOS.', target };
}

function mapTool(event) {
  const tool = String(event.payload?.tool ?? '');
  const target = targetLabel(event.payload);
  const details = { durationMs: Number(event.payload?.durationMs ?? 0), exitCode: event.payload?.exitCode ?? null, bytes: Number(event.payload?.bytes ?? 0), appliedHunks: Number(event.payload?.appliedHunks ?? 0), truncated: event.payload?.truncated === true };
  if (tool === 'fs.read') return { phase: 'understanding', status: 'done', title: target ? `Đã đọc ${target}` : 'Đã đọc mã nguồn', explanation: 'Forge đã lấy đúng phần mã cần thiết để tiếp tục.', target, details };
  if (tool === 'fs.write' || tool === 'fs.patch' || tool === 'fs.patchSet') return { phase: 'building', status: event.payload?.status === 'pass' ? 'done' : 'failed', title: target ? `Đã cập nhật ${target}` : 'Đã cập nhật mã nguồn', explanation: 'Thay đổi được thực hiện trong workspace được quản lý.', target, details };
  if (tool === 'process.run') return { phase: 'running', status: event.payload?.status === 'pass' ? 'done' : 'failed', title: target ? `Đã chạy ${target}` : 'Đã chạy lệnh phát triển', explanation: event.payload?.status === 'pass' ? 'Lệnh đã kết thúc thành công.' : 'Lệnh kết thúc với lỗi và sẽ được phân tích.', target, details };
  if (tool.startsWith('mcp.')) return { phase: 'researching', status: event.payload?.status === 'pass' ? 'done' : 'failed', title: 'Đã dùng công cụ kết nối', explanation: 'Forge đã lấy thêm dữ liệu từ một tích hợp được cấp quyền.', target, details };
  return { phase: 'building', status: event.payload?.status === 'pass' ? 'done' : 'failed', title: 'Đã hoàn thành một bước công cụ', explanation: `Công cụ ${tool || 'được cấp quyền'} đã kết thúc.`, target, details };
}

function projectEvent(store, event) {
  const type = event.type;
  const task = taskLabel(store, event);
  if (type === 'run.created') return activity(event, { phase: 'planning', status: 'active', title: 'Đã nhận nhiệm vụ', explanation: 'Forge đang chuẩn bị kế hoạch và môi trường làm việc.' });
  if (type === 'run.planning.started') return activity(event, { phase: 'planning', status: 'active', title: 'Đang lập kế hoạch', explanation: 'Forge đang chia mục tiêu thành các bước có thể thực hiện và kiểm chứng.' });
  if (type === 'mission.planned') return activity(event, { phase: 'planning', status: 'done', title: 'Đã lập kế hoạch thực hiện', explanation: String(event.payload?.summary ?? `Forge đã chia công việc thành ${event.payload?.taskCount ?? 0} bước.`).slice(0, 300) });
  if (type === 'mission.task.started') {
    const role = String(event.payload?.role ?? 'builder');
    const phase = role === 'scout' ? 'understanding' : role === 'reviewer' ? 'reviewing' : role === 'integrator' ? 'reviewing' : 'building';
    const title = role === 'scout' ? `Đang tìm hiểu: ${task}` : role === 'reviewer' ? `Đang kiểm tra: ${task}` : `Đang thực hiện: ${task}`;
    return activity(event, { phase, status: 'active', title, explanation: 'Một agent cô lập đã nhận bước công việc này.' });
  }
  if (type === 'agent.routing.started') return activity(event, { phase: 'understanding', status: 'active', title: 'Đang hiểu yêu cầu', explanation: 'ForgeOS đang chọn kỹ năng, context và quyền phù hợp.' });
  if (type === 'agent.routing.completed') return activity(event, { phase: 'understanding', status: 'done', title: 'Đã chuẩn bị ngữ cảnh làm việc', explanation: 'Chỉ các kỹ năng và dữ liệu liên quan được đưa vào phiên làm việc.' });
  if (type === 'agent.repository.context-selected') {
    const count = Array.isArray(event.payload?.selected) ? event.payload.selected.length : 0;
    return activity(event, { phase: 'understanding', status: 'done', title: `Đã chọn ${count} tệp liên quan`, explanation: 'Forge đã lọc repository để giảm token và tránh đọc dữ liệu không cần thiết.' });
  }
  if (type === 'agent.instructions.selected') return activity(event, { phase: 'understanding', status: 'done', title: 'Đã đọc quy tắc của dự án', explanation: 'Các hướng dẫn phù hợp được áp dụng như dữ liệu có nguồn gốc rõ ràng.' });
  if (type === 'agent.model.requested') {
    const label = providerLabel(event.payload?.providerId);
    return activity(event, { phase: 'building', status: 'active', title: `${label} đang suy luận`, explanation: 'Model đang quyết định bước tiếp theo; chưa có công cụ nào được coi là đã hoàn thành.', providerId: event.payload?.providerId ?? null });
  }
  if (type === 'agent.model.retrying') return activity(event, { phase: 'building', status: 'active', title: 'Đang thử lại model', explanation: 'Lỗi tạm thời được xử lý tự động trong giới hạn retry.' });
  if (type === 'agent.provider.fallback') return activity(event, { phase: 'building', status: 'done', title: `Đã chuyển sang ${providerLabel(event.payload?.to)}`, explanation: 'Forge tự chuyển provider vì provider trước không thể tiếp tục.' });
  if (type === 'agent.model.completed') {
    const usage = event.payload?.usage ?? {};
    const tokenUsage = { inputTokens: Number(usage.inputTokens ?? usage.promptTokens ?? 0), outputTokens: Number(usage.outputTokens ?? usage.completionTokens ?? 0), totalTokens: Number(usage.totalTokens ?? 0), estimated: usage.estimated === true };
    if (!tokenUsage.totalTokens) tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
    return activity(event, { phase: 'building', status: 'done', title: 'AI đã chọn bước tiếp theo', explanation: event.payload?.toolCallCount ? `Đã tạo ${event.payload.toolCallCount} thao tác được ForgeOS kiểm soát.` : 'AI đã hoàn tất lượt suy luận.', tokenUsage });
  }
  if (type === 'agent.tool.started') return activity(event, mapToolStarted(event));
  if (type === 'agent.tool.completed') return activity(event, mapTool(event));
  if (type === 'agent.mcp.tools-authorized') return activity(event, { phase: 'planning', status: 'done', title: 'Đã nạp tích hợp cần thiết', explanation: 'Chỉ các công cụ được nhiệm vụ cấp quyền mới được hiển thị cho model.' });
  if (type === 'agent.browser.tools-authorized') return activity(event, { phase: 'planning', status: 'done', title: 'Đã cấp công cụ trình duyệt', explanation: `Forge chỉ cho phép ${Array.isArray(event.payload?.actions) ? event.payload.actions.length : 0} thao tác web đã được kiểm soát.` });
  if (type === 'agent.goal.tools-authorized') return activity(event, { phase: 'planning', status: 'done', title: 'Đã kết nối Goal OS', explanation: 'Agent có thể ghi phát hiện mới và đề xuất điều chỉnh kế hoạch có bằng chứng.' });
  if (type === 'agent.plugins.selected') return activity(event, { phase: 'understanding', status: 'done', title: 'Đã nạp plugin phù hợp', explanation: `Forge đã chọn ${Array.isArray(event.payload?.plugins) ? event.payload.plugins.length : 0} plugin đang hoạt động cho dự án.` });
  if (type === 'goal.fact.recorded') return activity(event, { phase: 'understanding', status: 'done', title: 'Đã phát hiện thông tin mới', explanation: String(event.payload?.claim ?? `Phát hiện mới có mức ảnh hưởng ${event.payload?.impact ?? 'chưa xác định'}.`).slice(0, 500), target: event.payload?.impact ?? null });
  if (type === 'goal.plan.patch-proposed') return activity(event, { phase: 'planning', status: 'active', title: 'Kế hoạch cần được điều chỉnh', explanation: String(event.payload?.reason ?? 'Một phát hiện mới đã làm thay đổi phương án tốt nhất.').slice(0, 500) });
  if (type === 'goal.plan.patch-applied') return activity(event, { phase: 'planning', status: 'done', title: 'Đã cập nhật kế hoạch', explanation: `Forge đã giữ lịch sử cũ và thêm ${Array.isArray(event.payload?.addedTaskIds) ? event.payload.addedTaskIds.length : 0} bước phù hợp với phát hiện mới.` });
  if (type === 'goal.schedule.started') return activity(event, { phase: 'planning', status: 'active', title: 'Goal đang chạy theo lịch', explanation: `Forge đã khởi động một lượt ${event.payload?.schedule ?? 'tự động'} mà không chồng lên lượt đang chạy.` });
  if (type === 'goal.schedule.completed') return activity(event, { phase: 'completed', status: 'done', title: 'Lượt chạy theo lịch đã hoàn tất', explanation: 'Trạng thái Goal và kết quả mới đã được lưu bền.' });
  if (type === 'goal.schedule.failed') return activity(event, { phase: 'failed', status: 'failed', title: 'Lượt chạy theo lịch gặp lỗi', explanation: String(event.payload?.error ?? 'Forge đã giữ trạng thái để thử lại ở lượt sau.').slice(0, 500) });
  if (type === 'agent.completion.requested') return activity(event, { phase: 'testing', status: 'active', title: 'Đang chuẩn bị kiểm chứng', explanation: 'Kết luận của model chưa được chấp nhận cho đến khi test và evidence vượt qua.' });
  if (type === 'mission.task.awaiting-verification') return activity(event, { phase: 'testing', status: 'active', title: 'Đang kiểm tra kết quả', explanation: 'Forge đang chạy test, kiểm tra diff và ràng buộc bằng chứng với commit.' });
  if (type === 'mission.task.verification-failed') return activity(event, { phase: 'failed', status: 'failed', title: 'Kiểm thử chưa vượt qua', explanation: String(event.payload?.summary ?? 'Một cổng kiểm chứng đã thất bại.').slice(0, 500), target: event.payload?.kind ?? null });
  if (type === 'mission.task.verified') return activity(event, { phase: 'reviewing', status: 'done', title: 'Đã kiểm chứng thay đổi', explanation: `Đã ghi nhận ${event.payload?.evidenceCount ?? 0} bằng chứng vượt qua.` });
  if (type === 'mission.task.interrupted') return activity(event, { phase: 'waiting', status: 'active', title: 'Forge cần một quyết định', explanation: 'Nhiệm vụ đã được checkpoint an toàn trong khi chờ thông tin.' });
  if (type === 'mission.task.resumed-from-interrupt' || type === 'mission.resumed') return activity(event, { phase: 'planning', status: 'active', title: 'Đã tiếp tục nhiệm vụ', explanation: 'Forge đang tiếp tục từ checkpoint gần nhất.' });
  if (type === 'mission.paused') return activity(event, { phase: 'waiting', status: 'done', title: 'Nhiệm vụ đã tạm dừng', explanation: 'Trạng thái và tiến trình đã được giữ lại để tiếp tục sau.' });
  if (type === 'mission.stopped') return activity(event, { phase: 'waiting', status: 'done', title: 'Nhiệm vụ đã dừng', explanation: 'Các tiến trình đang chạy đã nhận tín hiệu dừng.' });
  if (type === 'mission.task.failed' || type === 'agent.failed') return activity(event, { phase: 'failed', status: 'failed', title: 'Forge gặp lỗi khi thực hiện', explanation: 'Lỗi đã được ghi lại an toàn. Bạn có thể thử lại hoặc đổi hướng.' });
  if (type === 'run.follow-up.queued') return activity(event, { phase: 'planning', status: 'done', title: 'Đã nhận hướng dẫn bổ sung', explanation: 'Hướng dẫn sẽ được áp dụng tại checkpoint an toàn tiếp theo.' });
  if (type === 'run.recovery.started') return activity(event, { phase: 'planning', status: 'active', title: 'Đang tiếp tục từ lỗi trước', explanation: `Forge đã khôi phục ${event.payload?.recoveredTasks ?? 0} bước và đang chạy lại từ checkpoint gần nhất.` });
  if (type === 'run.autopilot.started') return activity(event, { phase: 'planning', status: 'active', title: 'Autopilot đã bắt đầu', explanation: 'Forge sẽ tự thực hiện các bước được cấp quyền trong workspace.' });
  if (type === 'run.autopilot.completed') return activity(event, { phase: 'completed', status: 'done', title: 'Nhiệm vụ đã hoàn thành', explanation: 'Tất cả bước đã chạy và vượt qua cổng kiểm chứng.' });
  if (type === 'run.autopilot.failed') return activity(event, { phase: 'failed', status: 'failed', title: 'Autopilot đã dừng ở một bước', explanation: String(event.payload?.error ?? 'Forge đã dừng an toàn và giữ lại trạng thái để thử lại.').slice(0, 500) });
  return null;
}

function normalizeActivities(items) {
  let lastActive = -1;
  for (let index = 0; index < items.length; index += 1) if (items[index].status === 'active') lastActive = index;
  return items.map((item, index) => item.status === 'active' && index !== lastActive ? Object.freeze({ ...item, status: 'done' }) : item);
}

export class ActivityProjection {
  constructor({ store, staleAfterMs = 60_000, clock = Date.now } = {}) {
    if (!store?.getMission || !store?.listEvents) throw new TypeError('ActivityProjection store is required');
    this.store = store;
    this.staleAfterMs = Math.max(1_000, Number(staleAfterMs) || 60_000);
    this.clock = clock;
  }

  projectEvent(event) { return projectEvent(this.store, event); }

  snapshot({ missionId } = {}) {
    const mission = this.store.getMission(String(missionId ?? ''));
    if (!mission) throw new Error(`Unknown mission: ${missionId}`);
    const linkedGoalId = mission.metadata?.goalId ?? null;
    const events = this.store.listEvents({ afterSeq: 0, limit: 100_000 }).filter((event) => event.refs?.missionId === mission.id || (linkedGoalId && event.refs?.goalId === linkedGoalId));
    const activities = normalizeActivities(events.map((event) => this.projectEvent(event)).filter(Boolean));
    const usage = activities.reduce((sum, item) => ({
      inputTokens: sum.inputTokens + Number(item.tokenUsage?.inputTokens ?? 0),
      outputTokens: sum.outputTokens + Number(item.tokenUsage?.outputTokens ?? 0),
      totalTokens: sum.totalTokens + Number(item.tokenUsage?.totalTokens ?? 0),
      estimated: sum.estimated || item.tokenUsage?.estimated === true,
    }), { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimated: false });
    const active = [...activities].reverse().find((item) => item.status === 'active') ?? null;
    const last = activities.at(-1) ?? null;
    const lastHeartbeatAt = last?.time ?? mission.updatedAt;
    const age = Math.max(0, Number(this.clock()) - Date.parse(lastHeartbeatAt));
    let currentPhase = active?.phase ?? last?.phase ?? (mission.status === 'completed' ? 'completed' : mission.status === 'stopped' ? 'waiting' : 'planning');
    if (last?.status === 'failed') currentPhase = 'failed';
    if (mission.status === 'completed') currentPhase = 'completed';
    const tasks = this.store.listTasks({ missionId: mission.id }).map((task) => ({ id: task.id, title: task.title, role: task.role, status: task.status, updatedAt: task.updatedAt }));
    return Object.freeze({ mission, currentPhase, active, activities: Object.freeze(activities), tasks: Object.freeze(tasks), usage: Object.freeze(usage), lastHeartbeatAt, stale: Boolean(active && age > this.staleAfterMs) });
  }
}
