import { icon } from '../../core/icon.31b1d4782466.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const visibleStates = new Set(['available','downloading','staged','downloadFailed','checkFailed','blocked','installFailed','preparingInstall','installing','healthy','handoffUnavailable','packageUnsupported']);
const busyStates = new Set(['downloading','preparingInstall','installing']);
const phaseOrder = Object.freeze(['release','protect','install','health']);

function platformMeta(state) {
  const truth = state?.platformTruth && typeof state.platformTruth === 'object' ? state.platformTruth : null;
  return Object.freeze({
    label: truth?.label ?? null,
    packageKinds: Array.isArray(truth?.packageKinds) ? truth.packageKinds : [],
    inAppEnabled: truth?.inAppUpdateHandoff?.enabled === true,
    installEnabled: truth?.nativeInstallHandoff?.enabled === true,
    handoffMechanism: truth?.nativeInstallHandoff?.mechanism ?? null,
    handoffReason: state?.handoffReason ?? truth?.nativeInstallHandoff?.reason ?? truth?.inAppUpdateHandoff?.reason ?? null,
  });
}

function stateMeta(state) {
  const map = Object.freeze({
    available: ['release','info'],
    downloading: ['release','progress'],
    downloadFailed: ['release','error'],
    checkFailed: ['release','error'],
    staged: ['protect','ready'],
    blocked: ['protect','blocked'],
    preparingInstall: ['protect','progress'],
    handoffUnavailable: ['protect','blocked'],
    packageUnsupported: ['protect','blocked'],
    installing: ['install','progress'],
    installFailed: ['install','error'],
    healthy: ['health','success'],
  });
  const [phase, severity] = map[state?.state] ?? ['release','info'];
  return Object.freeze({ phase, severity });
}

function headline(state, language) {
  const vi = language === 'vi';
  const version = state.version ? ` ${state.version}` : '';
  const platform = platformMeta(state);
  const platformLabel = platform.label ?? (vi ? 'nền tảng này' : 'this platform');
  const missionCount = Math.max(1, Number(state.activeMissionCount) || 1);
  const missionText = vi
    ? `${missionCount} mission đang chạy. Cần xử lý mission trước khi cập nhật.`
    : `${missionCount} ${missionCount === 1 ? 'mission is' : 'missions are'} running. ${missionCount === 1 ? 'It' : 'They'} must be resolved before updating.`;
  const map = {
    available: vi ? `Nolane Agent${version} có bản cập nhật đã xác minh.` : `A verified Nolane Agent${version} update is available.`,
    downloading: vi ? `Đang tải và xác minh Nolane Agent${version}…` : `Downloading and verifying Nolane Agent${version}…`,
    staged: platform.installEnabled
      ? (vi ? `Nolane Agent${version} đã được xác minh cho lần khởi động lại được bảo vệ.` : `Nolane Agent${version} is verified for a protected restart.`)
      : (vi ? `Gói Nolane Agent${version} đã được xác minh, nhưng cài đặt tự động chưa được xác minh trên ${platformLabel}.` : `Nolane Agent${version} is verified, but automatic installation is not yet verified on ${platformLabel}.`),
    downloadFailed: vi ? 'Không thể tải hoặc xác minh bản cập nhật.' : 'The update could not be downloaded or verified.',
    checkFailed: vi ? 'Không thể kiểm tra bản cập nhật.' : 'Nolane could not check for updates.',
    blocked: missionText,
    installFailed: vi ? 'Không thể khởi chạy handoff cài đặt đã xác minh.' : 'The verified install handoff could not be started.',
    preparingInstall: vi ? 'Đang checkpoint trạng thái và tạo snapshot trước cập nhật…' : 'Checkpointing state and creating a pre-update snapshot…',
    installing: vi ? 'Snapshot đã được chuẩn bị; đang bàn giao cho trình cài đặt và khởi động lại…' : 'The snapshot is prepared; handing off to the installer and restart…',
    healthy: vi ? `Nolane đã khởi động khỏe mạnh sau cập nhật${version}.` : `Nolane started healthy after updating${version}.`,
    handoffUnavailable: vi ? `Cài đặt cập nhật trong ứng dụng chưa được xác minh trên ${platformLabel}.` : `In-app update installation is not yet verified on ${platformLabel}.`,
    packageUnsupported: vi ? `Gói cập nhật này không khớp handoff đã xác minh cho ${platformLabel}.` : `This update package does not match the verified ${platformLabel} handoff.`
  };
  return map[state.state] ?? '';
}

