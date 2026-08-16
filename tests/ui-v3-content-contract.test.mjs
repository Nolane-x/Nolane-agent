import test from 'node:test';
import assert from 'node:assert/strict';
import { dictionary } from '../ui-v3/core/i18n.mjs';
import { createAttentionCard, renderAttentionCard } from '../ui-v3/views/mission/attention-card.mjs';

test('declared English and Vietnamese dictionaries keep key parity', () => {
  assert.deepEqual(Object.keys(dictionary('vi')).sort(), Object.keys(dictionary('en')).sort());
});

test('attention cards localize decision chrome and state scope plus reversibility explicitly', () => {
  const card = createAttentionCard({
    language: 'vi', kind: 'approval', action: 'Xóa cache build', why: 'Cần dựng lại output sạch', impact: 'Có thể mất artifact tạm', scope: ['dist/cache'], reversible: false, options: ['approve','cancel'],
  });
  const html = renderAttentionCard(card);
  assert.match(html, />Phạm vi</);
  assert.match(html, />Khả năng hoàn tác</);
  assert.match(html, /Không thể hoàn tác/);
  assert.match(html, />Phê duyệt</);
  assert.match(html, />Hủy</);
  assert.doesNotMatch(html, />Approve<|>Cancel<|>Scope<|>Reversibility</);
});

test('attention cards escape external action reason impact scope and option identifiers', () => {
  const card = createAttentionCard({
    action: '<img src=x onerror=alert(1)>', why: '<script>reason</script>', impact: '<svg onload=alert(1)>', scope: ['<b>repo</b>'], reversible: true, options: ['approve'], technical: { receipt: '<iframe>x</iframe>' },
  });
  const html = renderAttentionCard(card);
  assert.doesNotMatch(html, /<img|<script|<svg|<b>repo|<iframe/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;reason/);
  assert.match(html, /&lt;svg/);
  assert.match(html, /&lt;b&gt;repo/);
});

test('irreversible attention cards remain fail-closed with an explicit escape action', () => {
  assert.throws(() => createAttentionCard({ action:'Delete branch', why:'Cleanup', impact:'History changes', scope:['branch:x'], reversible:false, options:['approve'] }), /deny|cancel/i);
});
