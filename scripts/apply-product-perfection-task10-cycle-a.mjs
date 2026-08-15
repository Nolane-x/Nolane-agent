#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = Object.freeze({
  css: Object.freeze({ path: 'ui-v3/styles/pages/settings.css', blob: '7f956c51e71bec163fb82a3becc4b73d40f1f301' }),
  capturer: Object.freeze({ path: 'scripts/capture-ui-runtime-visual.mjs', blob: 'e2f57ea4ca36220ab703b877ecb096d5d047d449' }),
});
const hash = (file) => execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim();
for (const target of Object.values(TARGETS)) {
  const actual = hash(target.path);
  if (actual !== target.blob) throw new Error(`Task 10 Cycle A refuses drifted ${target.path}: ${actual}`);
}

let css = readFileSync(TARGETS.css.path, 'utf8');
if (css.includes('/* Task 10 Cycle A: compact Settings recomposition */')) throw new Error('Task 10 Cycle A CSS already applied');
css += `

/* Task 10 Cycle A: compact Settings recomposition */
@media(max-width:720px){
  .settings-center{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
  .settings-nav{padding:8px 10px 6px;border-right:0;border-bottom:1px solid var(--border-default);overflow:hidden}
  .settings-brand{display:none}
  .settings-back{min-height:30px;padding-inline:6px}
  .settings-search{margin:5px 0 6px;min-height:34px}
  .experience-switch--four{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:6px}
  .experience-switch--four button{min-height:36px;padding:6px}
  .experience-switch--four small{display:none}
  .settings-nav>nav{display:flex;flex:0 0 auto;gap:4px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;padding:0 0 5px;scrollbar-gutter:auto}
  .settings-nav>nav a{flex:0 0 auto;min-height:34px;padding:5px 8px;white-space:nowrap}
  .settings-nav footer{padding-top:5px}
  .settings-nav footer button{min-height:30px}
  .settings-content{padding:22px 16px max(48px,env(safe-area-inset-bottom))}
  .settings-toolbar{flex-direction:column;align-items:stretch;gap:12px}
  .settings-toolbar h1{font-size:28px}
  .settings-actions{width:100%;align-items:flex-end;flex-wrap:wrap}
  .settings-layer{flex:1 1 180px}
  .settings-actions>button{flex:0 0 auto;white-space:nowrap}
  .setting-row{grid-template-columns:minmax(0,1fr);gap:10px}
  .setting-control{justify-content:flex-start}
  .setting-control select,.setting-control input[type="text"],.setting-control input[type="number"]{width:min(100%,420px)}
}
`;
writeFileSync(TARGETS.css.path, css);

let capturer = readFileSync(TARGETS.capturer.path, 'utf8');
const before = `async function assertVietnameseResponsive(page) {
  const result = await page.evaluate(() => ({
    language: document.documentElement.dataset.language ?? document.documentElement.lang ?? '',
    shellLabel: document.querySelector('[data-command="new-mission"] span')?.textContent?.trim() ?? '',
  }));
  if (!String(result.language).toLowerCase().startsWith('vi') || result.shellLabel !== 'Cuộc trò chuyện mới') {
    throw new Error('Vietnamese responsive state did not project Vietnamese UI truth: ' + JSON.stringify(result));
  }
  return Object.freeze({ vietnameseResponsive: 'PASS' });
}`;
const after = `async function assertVietnameseResponsive(page) {
  const result = await page.evaluate(() => {
    const center = document.querySelector('.settings-center');
    const nav = document.querySelector('.settings-nav');
    const content = document.querySelector('.settings-content');
    const actionButtons = [...document.querySelectorAll('.settings-actions>button')];
    const centerRect = center?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    const contentRect = content?.getBoundingClientRect();
    return {
      language: document.documentElement.dataset.language ?? document.documentElement.lang ?? '',
      shellLabel: document.querySelector('[data-command="new-mission"] span')?.textContent?.trim() ?? '',
      settingsStacked: Boolean(centerRect && navRect && contentRect && contentRect.top >= navRect.bottom - 1),
      contentShare: centerRect && contentRect && centerRect.width > 0 ? contentRect.width / centerRect.width : 0,
      actionsUnclipped: actionButtons.length > 0 && actionButtons.every((node) => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1),
    };
  });
  if (!String(result.language).toLowerCase().startsWith('vi') || result.shellLabel !== 'Cuộc trò chuyện mới' || !result.settingsStacked || result.contentShare < 0.9 || !result.actionsUnclipped) {
    throw new Error('Vietnamese responsive state did not preserve compact Settings hierarchy: ' + JSON.stringify(result));
  }
  return Object.freeze({ vietnameseResponsive: 'PASS', settingsCompactHierarchy: 'PASS' });
}`;
const count = capturer.split(before).length - 1;
if (count !== 1) throw new Error(`Task 10 Cycle A expected one Vietnamese responsive anchor, got ${count}`);
capturer = capturer.replace(before, after);
writeFileSync(TARGETS.capturer.path, capturer);

execFileSync(process.execPath, ['--check', TARGETS.capturer.path], { stdio: 'inherit' });
console.log(JSON.stringify({
  css: { before: TARGETS.css.blob, after: hash(TARGETS.css.path) },
  capturer: { before: TARGETS.capturer.blob, after: hash(TARGETS.capturer.path) },
}));
