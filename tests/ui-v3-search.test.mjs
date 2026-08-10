import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSearchView } from '../ui-v3/views/search/search-view.mjs';

test('search surface localizes filters and result types', () => {
  const html = renderSearchView({ language: 'vi', status: 'ready', filter: 'all', query: 'demo', items: [{ type: 'project', id: 'p1', title: 'Dự án demo', detail: 'Cục bộ', route: '/projects?id=p1', search: 'demo' }] });
  assert.match(html, /Chỉ mục toàn không gian/);
  assert.match(html, /Dự án<\/span><strong>1<\/strong>/);
  assert.match(html, />Dự án demo<\/strong>/);
  assert.doesNotMatch(html, /Universal index|Project<\/span>|Sorted by relevance/);
});

test('search surface keeps English labels when English is selected', () => {
  const html = renderSearchView({ language: 'en', status: 'ready', filter: 'all', query: '', items: [] });
  assert.match(html, /Universal index/);
  assert.match(html, /One search for the entire workspace/);
  assert.doesNotMatch(html, /Chỉ mục toàn không gian|Dự án|Nhiệm vụ/);
});
