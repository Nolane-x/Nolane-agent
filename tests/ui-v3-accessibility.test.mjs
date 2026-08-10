import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('runtime-critical labels use the legible secondary text token', async () => {
  const [shell, experience, onboarding, home] = await Promise.all([
    readFile('ui-v3/styles/layout/app-shell.css', 'utf8'),
    readFile('ui-v3/styles/components/experience-switcher.css', 'utf8'),
    readFile('ui-v3/styles/pages/onboarding.css', 'utf8'),
    readFile('ui-v3/styles/pages/home.css', 'utf8'),
  ]);
  assert.match(shell, /\.app-topbar__title\{[^}]*color:var\(--text-secondary\)/);
  assert.match(experience, /\.app-topbar__actions>\.experience-switcher>\.experience-pill\{[^}]*color:var\(--text-secondary\)/);
  assert.match(onboarding, /\.onboarding-choice small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(onboarding, /\.onboarding-actions button\.primary,\.onboarding-complete button\.primary\{[^}]*color:var\(--nolane-ink\)/);
  assert.match(home, /\.home-intro__copy>\.eyebrow,\.home-section>header .eyebrow\{[^}]*color:var\(--text-secondary\)/);
  assert.match(home, /\.home-subtitle\{[^}]*color:var\(--text-secondary\)/);
});
