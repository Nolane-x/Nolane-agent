import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const base = process.env.NOLANE_UI_RUNTIME_URL;
const token = process.env.NOLANE_AGENT_TOKEN;
const out = process.env.NOLANE_TASK8_RUNTIME_OUTPUT;
if (!base || !token || !out) throw new Error('Task 8 runtime probe requires URL, token and output');
await mkdir(out, { recursive: true });
const captures = [];
const browser = await chromium.launch({ headless: true });

async function assertAxe(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  const blocking = result.violations.filter((item) => ['serious','critical'].includes(String(item.impact)));
  if (blocking.length) throw new Error(`${label} Axe blockers: ${blocking.map((item) => item.id).join(', ')}`);
}
async function assertNoOverflow(page, label) {
  const value = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) }));
  if (value.documentWidth > value.viewport + 1) throw new Error(`${label} horizontal overflow ${value.documentWidth}>${value.viewport}`);
}
async function shot(page, id) {
  const file = path.join(out, `${id}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  const bytes = await readFile(file);
  captures.push({ id, file: path.basename(file), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

try {
  const skillsContext = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const skills = await skillsContext.newPage();
  await skills.route('**/api/skills/catalog?limit=500', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ skills: [{ id:'guarded-skill', title:'Guarded Skill', source:'nolane', catalog:'local', installed:true, enabled:false, configured:true, ready:false, blocked:true, maturity:'stable', description:'Capability truth runtime fixture' }] }) }));
  await skills.goto(`${base}/#/skills?token=${encodeURIComponent(token)}`, { waitUntil:'domcontentloaded', timeout:30000 });
  await skills.locator('.skills-library').waitFor({ state:'visible', timeout:30000 });
  for (const state of ['installed','disabled','configured','not-ready','blocked']) await skills.locator(`[data-skill-capability-state="${state}"]`).waitFor({ state:'visible', timeout:5000 });
  if (await skills.locator('[data-skill-capability-state="ready"]').count()) throw new Error('Skills inferred ready despite ready=false');
  await skills.locator('[data-skills-search]').fill('blocked'); await skills.waitForTimeout(100);
  if (!(await skills.getByText('Guarded Skill').count())) throw new Error('Skills state search failed');
  await assertNoOverflow(skills, 'Skills truth'); await assertAxe(skills, 'Skills truth'); await shot(skills, 'skills-1180-capability-truth');
  await skillsContext.close();

  const settingsContext = await browser.newContext({ viewport: { width: 980, height: 900 } });
  const settings = await settingsContext.newPage();
  await settings.goto(`${base}/#/settings?token=${encodeURIComponent(token)}`, { waitUntil:'domcontentloaded', timeout:30000 });
  const search = settings.locator('[data-settings-search]'); await search.waitFor({ state:'visible', timeout:30000 });
  await search.focus(); await search.fill('provider'); await search.evaluate((el) => el.setSelectionRange(3, 5)); await settings.waitForTimeout(180);
  const focus = await settings.evaluate(() => { const el=document.activeElement; return { isSearch:Boolean(el?.matches?.('[data-settings-search]')), value:el?.value??null, selection:el?.selectionStart==null?null:[el.selectionStart,el.selectionEnd] }; });
  if (!focus.isSearch || focus.value !== 'provider' || JSON.stringify(focus.selection) !== '[3,5]') throw new Error(`Settings continuity failed: ${JSON.stringify(focus)}`);
  await assertNoOverflow(settings, 'Settings search'); await assertAxe(settings, 'Settings search'); await shot(settings, 'settings-980-search-continuity');
  await settingsContext.close();

  const cpContext = await browser.newContext({ viewport: { width: 1180, height: 1000 } });
  const cp = await cpContext.newPage();
  const fixtures = new Map([
    ['/api/missions', { status:'ready', missions:[] }],
    ['/api/provider-connections/readiness', { status:'blocked' }],
    ['/api/runtime-readiness/architecture', { status:'configured' }],
    ['/api/security-certification/snapshot', { status:'offline' }],
  ]);
  for (const [pathname, payload] of fixtures) await cp.route(`**${pathname}`, async (route) => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(payload) }));
  await cp.goto(`${base}/#/control-plane/overview?token=${encodeURIComponent(token)}`, { waitUntil:'domcontentloaded', timeout:30000 });
  await cp.locator('.control-plane-live-workspace').waitFor({ state:'visible', timeout:30000 });
  const text = (await cp.locator('.control-plane-live-workspace').innerText()).replace(/\s+/g, ' ');
  if (!/Adapters online\s*1\/4/i.test(text)) throw new Error(`Control Plane online KPI is not truthful: ${text.slice(0,900)}`);
  if (/Adapters online\s*4\/4/i.test(text)) throw new Error('Control Plane counted non-ready records online');
  const status = await cp.locator('.control-plane-live-workspace').getAttribute('data-state');
  if (status !== 'degraded') throw new Error(`Control Plane expected degraded, got ${status}`);
  await assertNoOverflow(cp, 'Control Plane truth'); await assertAxe(cp, 'Control Plane truth'); await shot(cp, 'control-plane-1180-semantic-health');
  await cpContext.close();
} finally {
  await browser.close();
}

const report = { schema:'nolane.task8.runtime-evidence.v2', sourceRevision:process.env.GITHUB_SHA, captures };
report.receiptSha256 = createHash('sha256').update(JSON.stringify(report)).digest('hex');
await writeFile(path.join(out, 'receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ receiptSha256: report.receiptSha256, captures: captures.length }));
