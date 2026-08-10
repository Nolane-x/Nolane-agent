import test from 'node:test';
import assert from 'node:assert/strict';
import { captureViewState, restoreViewState } from '../ui-v3/core/view-state-preserver.mjs';

function makeElement({ key = null, id = '', name = '', value = undefined, scrollTop = 0, scrollLeft = 0 } = {}) {
  const element = {
    dataset: key ? { scrollKey: key, preserveKey: key } : {},
    id,
    name,
    value,
    scrollTop,
    scrollLeft,
    selectionStart: value === undefined ? null : 2,
    selectionEnd: value === undefined ? null : 4,
    focused: false,
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; },
    matches(selector) { return selector.includes('data-scroll-key') ? Boolean(this.dataset.scrollKey) : Boolean(this.dataset.preserveKey || this.name || this.id); },
  };
  return element;
}

function makeRoot(elements, active = null) {
  return {
    ownerDocument: { activeElement: active },
    contains(element) { return elements.includes(element); },
    matches() { return false; },
    querySelectorAll(selector) {
      if (selector.includes('data-scroll-key')) return elements.filter((item) => item.dataset.scrollKey);
      return elements.filter((item) => item.dataset.preserveKey || item.name || item.id);
    },
  };
}

test('view state preserver captures and restores scroll, focus, value, and selection', () => {
  const scroller = makeElement({ key: 'settings-content', scrollTop: 4200, scrollLeft: 3 });
  const toggle = makeElement({ key: 'editor.confirmMultiLinePaste', value: 'on' });
  const root = makeRoot([scroller, toggle], toggle);
  const snapshot = captureViewState(root);

  scroller.scrollTop = 0;
  scroller.scrollLeft = 0;
  toggle.value = 'off';
  toggle.selectionStart = 0;
  toggle.selectionEnd = 0;
  restoreViewState(root, snapshot);

  assert.equal(scroller.scrollTop, 4200);
  assert.equal(scroller.scrollLeft, 3);
  assert.equal(toggle.value, 'on');
  assert.equal(toggle.focused, true);
  assert.deepEqual([toggle.selectionStart, toggle.selectionEnd], [2, 4]);
});

test('view state preserver ignores unrelated focus outside the rerender root', () => {
  const scroller = makeElement({ key: 'settings-content', scrollTop: 120 });
  const outside = makeElement({ key: 'outside', value: 'keep' });
  const root = makeRoot([scroller], outside);
  const snapshot = captureViewState(root);
  assert.deepEqual(snapshot.focus, null);
  scroller.scrollTop = 0;
  restoreViewState(root, snapshot);
  assert.equal(scroller.scrollTop, 120);
});

