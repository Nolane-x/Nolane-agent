import { EXPERIENCE_LEVELS, experienceMeta, normalizeExperience } from '../../core/experience-policy.2a36c61069b7.mjs';
import { icon } from '../../core/icon.8a03d98be748.mjs';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

const VI = Object.freeze({
  everyday: ['Hằng ngày', 'Trò chuyện và công cụ AI đơn giản.'],
  workspace: ['Workspace', 'Nhiệm vụ, phê duyệt và tiến độ trực tiếp.'],
  studio: ['Studio', 'Tệp, terminal, diff và hoạt động agent.'],
  expert: ['Chuyên sâu', 'Toàn bộ Control Plane và bằng chứng.']
});

function copy(level, language) {
  if (language === 'vi') return VI[level.id] ?? [level.label, level.description];
  return [level.label, level.description];
}

export function renderExperienceSwitcher({ current = 'everyday', language = 'en', busy = false } = {}) {
  const normalized = normalizeExperience(current);
  const meta = experienceMeta(normalized);
  const title = language === 'vi' ? 'Chuyển tầng giao diện' : 'Switch experience level';
  const hint = language === 'vi' ? 'Không thay đổi quyền của agent' : 'Does not change agent permissions';
  return `<div class="experience-switcher" data-experience-switcher>
    <button type="button" class="experience-pill" data-command="toggle-experience" aria-label="${escapeHtml(title)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="experience-switcher-menu"${busy ? ' disabled' : ''}><span class="experience-pill__dot"></span><span data-experience-current-label>${escapeHtml(copy(meta, language)[0])}</span>${icon('chevron',{size:14})}</button>
    <div id="experience-switcher-menu" class="experience-switcher__menu" role="listbox" aria-label="${escapeHtml(title)}" data-experience-menu hidden>
      <header><strong>${escapeHtml(title)}</strong><small>${escapeHtml(hint)}</small></header>
      <div class="experience-switcher__options">${EXPERIENCE_LEVELS.map((level) => {
        const [label, description] = copy(level, language);
        const selected = level.id === normalized;
        return `<button type="button" role="option" aria-selected="${selected}" data-experience-option="${level.id}" tabindex="${selected ? '0' : '-1'}"><span class="experience-switcher__rank">${level.rank + 1}</span><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span><span class="experience-switcher__check">${selected ? icon('check',{size:15}) : ''}</span></button>`;
      }).join('')}</div>
      <footer><kbd>Ctrl/⌘ Shift E</kbd><span>${language === 'vi' ? 'Mở bộ chuyển đổi' : 'Open switcher'}</span></footer>
    </div>
  </div>`;
}
