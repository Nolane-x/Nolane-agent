import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSettingsView } from '../ui-v3/views/settings/settings-view.mjs';

test('settings center has landmarks labels live status and keyboard-friendly controls', () => {
  const state={status:'ready',experience:'standard',query:'',draft:{general:{language:'system'}},provenance:{},warnings:[],errors:[],visibleCategories:[{id:'general',title:'General',description:'Core',fields:[{path:'general.language',title:'Language',type:'select',options:['system','en'],scope:['user'],level:'standard'}]}],models:{models:[]},providers:[]};
  const html=renderSettingsView(state);
  assert.match(html,/aria-label="Settings categories"/);
  assert.match(html,/type="search"/);
  assert.match(html,/role="status"/);
  assert.match(html,/for="setting-general\.language"/);
  assert.match(html,/data-experience="research"/);
  assert.match(html,/data-settings-layer/);
});
