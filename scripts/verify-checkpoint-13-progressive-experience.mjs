import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EXPERIENCE_LEVELS } from '../ui-v3/core/experience-policy.mjs';
import { GLOBAL_DESTINATIONS } from '../ui-v3/shell/global-rail.mjs';
import { CONTROL_PLANE_DOMAINS } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { CONTROL_PLANE_ROUTES } from '../ui-v3/control-plane/route-registry.mjs';
import { createSettingsCatalog } from '../src/settings/settings-catalog.mjs';
import { BACKEND_ATLAS } from '../ui-v3/generated/backend-atlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'ui-dist/index.html',
  'ui-dist/manifest.json',
  'ui-v3/views/home/home-view.mjs',
  'ui-v3/views/activity/activity-view.mjs',
  'ui-v3/views/search/search-view.mjs',
  'ui-v3/control-plane/domains/capabilities.mjs',
  'ui-v3/generated/backend-atlas.json',
  'ui/index.html',
  'docs/checkpoints/checkpoint-13/DEEP-UI-RESEARCH.md',
  'docs/checkpoints/checkpoint-13/IMPLEMENTATION-PLAN.md',
  'docs/checkpoints/checkpoint-13/EXECUTION-REPORT.md',
];
const missing = required.filter((relative) => !fs.existsSync(path.join(root, relative)));
const catalog = createSettingsCatalog();
const fields = catalog.categories.reduce((count, category) => count + category.fields.length, 0);
const findings = [];
if (missing.length) findings.push({ code: 'missing-files', missing });
if (EXPERIENCE_LEVELS.map((item) => item.id).join(',') !== 'everyday,workspace,studio,expert') findings.push({ code: 'experience-contract' });
if (GLOBAL_DESTINATIONS.map((item) => item.id).join(',') !== 'home,missions,projects,review,workroom,browser,control-plane,search,settings') findings.push({ code: 'navigation-contract' });
if (catalog.categories.length !== 18 || fields < 84) findings.push({ code: 'settings-retention', categories: catalog.categories.length, fields });
if (CONTROL_PLANE_DOMAINS.length !== 14 || Object.keys(CONTROL_PLANE_ROUTES).length !== 13 || typeof CONTROL_PLANE_ROUTES.capabilities !== 'function') findings.push({ code: 'control-plane-contract' });
if (BACKEND_ATLAS.total < 398 || BACKEND_ATLAS.domains.length < 90) findings.push({ code: 'backend-atlas-retention', routes: BACKEND_ATLAS.total, domains: BACKEND_ATLAS.domains.length });
const report = {
  schema: 'nolane.checkpoint-13.progressive-experience.verification.v1',
  pass: findings.length === 0,
  experienceLevels: EXPERIENCE_LEVELS.map((item) => item.id),
  globalDestinations: GLOBAL_DESTINATIONS.map((item) => item.id),
  settingsCategories: catalog.categories.length,
  settingsFields: fields,
  controlPlaneDomains: CONTROL_PLANE_DOMAINS.length,
  retainedApprovedDomains: Object.keys(CONTROL_PLANE_ROUTES).length,
  backendRoutes: BACKEND_ATLAS.total,
  backendDomains: BACKEND_ATLAS.domains.length,
  missing,
  findings,
};
report.receiptSha256 = crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex');
console.log(JSON.stringify(report));
if (!report.pass) process.exitCode = 1;
