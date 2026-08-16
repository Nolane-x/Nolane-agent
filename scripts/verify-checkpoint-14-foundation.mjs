import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSettingsCatalog } from '../src/settings/settings-catalog.mjs';
import { PERSONALIZATION_RUNTIME_PATHS, PERSONALIZATION_SETTING_PATHS } from '../src/personalization/personalization-profile-schema.mjs';
import { EXPERIENCE_LEVELS } from '../ui-v3/core/experience-policy.mjs';
import { GLOBAL_DESTINATIONS } from '../ui-v3/shell/global-rail.mjs';
import { CONTROL_PLANE_DOMAINS } from '../ui-v3/control-plane/control-plane-shell.mjs';
import { BACKEND_ATLAS } from '../ui-v3/generated/backend-atlas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function stableReceipt(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function verifyCheckpoint14Foundation() {
  const retention = JSON.parse(read('requirements/checkpoint-14-retention-contract.json'));
  const contract = JSON.parse(read('requirements/checkpoint-14-foundation-contract.json'));
  const routesSource = read('src/server/routes.mjs');
  const appSource = read('src/app.mjs');
  const adoptionFoundationSource = read('src/adoption/trust-adoption-foundation.mjs');
  const switcherSource = read('ui-v3/components/experience-switcher/experience-switcher.mjs');
  const transitionSource = read('ui-v3/core/experience-transition-controller.mjs');
  const onboardingSource = read('ui-v3/views/onboarding/onboarding-view.mjs');
  const profileSource = read('src/personalization/personalization-profile-service.mjs');
  const updateCoordinatorSource = read('desktop/update-coordinator.cjs');
  const preloadSource = read('desktop/preload.cjs');
  const updateNoticeSource = read('ui-v3/components/update-notice/update-notice.mjs');
  const updateServiceSource = read('src/update/update-service.mjs');
  const snapshotSource = read('src/update/pre-update-snapshot.mjs');
  const storeSource = read('src/storage/studio-store.mjs');
  const installerSource = read('build/installer.nsh');
  const desktopMainSource = read('desktop/main.cjs');
  const readme = read('README.md');
  const architecture = read('docs/ARCHITECTURE.md');
  const packageJson = JSON.parse(read('package.json'));
  const settingsCatalog = createSettingsCatalog();
  const settingsFields = settingsCatalog.categories.reduce((total, category) => total + category.fields.length, 0);
  const findings = [];

  const requiredFiles = [
    'docs/COMPATIBILITY-SUBSTRATES.md',
    'docs/checkpoints/checkpoint-14/BASELINE-TRUTH.md',
    'requirements/checkpoint-14-retention-contract.json',
    'requirements/checkpoint-14-source-truth-ledger.json',
    'requirements/checkpoint-14-foundation-contract.json',
    'src/adoption/trust-adoption-foundation.mjs',
    'src/personalization/personalization-profile-service.mjs',
    'src/personalization/personalization-metadata-store.mjs',
    'src/onboarding/onboarding-service.mjs',
    'src/onboarding/onboarding-state-store.mjs',
    'src/session/session-restore-service.mjs',
    'src/session/session-restore-store.mjs',
    'src/session/composer-draft-store.mjs',
    'desktop/window-state-store.cjs',
    'desktop/update-preference-store.cjs',
    'desktop/update-coordinator.cjs',
    'src/update/pre-update-snapshot.mjs',
    'src/update/update-preparation-service.mjs',
    'src/update/migration-journal.mjs',
    'ui-v3/components/experience-switcher/experience-switcher.mjs',
    'ui-v3/core/experience-transition-controller.mjs',
    'ui-v3/core/view-state-bridge.mjs',
    'ui-v3/core/session-restore-controller.mjs',
    'ui-v3/core/update-state-controller.mjs',
    'ui-v3/components/update-notice/update-notice.mjs',
    'ui-v3/views/onboarding/onboarding-view.mjs',
    'ui-dist/index.html',
    'ui-dist/manifest.json'
  ];
  const missingFiles = requiredFiles.filter((relative) => !exists(relative));
  if (missingFiles.length) findings.push({ code: 'missing-foundation-files', files: missingFiles });

  for (const relative of retention.requiredPaths) {
    if (!exists(relative)) findings.push({ code: 'retention-path-missing', path: relative });
  }

  const levels = EXPERIENCE_LEVELS.map((item) => item.id);
  if (levels.join(',') !== contract.requiredExperienceLevels.join(',')) {
    findings.push({ code: 'experience-level-contract', expected: contract.requiredExperienceLevels, actual: levels });
  }
  if (GLOBAL_DESTINATIONS.length < retention.counts.globalDestinations) {
    findings.push({ code: 'global-destination-retention', actual: GLOBAL_DESTINATIONS.length });
  }
  if (CONTROL_PLANE_DOMAINS.length < retention.counts.controlPlaneDomains) {
    findings.push({ code: 'control-plane-retention', actual: CONTROL_PLANE_DOMAINS.length });
  }
  if (settingsCatalog.categories.length < retention.counts.settingsCategories || settingsFields < retention.counts.settingsFields) {
    findings.push({ code: 'settings-retention', categories: settingsCatalog.categories.length, fields: settingsFields });
  }
  if (BACKEND_ATLAS.total < retention.counts.backendRoutes || BACKEND_ATLAS.domains.length < retention.counts.backendDomains) {
    findings.push({ code: 'backend-atlas-retention', routes: BACKEND_ATLAS.total, domains: BACKEND_ATLAS.domains.length });
  }

  for (const route of contract.requiredRoutes) {
    const [method, pathname] = route.split(' ');
    if (!routesSource.includes(`method === '${method}'`) || !routesSource.includes(`pathname === '${pathname}'`)) {
      findings.push({ code: 'required-route-missing', route });
    }
  }

  if (!/experience:\s*\{\s*level:\s*'everyday'\s*\}/.test(appSource)) findings.push({ code: 'fresh-default-not-everyday' });
  if (!appSource.includes('createTrustAdoptionFoundation') || !adoptionFoundationSource.includes('new SettingsService') || !adoptionFoundationSource.includes('new UpdatePreparationService')) findings.push({ code: 'trust-adoption-foundation-boundary' });
  if (!switcherSource.includes('role="listbox"') || !levels.every((level) => switcherSource.includes(`'${level}'`) || switcherSource.includes('EXPERIENCE_LEVELS'))) {
    findings.push({ code: 'direct-switcher-contract' });
  }
  if (!transitionSource.includes('/api/personalization/preferences') || !transitionSource.includes('capture')) {
    findings.push({ code: 'experience-transition-persistence' });
  }
  if (/cloud\s*(?:or|vs\.?|versus|\/)\s*local|local\s*(?:or|vs\.?|versus|\/)\s*cloud|provider setup|api key/i.test(onboardingSource)) {
    findings.push({ code: 'onboarding-infrastructure-question' });
  }
  if (!profileSource.includes('SettingsService') && !profileSource.includes('settingsService')) findings.push({ code: 'personalization-not-settings-projection' });
  if (!updateCoordinatorSource.includes('initialDelayMinMs') || !updateCoordinatorSource.includes('intervalMs') || !updateCoordinatorSource.includes('/api/updates/check')) findings.push({ code: 'desktop-update-coordinator-contract' });
  for (const method of ['getUpdateState', 'checkForUpdates', 'downloadAvailableUpdate', 'deferUpdate', 'ignoreVersion', 'installUpdateAndRestart']) {
    if (!preloadSource.includes(`${method}: () => electron.ipcRenderer.invoke`)) findings.push({ code: 'unsafe-or-missing-update-preload-method', method });
  }
  const updateNoticeHasBoundedPreservation = updateNoticeSource.includes('only receipt-backed state is treated as preserved.')
    && updateNoticeSource.includes('detailed preservation claims remain bounded by available receipts.');
  const updateNoticeHasPlatformTruth = updateNoticeSource.includes('platformTruth')
    && updateNoticeSource.includes('handoffUnavailable')
    && updateNoticeSource.includes('packageUnsupported');
  if (!updateNoticeHasBoundedPreservation || !updateNoticeHasPlatformTruth || !updateNoticeSource.includes('Release evidence')) {
    findings.push({ code: 'progressive-update-notice-contract' });
  }
  if (!updateServiceSource.includes('streamDownloadToFile') || !updateServiceSource.includes('.partial') || !updateServiceSource.includes('handle.sync()')) findings.push({ code: 'streaming-update-staging-contract' });
  if (!snapshotSource.includes('os-vault-credentials') || !storeSource.includes('VACUUM INTO')) findings.push({ code: 'pre-update-snapshot-contract' });
  if (!installerSource.includes('/UPDATED') || !installerSource.includes('--updated') || !installerSource.includes('--post-update') || !desktopMainSource.includes('NOLANE_AGENT_POST_UPDATE')) findings.push({ code: 'post-update-relaunch-contract' });
  for (const forbidden of contract.forbiddenAuthorityPaths) {
    if (PERSONALIZATION_SETTING_PATHS.some((settingPath) => settingPath === forbidden || settingPath.startsWith(`${forbidden}.`))) {
      findings.push({ code: 'personalization-authority-path-exposed', path: forbidden });
    }
  }
  for (const excluded of contract.runtimeExcludedPaths) {
    if (PERSONALIZATION_RUNTIME_PATHS.some((settingPath) => settingPath === excluded || settingPath.startsWith(`${excluded}.`))) {
      findings.push({ code: 'personalization-runtime-path-exposed', path: excluded });
    }
  }
  if (/Native Runtime Conversion Wave 6/i.test(readme)) findings.push({ code: 'readme-stale-wave-identity' });
  if (/^#\s+Forge Studio/im.test(architecture)) findings.push({ code: 'architecture-stale-product-identity' });
  if (packageJson.scripts?.['verify:checkpoint-14-foundation'] !== 'node scripts/verify-checkpoint-14-foundation.mjs --write') {
    findings.push({ code: 'foundation-verifier-script-missing' });
  }

  const report = {
    schema: 'nolane.checkpoint-14.foundation.verification.v1',
    generatedAt: new Date().toISOString(),
    baselineCommit: contract.baselineCommit,
    deliverySlice: contract.deliverySlice,
    pass: findings.length === 0,
    retained: {
      experienceLevels: levels,
      globalDestinations: GLOBAL_DESTINATIONS.length,
      settingsCategories: settingsCatalog.categories.length,
      settingsFields,
      controlPlaneDomains: CONTROL_PLANE_DOMAINS.length,
      backendRoutes: BACKEND_ATLAS.total,
      backendDomains: BACKEND_ATLAS.domains.length
    },
    implemented: contract.implemented,
    externalOrLaterGates: contract.externalOrLaterGates,
    missingFiles,
    findings
  };
  report.receiptSha256 = stableReceipt(report);
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const report = verifyCheckpoint14Foundation();
  if (process.argv.includes('--write')) {
    const target = path.join(root, 'docs/checkpoints/checkpoint-14/FOUNDATION-VERIFICATION.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report));
  if (!report.pass) process.exitCode = 1;
}