function supportingCopy(state, language) {
  const vi = language === 'vi';
  const platform = platformMeta(state);
  if (state.state === 'handoffUnavailable' || state.state === 'packageUnsupported' || (state.state === 'staged' && !platform.installEnabled)) {
    return platform.handoffReason || (vi ? 'Dùng gói phát hành dành cho nền tảng này; Nolane sẽ không giả định semantics cài đặt của Windows.' : 'Use the release package for this platform; Nolane will not assume Windows install semantics.');
  }
  if (state.state === 'blocked') {
    return vi
      ? 'Hoàn thành hoặc dừng các mission đang chạy trước. Nolane chưa bắt đầu handoff cài đặt và sẽ không tự ý ngắt mission.'
      : 'Finish or stop the running missions first. Nolane has not started the install handoff and will not interrupt a mission automatically.';
  }
  if (state.state === 'preparingInstall') {
    return vi ? 'Nolane đang bảo toàn state có thể phục hồi trước khi cho phép handoff cài đặt.' : 'Nolane is preserving recoverable state before the install handoff is allowed.';
  }
  if (state.state === 'installing') {
    const snapshot = state.preservation?.snapshotPrepared || state.snapshotId;
    return snapshot
      ? (vi ? 'Snapshot trước cập nhật đã có bằng chứng. Ứng dụng chỉ thoát sau khi handoff trình cài đặt bắt đầu thành công.' : 'The pre-update snapshot has evidence. The app quits only after the installer handoff starts successfully.')
      : (vi ? 'Handoff đang diễn ra; trạng thái snapshot chưa được chứng minh trong surface này.' : 'Install handoff is in progress; snapshot evidence is not established in this surface.');
  }
  if (state.state === 'healthy') {
    return state.preservation?.postUpdateHealthy
      ? (vi ? 'Runtime, dữ liệu cục bộ và restore path đã qua health boundary của lần khởi động này.' : 'Runtime, local data, and the restore path passed this startup health boundary.')
      : (vi ? 'Ứng dụng đang chạy phiên bản mới; bằng chứng bảo toàn chi tiết vẫn bị giới hạn theo receipt hiện có.' : 'The new version is running; detailed preservation claims remain bounded by available receipts.');
  }
  if (['available','downloading','staged'].includes(state.state)) {
    return vi
      ? 'Trước cài đặt, Nolane sẽ checkpoint công việc đang hoạt động và tạo snapshot trước cập nhật; chỉ trạng thái đã có receipt mới được coi là đã bảo toàn.'
      : 'Before install, Nolane will checkpoint active work and create a pre-update snapshot; only receipt-backed state is treated as preserved.';
  }
  if (state.state === 'downloadFailed') return vi ? 'Không có installer nào được tin cậy chỉ vì tải xong một phần; bạn có thể thử tải lại an toàn.' : 'A partial download is never treated as a trusted installer; you can retry safely.';
  if (state.state === 'checkFailed') return vi ? 'Công việc hiện tại không bị dừng. Hãy thử lại khi kết nối hoặc update service khả dụng.' : 'Current work is not interrupted. Retry when connectivity or the update service is available.';
  if (state.state === 'installFailed') return vi ? 'Nolane vẫn giữ ứng dụng hiện tại chạy khi handoff cài đặt không bắt đầu được.' : 'Nolane keeps the current app state when the install handoff cannot be started.';
  return '';
}

