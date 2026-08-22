export function isComposerPickerInteraction(target) {
  return Boolean(target?.closest?.('[data-composer-picker]'));
}

export function closeComposerPickers(root = globalThis.document) {
  root?.querySelectorAll?.('[data-composer-picker-menu]').forEach((menu) => {
    menu.hidden = true;
    menu.closest?.('[data-composer-picker]')
      ?.querySelector?.('[data-composer-picker-toggle]')
      ?.setAttribute('aria-expanded', 'false');
  });
}
