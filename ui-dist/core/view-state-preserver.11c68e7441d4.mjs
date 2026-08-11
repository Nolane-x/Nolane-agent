function identityOf(element) {
  if (!element) return null;
  const data = element.dataset ?? {};
  return data.preserveKey ?? data.settingPath ?? element.name ?? element.id ?? null;
}

function elementsWith(root, selector) {
  if (!root) return [];
  const result = [];
  if (typeof root.matches === 'function' && root.matches(selector)) result.push(root);
  if (typeof root.querySelectorAll === 'function') result.push(...root.querySelectorAll(selector));
  return result;
}

function findByIdentity(root, key) {
  if (!key) return null;
  return elementsWith(root, '[data-preserve-key], [data-setting-path], [name], [id]').find((element) => identityOf(element) === key) ?? null;
}

export function captureViewState(root, { scrollSelector = '[data-scroll-key]' } = {}) {
  if (!root) return Object.freeze({ scroll: Object.freeze([]), focus: null });
  const active = root.ownerDocument?.activeElement;
  const focus = active && (active === root || root.contains?.(active))
    ? Object.freeze({
      key: identityOf(active),
      value: active.value,
      selection: active.selectionStart == null ? null : [active.selectionStart, active.selectionEnd],
    })
    : null;
  const scroll = elementsWith(root, scrollSelector).map((element) => Object.freeze({
    key: element.dataset?.scrollKey ?? null,
    top: Number(element.scrollTop) || 0,
    left: Number(element.scrollLeft) || 0,
  })).filter((item) => item.key);
  return Object.freeze({ scroll: Object.freeze(scroll), focus });
}

export function restoreViewState(root, snapshot, { restoreFocus = true } = {}) {
  if (!root || !snapshot) return root;
  for (const saved of snapshot.scroll ?? []) {
    const element = elementsWith(root, '[data-scroll-key]').find((candidate) => candidate.dataset?.scrollKey === saved.key);
    if (!element) continue;
    element.scrollTop = saved.top;
    element.scrollLeft = saved.left;
  }
  const focus = snapshot.focus;
  const target = restoreFocus && focus?.key ? findByIdentity(root, focus.key) : null;
  if (target) {
    if (focus.value !== undefined && 'value' in target) target.value = focus.value;
    target.focus?.({ preventScroll: true });
    if (focus.selection && typeof target.setSelectionRange === 'function') target.setSelectionRange(...focus.selection);
  }
  return root;
}
