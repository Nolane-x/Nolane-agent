#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const TARGETS = Object.freeze({
  view: Object.freeze({ path: 'ui-v3/views/settings/settings-view.mjs', blob: 'd1c3517dd7a5e1f12e7c5aef2bceeb5bc1764b7f' }),
  css: Object.freeze({ path: 'ui-v3/styles/pages/settings.css', blob: '7f956c51e71bec163fb82a3becc4b73d40f1f301' }),
});
const hash = (file) => execFileSync('git', ['hash-object', file], { encoding: 'utf8' }).trim();
for (const target of Object.values(TARGETS)) {
  const actual = hash(target.path);
  if (actual !== target.blob) throw new Error(`Task 10 Cycle B refuses drifted ${target.path}: ${actual}`);
}

let view = readFileSync(TARGETS.view.path, 'utf8');
const before = `<button type="button" class="primary" data-settings-action="save"${state.saving||!state.dirty?' disabled':''}>${state.saving?(lang==='vi'?'Đang lưu…':'Saving…'):state.dirty?(lang==='vi'?'Lưu thay đổi':'Save changes'):(lang==='vi'?'Đã lưu':'Saved')}</button>`;
const after = `<button type="button"${state.dirty&&!state.saving?' class="primary"':''} data-settings-action="save" data-settings-save-state="${state.saving?'saving':state.dirty?'dirty':'saved'}"${state.saving||!state.dirty?' disabled':''}>${state.saving?(lang==='vi'?'Đang lưu…':'Saving…'):state.dirty?(lang==='vi'?'Lưu thay đổi':'Save changes'):(lang==='vi'?'Đã lưu':'Saved')}</button>`;
const count = view.split(before).length - 1;
if (count !== 1) throw new Error(`Task 10 Cycle B expected one save-control anchor, got ${count}`);
view = view.replace(before, after);
writeFileSync(TARGETS.view.path, view);

let css = readFileSync(TARGETS.css.path, 'utf8');
if (css.includes('/* Task 10 Cycle B: save-state material hierarchy */')) throw new Error('Task 10 Cycle B CSS already applied');
css += `

/* Task 10 Cycle B: save-state material hierarchy */
.settings-actions>button.primary[data-settings-save-state="dirty"]{border-color:var(--accent);background:var(--accent);color:var(--text-inverse);opacity:1}
.settings-actions>button[data-settings-save-state="saved"]{border-color:var(--border-default);background:var(--surface-raised);color:var(--text-secondary);opacity:.82}
.settings-actions>button[data-settings-save-state="saving"]{border-color:color-mix(in srgb,var(--accent) 35%,var(--border-default));background:var(--accent-soft);color:var(--text-primary);opacity:.82}
`;
writeFileSync(TARGETS.css.path, css);

execFileSync(process.execPath, ['--check', TARGETS.view.path], { stdio: 'inherit' });
console.log(JSON.stringify({
  view: { before: TARGETS.view.blob, after: hash(TARGETS.view.path) },
  css: { before: TARGETS.css.blob, after: hash(TARGETS.css.path) },
}));