function actions(state, language, { expert = false } = {}) {
  const vi = language === 'vi';
  const platform = platformMeta(state);
  if (state.state === 'available' && platform.inAppEnabled) return `<button type="button" class="update-notice__primary" data-update-action="download">${vi?'Tải bản cập nhật':'Download update'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>${expert?`<button type="button" data-update-action="ignore">${vi?'Bỏ qua phiên bản này':'Ignore this version'}</button>`:''}`;
  if (state.state === 'staged' && platform.installEnabled) return `<button type="button" class="update-notice__primary" data-update-action="install">${vi?'Cập nhật và khởi động lại':'Update and restart'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'downloadFailed' && platform.inAppEnabled) return `<button type="button" class="update-notice__primary" data-update-action="download">${vi?'Thử tải lại':'Retry download'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'checkFailed') return `<button type="button" class="update-notice__primary" data-update-action="check">${vi?'Thử lại':'Try again'}</button>`;
  if (state.state === 'blocked' && platform.installEnabled) return `<button type="button" class="update-notice__primary" data-update-action="missions">${vi?'Xem mission đang chạy':'View running missions'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'installFailed' && platform.installEnabled) return `<button type="button" class="update-notice__primary" data-update-action="install">${vi?'Thử handoff lại':'Retry install handoff'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'handoffUnavailable' || state.state === 'packageUnsupported' || (state.state === 'staged' && !platform.installEnabled)) return `<button type="button" data-update-action="defer">${vi?'Ẩn thông báo':'Dismiss'}</button>`;
  return '';
}

function evidenceStatusLabel(status, language) {
  const vi = language === 'vi';
  const labels = vi
    ? { verified:'Đã xác minh', active:'Đang thực hiện', pending:'Chưa đến bước', unavailable:'Không khả dụng', unknown:'Chưa có bằng chứng' }
    : { verified:'Verified', active:'In progress', pending:'Not reached', unavailable:'Unavailable', unknown:'No evidence yet' };
  return labels[status] ?? labels.unknown;
}

function evidenceModel(state) {
  const platform = platformMeta(state);
  const preservation = state?.preservation ?? {};
  const signature = state?.signatureVerified || state?.integrityVerified ? 'verified' : (state?.state === 'downloading' ? 'active' : 'unknown');
  const snapshot = preservation.snapshotPrepared || state?.snapshotReceiptSha256
    ? 'verified'
    : state?.state === 'preparingInstall'
      ? 'active'
      : ['installing','healthy'].includes(state?.state)
        ? 'unknown'
        : 'pending';
  const journal = preservation.migrationJournalRecorded || state?.migrationJournalReceiptSha256
    ? 'verified'
    : state?.state === 'preparingInstall'
      ? 'active'
      : ['installing','healthy'].includes(state?.state)
        ? 'unknown'
        : 'pending';
  const handoff = !platform.installEnabled
    ? 'unavailable'
    : state?.state === 'installing'
      ? 'active'
      : state?.state === 'healthy' || state?.state === 'staged'
        ? 'verified'
        : ['installFailed'].includes(state?.state)
          ? 'unknown'
          : 'pending';
  return Object.freeze({ signature, snapshot, journal, handoff });
}

function renderEvidence(state, language) {
  const vi = language === 'vi';
  const evidence = evidenceModel(state);
  const rows = [
    ['release', vi ? 'Tính toàn vẹn bản phát hành' : 'Release integrity', evidence.signature],
    ['snapshot', vi ? 'Snapshot khôi phục' : 'Recovery snapshot', evidence.snapshot],
    ['journal', vi ? 'Nhật ký migration' : 'Migration journal', evidence.journal],
    ['handoff', vi ? 'Handoff cài đặt' : 'Install handoff', evidence.handoff],
  ];
  return `<div class="update-notice__evidence" aria-label="${vi?'Chuỗi bằng chứng cập nhật':'Update evidence trail'}">${rows.map(([id,label,status]) => `<div class="update-notice__evidence-row" data-evidence="${id}" data-evidence-status="${status}"><span class="update-notice__evidence-mark" aria-hidden="true"></span><span>${label}</span><strong>${evidenceStatusLabel(status,language)}</strong></div>`).join('')}</div>`;
}

function renderPhase(state, language) {
  const vi = language === 'vi';
  const { phase } = stateMeta(state);
  const current = Math.max(0, phaseOrder.indexOf(phase));
  const labels = vi
    ? { release:'Bản phát hành', protect:'Bảo toàn state', install:'Cài đặt', health:'Health check' }
    : { release:'Release', protect:'Protect state', install:'Install', health:'Health check' };
  const items = phaseOrder.map((id,index) => {
    const status = index < current ? 'done' : index === current ? 'current' : 'next';
    return `<li data-phase="${id}" data-phase-status="${status}"${status==='current'?' aria-current="step"':''}><span aria-hidden="true"></span><small>${labels[id]}</small></li>`;
  }).join('');
  return `<ol class="update-notice__phase" aria-label="${vi?'Các giai đoạn cập nhật':'Update phases'}">${items}</ol>`;
}

