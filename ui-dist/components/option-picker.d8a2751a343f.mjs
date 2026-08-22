import { icon } from '../core/icon.31b1d4782466.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);

function pickerFrom(target) {
  return target?.closest?.('[data-option-picker]') ?? null;
}

function pickerMenu(picker) {
  return picker?.querySelector?.('[data-option-picker-menu]') ?? null;
}

function pickerTrigger(picker) {
  return picker?.querySelector?.('[data-option-picker-toggle]') ?? null;
}

function setOpen(picker, open) {
  const menu = pickerMenu(picker);
  const trigger = pickerTrigger(picker);
  if (!menu || !trigger) return false;
  menu.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  return true;
}

function enabledOptions(picker) {
  return [...picker?.querySelectorAll?.('[data-option-picker-option]:not([disabled])') ?? []];
}

export function renderOptionPicker({ id, label, selected = '', options = [], className = '', valueDataAttribute = '', valueDataValue = '', inputId = '', name = '', disabled = false } = {}) {
  const pickerId = String(id ?? '').trim();
  if (!pickerId) throw new TypeError('Option picker id is required');
  const items = Array.isArray(options) ? options : [];
  const chosen = items.find((item) => String(item?.value ?? '') === String(selected ?? '')) ?? items[0] ?? { value: '', label: '' };
  const menuId = `option-picker-${pickerId}`;
  const changeAttribute = /^data-[a-z0-9-]+$/.test(valueDataAttribute) ? ` ${valueDataAttribute}${valueDataValue === '' ? '' : `="${esc(valueDataValue)}"`}` : '';
  const inputIdAttribute = String(inputId ?? '').trim() ? ` id="${esc(inputId)}"` : '';
  const nameAttribute = /^[A-Za-z][A-Za-z0-9_-]*$/.test(name) ? ` name="${esc(name)}"` : '';
  const disabledAttribute = disabled ? ' disabled aria-disabled="true"' : '';
  return `<div class="option-picker ${esc(className)}" data-option-picker="${esc(pickerId)}">
    <input type="hidden" data-option-picker-value${changeAttribute}${inputIdAttribute}${nameAttribute} value="${esc(chosen.value)}">
    <button type="button" class="option-picker__trigger" data-option-picker-toggle aria-label="${esc(label)}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${esc(menuId)}"${disabledAttribute}><span data-option-picker-label>${esc(chosen.label)}</span>${icon('chevron',{size:14})}</button>
    <div id="${esc(menuId)}" class="option-picker__menu" data-option-picker-menu role="listbox" aria-label="${esc(label)}" hidden>${items.map((item) => `<button type="button" role="option" class="option-picker__option" data-option-picker-option="${esc(item.value)}" aria-selected="${String(String(item.value) === String(chosen.value))}"${item.disabled ? ' disabled aria-disabled="true"' : ''}>${esc(item.label)}</button>`).join('')}</div>
  </div>`;
}

export function closeOptionPickers(root, { except = null } = {}) {
  root?.querySelectorAll?.('[data-option-picker]').forEach((picker) => {
    if (picker !== except) setOpen(picker, false);
  });
}

export function toggleOptionPicker(root, trigger) {
  const picker = pickerFrom(trigger);
  if (!picker || trigger?.disabled) return false;
  const shouldOpen = pickerMenu(picker)?.hidden !== false;
  closeOptionPickers(root, { except: picker });
  if (!setOpen(picker, shouldOpen)) return false;
  if (shouldOpen) (picker.querySelector('[data-option-picker-option][aria-selected="true"]') ?? enabledOptions(picker)[0])?.focus({ preventScroll: true });
  return true;
}

export function selectOptionPicker(root, option) {
  const picker = pickerFrom(option);
  if (!picker || option?.disabled) return null;
  const value = String(option.dataset.optionPickerOption ?? '');
  const valueInput = picker.querySelector('[data-option-picker-value]');
  if (valueInput) {
    valueInput.value = value;
    valueInput.setAttribute('value', value);
  }
  picker.querySelector('[data-option-picker-label]')?.replaceChildren(option.textContent ?? '');
  picker.querySelectorAll('[data-option-picker-option]').forEach((item) => item.setAttribute('aria-selected', String(item === option)));
  closeOptionPickers(root);
  return Object.freeze({ id: String(picker.dataset.optionPicker ?? ''), value, trigger: pickerTrigger(picker) });
}

export function handleOptionPickerKeydown(root, event) {
  const picker = pickerFrom(event.target);
  if (!picker) return false;
  const trigger = pickerTrigger(picker);
  const options = enabledOptions(picker);
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOptionPickers(root);
    trigger?.focus({ preventScroll: true });
    return true;
  }
  if (event.target === trigger && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    toggleOptionPicker(root, trigger);
    const current = picker.querySelector('[data-option-picker-option][aria-selected="true"]');
    (event.key === 'ArrowUp' ? options.at(-1) : current ?? options[0])?.focus({ preventScroll: true });
    return true;
  }
  const index = options.indexOf(event.target.closest?.('[data-option-picker-option]'));
  if (index < 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return false;
  event.preventDefault();
  const next = event.key === 'Home' ? options[0] : event.key === 'End' ? options.at(-1) : options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length];
  next?.focus({ preventScroll: true });
  return true;
}
