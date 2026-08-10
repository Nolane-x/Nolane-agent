import { icon } from '../../core/icon.eb166a079d41.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const visibleStates = new Set(['available','downloading','staged','downloadFailed','checkFailed','blocked','installFailed','preparingInstall','installing','healthy']);

function copy(state, language) {
  const vi = language === 'vi';
  const version = state.version ? ` ${state.version}` : '';
  const map = {
    available: vi ? `Nolane Agent${version} đã sẵn sàng để tải.` : `Nolane Agent${version} is ready to download.`,
    downloading: vi ? `Đang tải và xác minh Nolane Agent${version}…` : `Downloading and verifying Nolane Agent${version}…`,
    staged: vi ? `Nolane Agent${version} đã được xác minh và sẵn sàng cài đặt.` : `Nolane Agent${version} is verified and ready to install.`,
    downloadFailed: vi ? 'Không thể tải hoặc xác minh bản cập nhật.' : 'The update could not be downloaded or verified.',
    checkFailed: vi ? 'Không thể kiểm tra bản cập nhật.' : 'Nolane could not check for updates.',
    blocked: vi ? `Đang có ${state.activeMissionCount ?? 1} mission chạy. Hãy để mission checkpoint trước khi cập nhật.` : `${state.activeMissionCount ?? 1} mission is running. Let it checkpoint before updating.`,
    installFailed: vi ? 'Không thể khởi chạy trình cài đặt đã xác minh.' : 'The verified installer could not be started.',
    preparingInstall: vi ? 'Đang checkpoint trạng thái và tạo snapshot trước cập nhật…' : 'Checkpointing state and creating a pre-update snapshot…',
    installing: vi ? 'Đang chuẩn bị cập nhật và khởi động lại…' : 'Preparing to update and restart…',
    healthy: vi ? `Nolane đã cập nhật thành công${version}.` : `Nolane updated successfully${version}.`
  };
  return map[state.state] ?? '';
}

function actions(state, language, { expert = false } = {}) {
  const vi = language === 'vi';
  if (state.state === 'available') return `<button type="button" class="update-notice__primary" data-update-action="download">${vi?'Tải bản cập nhật':'Download update'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>${expert?`<button type="button" data-update-action="ignore">${vi?'Bỏ qua phiên bản này':'Ignore this version'}</button>`:''}`;
  if (state.state === 'staged') return `<button type="button" class="update-notice__primary" data-update-action="install">${vi?'Cập nhật và khởi động lại':'Update and restart'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'downloadFailed') return `<button type="button" class="update-notice__primary" data-update-action="download">${vi?'Thử tải lại':'Retry download'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  if (state.state === 'checkFailed') return `<button type="button" class="update-notice__primary" data-update-action="check">${vi?'Thử lại':'Try again'}</button>`;
  if (state.state === 'blocked' || state.state === 'installFailed') return `<button type="button" class="update-notice__primary" data-update-action="install">${vi?'Thử lại':'Try again'}</button><button type="button" data-update-action="defer">${vi?'Để sau':'Later'}</button>`;
  return '';
}

export function renderUpdateNotice(state = {}, { experience = 'everyday', language = 'en' } = {}) {
  state = state && typeof state === 'object' ? state : {};
  if (!visibleStates.has(state.state)) return '';
  const detail = ['workspace','studio','expert'].includes(experience);
  const expert = experience === 'expert';
  const bytes = Number(state.packageBytes);
  const metadata = detail ? `<div class="update-notice__metadata">${state.releaseTag?`<span>${esc(state.releaseTag)}</span>`:''}${Number.isFinite(bytes)&&bytes>0?`<span>${Math.ceil(bytes/1024/1024)} MB</span>`:''}${state.signatureVerified?`<span>${language==='vi'?'Chữ ký đã xác minh':'Signature verified'}</span>`:''}</div>` : '';
  const forensic = expert ? `<details class="update-notice__forensic"><summary>${language==='vi'?'Chi tiết phát hành':'Release evidence'}</summary><dl><div><dt>Commit</dt><dd>${esc(state.releaseCommit ?? 'unknown')}</dd></div><div><dt>Asset</dt><dd>${esc(state.packageName ?? 'staged NSIS')}</dd></div><div><dt>State</dt><dd>${esc(state.state)}</dd></div></dl></details>` : '';
  let releaseNotesUrl = null;
  try { const parsed = new URL(String(state.releaseNotesUrl ?? '')); if (parsed.protocol === 'https:') releaseNotesUrl = parsed.href; } catch {}
  const notes = releaseNotesUrl ? `<a href="${esc(releaseNotesUrl)}" target="_blank" rel="noreferrer">${language==='vi'?'Có gì mới':'What’s new'}</a>` : '';
  return `<section class="update-notice" data-update-state="${esc(state.state)}" role="status" aria-live="polite"><span class="update-notice__icon">${icon(state.state.includes('Failed')?'warning':'download',{size:18})}</span><div class="update-notice__body"><strong>${esc(copy(state,language))}</strong><p>${language==='vi'?'Cuộc trò chuyện, cài đặt, project và mission của bạn sẽ được giữ nguyên.':'Your conversations, settings, projects, and missions will be kept.'}</p>${metadata}${forensic}${state.error?`<small>${esc(state.error)}</small>`:''}</div><div class="update-notice__actions">${notes}${actions(state,language,{expert})}</div></section>`;
}