export function renderUpdateNotice(state = {}, { experience = 'everyday', language = 'en' } = {}) {
  state = state && typeof state === 'object' ? state : {};
  if (!visibleStates.has(state.state)) return '';
  const detail = ['workspace','studio','expert'].includes(experience);
  const expert = experience === 'expert';
  const platform = platformMeta(state);
  const meta = stateMeta(state);
  const bytes = Number(state.packageBytes);
  const kind = state.packageKind ? String(state.packageKind).toUpperCase() : null;
  const metadataParts = [
    platform.label ? `<span class="update-notice__fact"><b>${language==='vi'?'Nền tảng':'Platform'}</b>${esc(platform.label)}</span>` : '',
    kind ? `<span class="update-notice__fact"><b>${language==='vi'?'Gói':'Package'}</b>${esc(kind)}</span>` : '',
    state.releaseTag ? `<span class="update-notice__fact"><b>Tag</b>${esc(state.releaseTag)}</span>` : '',
    Number.isFinite(bytes)&&bytes>0 ? `<span class="update-notice__fact"><b>${language==='vi'?'Kích thước':'Size'}</b>${Math.ceil(bytes/1024/1024)} MB</span>` : '',
    state.signatureVerified ? `<span class="update-notice__fact" data-fact-status="verified"><b>${language==='vi'?'Chữ ký':'Signature'}</b>${language==='vi'?'Đã xác minh':'Signature verified'}</span>` : ''
  ].filter(Boolean);
  const metadata = detail && metadataParts.length ? `<div class="update-notice__metadata">${metadataParts.join('')}</div>` : '';
  const evidence = detail ? `${renderPhase(state,language)}${renderEvidence(state,language)}` : '';
  const forensic = expert ? `<details class="update-notice__forensic"><summary>${language==='vi'?'Chi tiết phát hành':'Release evidence'}</summary><dl><div><dt>Platform</dt><dd>${esc(platform.label ?? 'unknown')}</dd></div><div><dt>Commit</dt><dd>${esc(state.releaseCommit ?? 'unknown')}</dd></div><div><dt>Asset</dt><dd>${esc(state.packageName ?? 'not reported')}</dd></div><div><dt>Kind</dt><dd>${esc(state.packageKind ?? 'unknown')}</dd></div><div><dt>Handoff</dt><dd>${esc(platform.installEnabled ? (platform.handoffMechanism ?? 'verified native handoff') : 'not verified')}</dd></div><div><dt>Snapshot</dt><dd>${esc(state.snapshotReceiptSha256 ?? 'not reported')}</dd></div><div><dt>Migration</dt><dd>${esc(state.migrationJournalReceiptSha256 ?? 'not reported')}</dd></div><div><dt>State</dt><dd>${esc(state.state)}</dd></div></dl></details>` : '';
  let releaseNotesUrl = null;
  try { const parsed = new URL(String(state.releaseNotesUrl ?? '')); if (parsed.protocol === 'https:') releaseNotesUrl = parsed.href; } catch {}
  const notes = releaseNotesUrl ? `<a href="${esc(releaseNotesUrl)}" target="_blank" rel="noreferrer">${language==='vi'?'Có gì mới':'What’s new'}</a>` : '';
  const busy = busyStates.has(state.state);
  const warning = ['downloadFailed','checkFailed','installFailed','handoffUnavailable','packageUnsupported','blocked'].includes(state.state);
  const error = state.error ? `<div class="update-notice__error" role="alert"><span aria-hidden="true">${icon('warning',{size:14})}</span><span>${esc(state.error)}</span></div>` : '';
  return `<section class="update-notice" data-update-state="${esc(state.state)}" data-update-platform="${esc(state.platformTruth?.platform ?? 'unknown')}" data-update-phase="${meta.phase}" data-update-severity="${meta.severity}" role="status" aria-live="polite" aria-atomic="false" aria-busy="${busy?'true':'false'}"><span class="update-notice__icon" aria-hidden="true">${icon(warning?'warning':'download',{size:18})}</span><div class="update-notice__body"><strong class="update-notice__headline">${esc(headline(state,language))}</strong><p class="update-notice__support">${esc(supportingCopy(state,language))}</p>${metadata}${evidence}${forensic}${error}</div><div class="update-notice__actions">${notes}${actions(state,language,{expert})}</div></section>`;
}
