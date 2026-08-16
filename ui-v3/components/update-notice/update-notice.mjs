import { icon } from '../../core/icon.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const visibleStates = new Set(['available','downloading','staged','downloadFailed','checkFailed','blocked','installFailed','preparingInstall','installing','healthy','handoffUnavailable','packageUnsupported']);
const busyStates = new Set(['downloading','preparingInstall','installing']);

function platformMeta(state) {
  const truth = state?.platformTruth && typeof state.platformTruth === 'object' ? state.platformTruth : null;
  return Object.freeze({
    label: truth?.label ?? null,
    packageKinds: Array.isArray(truth?.packageKinds) ? truth.packageKinds : [],
    inAppEnabled: truth?.inAppUpdateHandoff?.enabled === true,
    installEnabled: truth?.nativeInstallHandoff?.enabled === true,
    handoffReason: state?.handoffReason ?? truth?.nativeInstallHandoff?.reason ?? truth?.inAppUpdateHandoff?.reason ?? null,
  });
}

function headline(state, language) {
  const vi = language === 'vi';
  const version = state.version ? ` ${state.version}` : '';
  const platform = platformMeta(state);
  const platformLabel = platform.label ?? (vi ? 'nền tảng này' : 'this platform');
  const map = {
    available: vi ? `Nolane Agent${version} có bản cập nhật đã xác minh.` : `A verified Nolane Agent${version} update is available.`,
    downloading: vi ? `Đang tải và xác minh Nolane Agent${version}…` : `Downloading and verifying Nolane Agent${version}…`,
    staged: platform.installEnabled
      ? (vi ? `Nolane Agent${version} đã được xác minh cho lần khởi động lại được bảo vệ.` : `Nolane Agent${version} is verified for a protected restart.`)
      : (vi ? `Gói Nolane Agent${version} đã được xác minh, nhưng cài đặt tự động chưa được xác minh trên ${platformLabel}.` : `Nolane Agent${version} is verified, but automatic installation is not yet verified on ${platformLabel}.`),
    downloadFailed: vi ? 'Không thể tải hoặc xác minh bản cập nhật.' : 'The update could not be downloaded or verified.',
    checkFailed: vi ? 'Không thể kiểm tra bản cập nhật.' : 'Nolane could not check for updates.',
    blocked: vi ? `Đang có ${state.activeMissionCount ?? 1} mission chạy. Cần checkpoint trước khi cập nhật.` : `${state.activeMissionCount ?? 1} mission is running. It must checkpoint before updating.`,
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
  if (['available','downloading','staged','blocked'].includes(state.state)) {
    return vi
      ? 'Trước cài đặt, Nolane sẽ checkpoint công việc đang hoạt động và tạo snapshot trước cập nhật; chỉ trạng thái đã có receipt mới được coi là đã bảo toàn.'
      : 'Before install, Nolane will checkpoint active work and create a pre-update snapshot; only receipt-backed state is treated as preserved.';
  }
  if (state.state === 'downloadFailed') return vi ? 'Không có installer nào được tin cậy chỉ vì tải xong một phần; bạn có thể thử tải lại.' : 'A partial download is never treated as a trusted installer; you can retry safely.';
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
  if ((state.state === 'blocked' || state.state === 'installFailed') && platform.installEnabled) return `<button type="button" class="update-notice__primary" data-update-action="install">${vi?'Thử lại':'Try again'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'handoffUnavailable' || state.state === 'packageUnsupported' || (state.state === 'staged' && !platform.installEnabled)) return `<button type="button" data-update-action="defer">${vi?'Ẩn thông báo':'Dismiss'}</button>`;
  return '';
}

export function renderUpdateNotice(state = {}, { experience = 'everyday', language = 'en' } = {}) {
  state = state && typeof state === 'object' ? state : {};
  if (!visibleStates.has(state.state)) return '';
  const detail = ['workspace','studio','expert'].includes(experience);
  const expert = experience === 'expert';
  const platform = platformMeta(state);
  const bytes = Number(state.packageBytes);
  const kind = state.packageKind ? String(state.packageKind).toUpperCase() : null;
  const metadataParts = [
    platform.label ? `<span>${esc(platform.label)}</span>` : '',
    kind ? `<span>${esc(kind)}</span>` : '',
    state.releaseTag ? `<span>${esc(state.releaseTag)}</span>` : '',
    Number.isFinite(bytes)&&bytes>0 ? `<span>${Math.ceil(bytes/1024/1024)} MB</span>` : '',
    state.signatureVerified ? `<span>${language==='vi'?'Chữ ký đã xác minh':'Signature verified'}</span>` : ''
  ].filter(Boolean);
  const metadata = detail && metadataParts.length ? `<div class="update-notice__metadata">${metadataParts.join('')}</div>` : '';
  const forensic = expert ? `<details class="update-notice__forensic"><summary>${language==='vi'?'Chi tiết phát hành':'Release evidence'}</summary><dl><div><dt>Platform</dt><dd>${esc(platform.label ?? 'unknown')}</dd></div><div><dt>Commit</dt><dd>${esc(state.releaseCommit ?? 'unknown')}</dd></div><div><dt>Asset</dt><dd>${esc(state.packageName ?? 'not reported')}</dd></div><div><dt>Kind</dt><dd>${esc(state.packageKind ?? 'unknown')}</dd></div><div><dt>Handoff</dt><dd>${esc(platform.installEnabled ? (state.platformTruth?.nativeInstallHandoff?.mechanism ?? 'verified native handoff') : 'not verified')}</dd></div><div><dt>State</dt><dd>${esc(state.state)}</dd></div></dl></details>` : '';
  let releaseNotesUrl = null;
  try { const parsed = new URL(String(state.releaseNotesUrl ?? '')); if (parsed.protocol === 'https:') releaseNotesUrl = parsed.href; } catch {}
  const notes = releaseNotesUrl ? `<a href="${esc(releaseNotesUrl)}" target="_blank" rel="noreferrer">${language==='vi'?'Có gì mới':'What’s new'}</a>` : '';
  const busy = busyStates.has(state.state);
  const warning = ['downloadFailed','checkFailed','installFailed','handoffUnavailable','packageUnsupported','blocked'].includes(state.state);
  return `<section class="update-notice" data-update-state="${esc(state.state)}" data-update-platform="${esc(state.platformTruth?.platform ?? 'unknown')}" role="status" aria-live="polite" aria-atomic="false" aria-busy="${busy?'true':'false'}"><span class="update-notice__icon" aria-hidden="true">${icon(warning?'warning':'download',{size:18})}</span><div class="update-notice__body"><strong>${esc(headline(state,language))}</strong><p>${esc(supportingCopy(state,language))}</p>${metadata}${forensic}${state.error?`<small>${esc(state.error)}</small>`:''}</div><div class="update-notice__actions">${notes}${actions(state,language,{expert})}</div></section>`;
}
