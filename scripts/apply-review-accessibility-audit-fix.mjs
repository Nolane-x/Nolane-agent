import { readFile, writeFile } from 'node:fs/promises';

const auditFile = 'scripts/audit-ui-v3-accessibility.mjs';
const reviewFile = 'ui-v3/views/review/review-view.mjs';
let audit = await readFile(auditFile, 'utf8');
let review = await readFile(reviewFile, 'utf8');

const oldAudit = "  ['review-navigation-label', 'ui-v3/views/review/review-view.mjs', /aria-label=\"Changed files\"/],";
const newAudit = "  ['review-navigation-label', 'ui-v3/views/review/review-view.mjs', /class=\"change-navigator\" aria-label=/],";
if (audit.split(oldAudit).length !== 2) throw new Error('review accessibility audit anchor is missing or non-unique');
audit = audit.replace(oldAudit, newAudit);

const oldLegacy = 'return `<section class="review-shell"><aside class="change-navigator"><h3>${fileLabel}</h3>${state.files.map((f) => `<button data-file="${esc(f.id)}">${esc(f.path)}</button>`).join(\'\')}</aside><main class="diff-viewport">${state.hunks.map((h) => `<article data-hunk="${esc(h.id)}"><strong>${hunkPrefix} ${esc(h.id)}</strong><span>${esc(h.decision)}</span></article>`).join(\'\')}</main></section>`;';
const newLegacy = 'return `<section class="review-shell"><aside class="change-navigator" aria-label="${esc(fileLabel)}"><h3>${fileLabel}</h3>${state.files.map((f) => `<button data-file="${esc(f.id)}">${esc(f.path)}</button>`).join(\'\')}</aside><main class="diff-viewport">${state.hunks.map((h) => `<article data-hunk="${esc(h.id)}"><strong>${hunkPrefix} ${esc(h.id)}</strong><span>${esc(h.decision)}</span></article>`).join(\'\')}</main></section>`;';
if (review.split(oldLegacy).length !== 2) throw new Error('legacy Review navigation anchor is missing or non-unique');
review = review.replace(oldLegacy, newLegacy);

await writeFile(auditFile, audit);
await writeFile(reviewFile, review);
console.log(JSON.stringify({ changed: [auditFile, reviewFile] }));
