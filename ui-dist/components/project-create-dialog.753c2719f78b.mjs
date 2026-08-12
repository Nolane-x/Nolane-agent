import { icon } from '../core/icon.e69bfa36c375.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function copy(language = 'en') {
  return language === 'vi'
    ? { eyebrow: 'THƯ MỤC CỤC BỘ', title: 'Thêm dự án', description: 'Chọn thư mục dự án để Nolane làm việc trong đúng workspace đó.', path: 'Đường dẫn thư mục', hint: 'Nhập đường dẫn đầy đủ đến thư mục trên máy này.', browse: 'Chọn thư mục', cancel: 'Hủy', submit: 'Thêm dự án', required: 'Nhập đường dẫn thư mục.' }
    : { eyebrow: 'LOCAL FOLDER', title: 'Add a project', description: 'Choose the project folder so Nolane works in that exact workspace.', path: 'Folder path', hint: 'Enter the full path to a folder on this machine.', browse: 'Choose folder', cancel: 'Cancel', submit: 'Add project', required: 'Enter a folder path.' };
}

export function renderProjectCreateDialog({ language = 'en', canBrowse = false } = {}) {
  const text = copy(language);
  return `<dialog class="project-create-dialog" aria-modal="true" aria-labelledby="project-create-title" data-project-create-dialog>
    <form method="dialog" data-project-create-form>
      <header><span class="project-create-dialog__icon">${icon('projects', { size: 19 })}</span><div><p>${esc(text.eyebrow)}</p><h2 id="project-create-title">${esc(text.title)}</h2></div></header>
      <p class="project-create-dialog__description">${esc(text.description)}</p>
      <label class="project-create-dialog__field" for="project-create-workspace-root"><span>${esc(text.path)}</span><input id="project-create-workspace-root" name="workspaceRoot" required autocomplete="off" spellcheck="false" aria-describedby="project-create-workspace-hint" placeholder="C:\\Projects\\my-app"></label>
      <p id="project-create-workspace-hint" class="project-create-dialog__hint">${esc(text.hint)}</p>
      <footer>${canBrowse ? `<button type="button" class="project-create-dialog__browse" data-project-select-directory>${icon('projects', { size: 16 })}<span>${esc(text.browse)}</span></button>` : '<span></span>'}<div><button type="button" data-project-dialog-cancel>${esc(text.cancel)}</button><button type="submit" class="project-create-dialog__submit">${esc(text.submit)}</button></div></footer>
    </form>
  </dialog>`;
}

export function openProjectCreateDialog({ language = 'en', selectDirectory = null } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.innerHTML = renderProjectCreateDialog({ language, canBrowse: typeof selectDirectory === 'function' });
    const dialog = host.querySelector('[data-project-create-dialog]');
    const form = host.querySelector('[data-project-create-form]');
    const input = host.querySelector('[name="workspaceRoot"]');
    const finish = (value = null) => {
      if (!host.isConnected) return;
      dialog.close?.();
      host.remove();
      resolve(value);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const workspaceRoot = String(input.value ?? '').trim();
      if (!workspaceRoot) {
        input.setCustomValidity(copy(language).required);
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      finish(workspaceRoot);
    });
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) finish(); });
    host.querySelector('[data-project-dialog-cancel]')?.addEventListener('click', () => finish());
    host.querySelector('[data-project-select-directory]')?.addEventListener('click', async () => {
      const workspaceRoot = await selectDirectory();
      if (!workspaceRoot) return;
      input.value = workspaceRoot;
      input.focus({ preventScroll: true });
    });

    document.body.append(host);
    dialog.showModal();
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  });
}
