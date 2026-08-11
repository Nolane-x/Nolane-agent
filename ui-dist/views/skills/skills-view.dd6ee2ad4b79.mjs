import { icon } from '../../core/icon.74ba09ec0393.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const asList = (value) => Array.isArray(value) ? value : Array.isArray(value?.skills) ? value.skills : Array.isArray(value?.items) ? value.items : [];
const SKILL_CATALOG_LIMIT = 500;

function copy(language) {
  const vi = language === 'vi';
  return vi ? {
    eyebrow: 'Thư viện workspace', title: 'Kho skill', subtitle: 'Tìm, đọc và đưa đúng skill vào ngữ cảnh trước khi giao việc cho agent.',
    search: 'Tìm skill', searchPlaceholder: 'Tìm theo tên, nguồn hoặc trạng thái…', catalog: 'Danh mục',
    allCatalogs: 'Tất cả catalog', native: 'Nolane native', v2: 'ForgeOS v2', legacy: 'ForgeOS legacy', loading: 'Đang tải catalog skill…',
    empty: 'Chưa có skill phù hợp', emptyDetail: 'Thử đổi từ khóa hoặc danh mục để xem các skill khác.',
    preview: 'Xem trước skill', previewEmpty: 'Chọn một skill để đọc nội dung trước khi dùng trong cuộc trò chuyện.',
    inspect: 'Xem trước', error: 'Không thể tải kho skill', source: 'Nguồn', maturity: 'Trạng thái',
    manage: 'Quản trị extension', manageDetail: 'Cài đặt và quyền hạn vẫn nằm trong Control Plane.',
  } : {
    eyebrow: 'Workspace library', title: 'Skills', subtitle: 'Find, read, and add the right skill to context before assigning work to the agent.',
    search: 'Search skills', searchPlaceholder: 'Search by name, source, or status…', catalog: 'Catalog',
    allCatalogs: 'All catalogs', native: 'Nolane native', v2: 'ForgeOS v2', legacy: 'ForgeOS legacy', loading: 'Loading skill catalog…',
    empty: 'No matching skills', emptyDetail: 'Try a different search or catalog to see other skills.',
    preview: 'Skill preview', previewEmpty: 'Select a skill to read it before using it in a conversation.',
    inspect: 'Preview', error: 'The skill library could not be loaded', source: 'Source', maturity: 'Status',
    manage: 'Manage extensions', manageDetail: 'Installation and permissions remain in the Control Plane.',
  };
}

function normalizeSkill(item) {
  const id = String(item?.id ?? item?.name ?? '').trim();
  if (!id) return null;
  const source = String(item?.source ?? item?.provenance ?? '').trim();
  const catalog = String(item?.catalog ?? item?.catalogId ?? item?.sourceCatalog ?? '').trim().toLowerCase() || (source ? '' : 'native');
  return Object.freeze({
    id,
    title: String(item?.title ?? item?.name ?? id),
    catalog,
    source: source || (catalog === 'native' ? 'Nolane Agent' : ''),
    maturity: String(item?.maturity ?? item?.status ?? ''),
    description: String(item?.description ?? item?.summary ?? ''),
  });
}

function visibleSkills(state) {
  const query = String(state.query ?? '').trim().toLowerCase();
  const catalog = String(state.catalog ?? '').trim().toLowerCase();
  return state.skills.filter((skill) => {
    if (catalog && skill.catalog !== catalog) return false;
    if (!query) return true;
    return [skill.title, skill.id, skill.source, skill.maturity, skill.description].join(' ').toLowerCase().includes(query);
  });
}

function previewFrom(payload, fallback) {
  const source = payload?.skill ?? payload ?? {};
  return Object.freeze({
    id: fallback.id,
    title: String(source.title ?? source.name ?? fallback.title),
    catalog: String(source.catalog ?? fallback.catalog ?? ''),
    content: String(source.content ?? source.preview ?? source.instructions ?? '').slice(0, 6_000),
  });
}

