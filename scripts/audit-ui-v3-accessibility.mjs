#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKS = Object.freeze([
  ['document-language', 'ui-v3/index.html', /<html[^>]+lang=["'][^"']+["']/i],
  ['viewport', 'ui-v3/index.html', /name=["']viewport["']/i],
  ['workspace-landmark', 'ui-v3/shell/app-shell.mjs', /<main id="workspace"[^>]+tabindex="-1"/],
  ['route-live-region', 'ui-v3/shell/app-shell.mjs', /role="status"[^>]+aria-live="polite"/],
  ['artifact-tab-semantics', 'ui-v3/views/mission/artifact-dock.mjs', /role="tablist"/],
  ['review-navigation-label', 'ui-v3/views/review/review-view.mjs', /aria-label="Changed files"/],
  ['reduced-motion', 'ui-v3/styles/motion.css', /prefers-reduced-motion:\s*reduce/],
  ['focus-target', 'ui-v3/app.mjs', /querySelector\('#workspace'\)\?\.focus/],
]);
export async function auditUiV3Accessibility({ root = process.cwd(), outputPath = null } = {}) {
  const results = [];
  for (const [id, relative, pattern] of CHECKS) {
    let source = ''; try { source = await readFile(path.join(root, relative), 'utf8'); } catch {}
    results.push(Object.freeze({ id, path: relative, pass: pattern.test(source) }));
  }
  const missing = results.filter((item) => !item.pass).map((item) => item.id);
  const report = Object.freeze({ schema: 'nolane.ui.accessibility-source-audit.v1', sourceLocalPass: missing.length === 0, missing: Object.freeze(missing), checks: Object.freeze(results), screenReaderCertified: false, windowsHighContrastCertified: false, nonClaim: 'Source semantics do not replace NVDA, Narrator, Windows High Contrast, zoom, or keyboard journey certification on a real machine.' });
  if (outputPath) { await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`); }
  return report;
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) auditUiV3Accessibility({ outputPath: path.resolve('docs/ui-v3/accessibility-source-audit.json') }).then((value) => console.log(JSON.stringify(value))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
