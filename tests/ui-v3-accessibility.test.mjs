import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderProjectsView } from '../ui-v3/views/projects/project-view.mjs';
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
  const [shell, experience, onboarding, home, surfaces, settings, workroom, controlPlane] = await Promise.all([
    readFile('ui-v3/styles/layout/app-shell.css', 'utf8'),
    readFile('ui-v3/styles/components/experience-switcher.css', 'utf8'),
    readFile('ui-v3/styles/pages/onboarding.css', 'utf8'),
    readFile('ui-v3/styles/pages/home.css', 'utf8'),
    readFile('ui-v3/styles/pages/surfaces.css', 'utf8'),
    readFile('ui-v3/styles/pages/settings.css', 'utf8'),
    readFile('ui-v3/styles/pages/workroom.css', 'utf8'),
    readFile('ui-v3/styles/pages/control-plane.css', 'utf8'),
  ]);
  assert.match(shell, /\.app-topbar__title\{[^}]*color:var\(--text-secondary\)/);
  assert.match(experience, /\.app-topbar__actions>\.experience-switcher>\.experience-pill\{[^}]*color:var\(--text-secondary\)/);
  assert.match(onboarding, /\.onboarding-choice small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(onboarding, /\.onboarding-actions button\.primary,\.onboarding-complete button\.primary\{[^}]*color:var\(--nolane-ink\)/);
  assert.match(home, /\.home-intro__copy>\.eyebrow,\.home-section>header .eyebrow\{[^}]*color:var\(--text-secondary\)/);
  assert.match(home, /\.home-subtitle\{[^}]*color:var\(--text-secondary\)/);
  assert.match(home, /\.home-section>header>a\{[^}]*color:var\(--text-secondary\)/);
  assert.match(home, /\.capability-card small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(home, /\.empty-state p\{[^}]*color:var\(--text-secondary\)/);
  assert.match(surfaces, /\.surface-page__header \.eyebrow\{[^}]*color:var\(--text-secondary\)/);
  assert.match(surfaces, /\.surface-page__header p:last-child\{[^}]*color:var\(--text-secondary\)/);
  assert.match(surfaces, /\.surface-primary\{[^}]*color:var\(--nolane-ink\)/);
  assert.match(settings, /\.settings-nav \.settings-brand small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.experience-switch--four small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.settings-nav footer button\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.setting-copy small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.settings-section__eyebrow\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.theme-gallery small\{[^}]*color:var\(--text-secondary\)/);
  assert.match(settings, /\.settings-center \.accent-picker>span\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-header a\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-header p\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-header button:last-child\{[^}]*color:var\(--text-primary\)/);
  assert.match(workroom, /\.workroom-tabs button\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-files>header,\.workroom-agent>header,\.workroom-editor>header\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-empty span\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-empty p\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-agent>header button\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-agent__body p\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-statusbar span\{[^}]*color:var\(--text-secondary\)/);
  assert.match(workroom, /\.workroom-statusbar span:first-child\{[^}]*color:var\(--text-secondary\)/);
  assert.match(controlPlane, /\.control-plane-shell>header>span\{[^}]*color:var\(--text-secondary\)/);
  assert.match(controlPlane, /\.control-plane-shell>nav a\[aria-current="false"\]\{[^}]*color:var\(--text-secondary\)/);
  assert.match(controlPlane, /\.control-plane-shell>nav a\[aria-current="page"\]\[data-control-plane-domain\]\{[^}]*color:var\(--text-primary\)/);
});

test('project view toggle buttons have localized accessible names', () => {
  const english = renderProjectsView({status:'ready',language:'en',projects:[]});
  const vietnamese = renderProjectsView({status:'ready',language:'vi',projects:[]});
  assert.match(english, /class="surface-view-toggle"><button[^>]*aria-label="Project grid view"/);
  assert.match(english, /class="surface-view-toggle"><button[^>]*Project grid view[^>]*>[\s\S]*?<\/button><button[^>]*aria-label="Project activity view"/);
  assert.match(vietnamese, /aria-label="Chế độ lưới dự án"/);
  assert.match(vietnamese, /aria-label="Chế độ hoạt động dự án"/);
});