export function createSkillsLibraryController({ api, language = 'en' } = {}) {
  if (typeof api?.get !== 'function' || typeof api?.post !== 'function') throw new TypeError('Skills library requires api.get and api.post');
  let state = Object.freeze({ status: 'loading', language, query: '', catalog: '', skills: Object.freeze([]), preview: null, error: null });
  const patch = (value) => { state = Object.freeze({ ...state, ...value }); return snapshot(); };
  const snapshot = () => Object.freeze({ ...state, skills: Object.freeze(state.skills.map((skill) => Object.freeze({ ...skill }))), preview: state.preview ? Object.freeze({ ...state.preview }) : null });
  const patchFilter = (value) => {
    const candidate = { ...state, ...value };
    const selectedIsVisible = !candidate.preview || visibleSkills(candidate).some((skill) => skill.id === candidate.preview.id);
    return patch({ ...value, preview: selectedIsVisible ? candidate.preview : null });
  };
  return Object.freeze({
    snapshot,
    async load() {
      patch({ status: 'loading', error: null });
      try {
        const skills = asList(await api.get(`/api/skills/catalog?limit=${SKILL_CATALOG_LIMIT}`)).map(normalizeSkill).filter(Boolean);
        return patch({ status: 'ready', skills: Object.freeze(skills), error: null });
      } catch (error) {
        return patch({ status: 'error', skills: Object.freeze([]), preview: null, error: String(error?.payload?.error ?? error?.message ?? error) });
      }
    },
    setQuery(query) { return patchFilter({ query: String(query ?? '') }); },
    setCatalog(catalog) { return patchFilter({ catalog: String(catalog ?? '').toLowerCase() }); },
    async selectSkill(id) {
      const selected = state.skills.find((skill) => skill.id === String(id ?? ''));
      if (!selected) return patch({ error: 'Unknown skill' });
      try {
        const preview = previewFrom(await api.post(`/api/skills/catalog/${encodeURIComponent(selected.id)}/load`, {}), selected);
        return patch({ preview, error: null });
      } catch (error) {
        return patch({ error: String(error?.payload?.error ?? error?.message ?? error) });
      }
    },
  });
}

function renderSkillItem(skill, selected, text) {
  const meta = [skill.source, skill.maturity].filter(Boolean).join(' · ');
  return `<button type="button" class="skill-library-item" data-skill-library-select="${esc(skill.id)}" aria-pressed="${selected}" aria-label="${esc(`${text.inspect}: ${skill.title}`)}"><span class="skill-library-item__icon">${icon('spark',{size:17})}</span><span class="skill-library-item__body"><strong>${esc(skill.title)}</strong>${skill.description ? `<small>${esc(skill.description)}</small>` : ''}${meta ? `<em>${esc(meta)}</em>` : ''}</span><span class="skill-library-item__arrow" aria-hidden="true">→</span></button>`;
}

export function renderSkillsLibrary(state = {}) {
  const text = copy(state.language);
  const skills = visibleSkills({ ...state, skills: Array.isArray(state.skills) ? state.skills : [] });
  const selectedId = state.preview?.id ?? '';
  const preview = state.preview;
  const controls = `<div class="skills-library__controls"><label class="skills-library__search"><span class="sr-only">${text.search}</span>${icon('search',{size:16})}<input type="search" data-skills-search value="${esc(state.query ?? '')}" placeholder="${esc(text.searchPlaceholder)}"></label><label class="skills-library__filter"><span>${text.catalog}</span><select data-skills-catalog><option value=""${!state.catalog ? ' selected' : ''}>${text.allCatalogs}</option><option value="native"${state.catalog === 'native' ? ' selected' : ''}>${text.native}</option><option value="v2"${state.catalog === 'v2' ? ' selected' : ''}>${text.v2}</option><option value="legacy"${state.catalog === 'legacy' ? ' selected' : ''}>${text.legacy}</option></select></label></div>`;
  let body;
  if (state.status === 'loading') body = `<div class="page-loading skills-library__loading" role="status"><span class="spinner"></span>${text.loading}</div>`;
  else if (state.status === 'error' && !state.skills?.length) body = `<div class="page-error skills-library__error" role="alert">${icon('warning',{size:18})}<span>${esc(text.error)}: ${esc(state.error)}</span></div>`;
  else body = `<div class="skills-library__body"><section class="skills-library__catalog" aria-label="${esc(text.title)}">${skills.length ? `<div class="skills-library__list" role="list">${skills.map((skill) => `<div role="listitem">${renderSkillItem(skill, String(selectedId === skill.id), text)}</div>`).join('')}</div>` : `<div class="empty-state skills-library__empty"><span>${icon('spark',{size:20})}</span><strong>${text.empty}</strong><p>${text.emptyDetail}</p></div>`}</section><aside class="skills-library__preview" aria-live="polite"><header><p class="eyebrow">${text.preview}</p><h2>${preview ? esc(preview.title) : text.preview}</h2>${preview?.catalog ? `<span>${esc(preview.catalog)}</span>` : ''}</header>${preview ? `<pre>${esc(preview.content || text.previewEmpty)}</pre>` : `<div class="skills-library__preview-empty">${icon('eye',{size:20})}<p>${text.previewEmpty}</p></div>`}<footer><a href="#/control-plane/extensions" data-route="/control-plane/extensions">${text.manage} <span aria-hidden="true">→</span></a><small>${text.manageDetail}</small></footer></aside></div>`;
  return `<section class="surface-page skills-library"><header class="surface-page__header"><div><p class="eyebrow">${text.eyebrow}</p><h1>${text.title}</h1><p>${text.subtitle}</p></div></header>${controls}${body}</section>`;
}
