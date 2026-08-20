import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { PRODUCT_IDENTITY } from '../product-identity.mjs';

const REQUIRED_CATEGORIES = Object.freeze(['general','appearance','accessibility','notifications','shortcuts','personalization','permissions','terminal','git','browser','voice','memory','models','integrations','data','updates','diagnostics','research']);
const NON_CLAIMS = Object.freeze({
  providerRealCertified: false,
  windowsExternalCertified: false,
  screenReaderCertified: false,
  externalRepositoryGeneralization: false,
  comparativeSuperiorityCertified: false,
  completeNolaneNativeParityCertified: false,
});

async function source(root, relative, failures) {
  try { return await readFile(path.join(root, relative), 'utf8'); }
  catch { failures.push(`missing file: ${relative}`); return ''; }
}
function requirePattern(text, pattern, label, failures) { if (!pattern.test(text)) failures.push(label); }
async function requireFiles(root, files, failures) { for (const file of files) try { await access(path.join(root, file)); } catch { failures.push(`missing file: ${file}`); } }

export async function verifyCheckpoint10UxFoundation({ rootDirectory = process.cwd(), version = PRODUCT_IDENTITY.version } = {}) {
  const root = path.resolve(rootDirectory);
  const failures = [];
  const files = [
    'src/settings/settings-catalog.mjs','src/settings/settings-service.mjs','src/providers/model-profile-registry.mjs','src/providers/model-discovery-service.mjs','src/providers/model-capability-probe-service.mjs','src/providers/provider-connection-service.mjs','src/ui/ui-summary-service.mjs','src/ui/ux-foundation-runtime.mjs','src/server/routes.mjs','src/app.mjs','src/adoption/trust-adoption-foundation.mjs',
    'ui-v3/core/api-client.mjs','ui-v3/core/preference-runtime.mjs','ui-v3/core/layout-store.mjs','ui-v3/core/resizable-region.mjs','ui-v3/views/settings/settings-controller.mjs','ui-v3/views/settings/settings-view.mjs','ui-v3/views/settings/model-profiles-panel.mjs','ui-v3/views/summary/output-summary.mjs','ui-v3/shell/app-shell.mjs','ui-v3/styles/pages/settings.css','ui-v3/styles/components/output-summary.css','ui-v3/styles/responsive.css',
    'tests/settings-catalog.test.mjs','tests/settings-http-api.test.mjs','tests/model-profile-registry.test.mjs','tests/model-discovery-service.test.mjs','tests/model-capability-probe-service.test.mjs','tests/model-profile-http-api.test.mjs','tests/ui-summary-service.test.mjs','tests/ui-summary-http-api.test.mjs','tests/ui-v3-settings-wiring.test.mjs','tests/ui-v3-model-profiles.test.mjs','tests/ui-v3-output-summary-wiring.test.mjs','tests/ui-v3-resizable-shell.test.mjs','tests/ui-v3-responsive-completion.test.mjs',
  ];
  await requireFiles(root, files, failures);
  const [catalogSource, settingsService, profileRegistry, discovery, probes, providerConnections, summaryService, uxRuntime, routes, app, adoptionFoundation, uiApp, settingsController, settingsView, modelPanel, outputSummary, shell, resizer, layout, responsive, packageJsonText] = await Promise.all([
    'src/settings/settings-catalog.mjs','src/settings/settings-service.mjs','src/providers/model-profile-registry.mjs','src/providers/model-discovery-service.mjs','src/providers/model-capability-probe-service.mjs','src/providers/provider-connection-service.mjs','src/ui/ui-summary-service.mjs','src/ui/ux-foundation-runtime.mjs','src/server/routes.mjs','src/app.mjs','src/adoption/trust-adoption-foundation.mjs','ui-v3/app.mjs','ui-v3/views/settings/settings-controller.mjs','ui-v3/views/settings/settings-view.mjs','ui-v3/views/settings/model-profiles-panel.mjs','ui-v3/views/summary/output-summary.mjs','ui-v3/shell/app-shell.mjs','ui-v3/core/resizable-region.mjs','ui-v3/core/layout-store.mjs','ui-v3/styles/responsive.css','package.json',
  ].map((file) => source(root, file, failures)));

  let familyCatalog = null;
  try { familyCatalog = JSON.parse(await readFile(path.join(root, 'config/model-families.json'), 'utf8')); }
  catch { failures.push('model family catalog is invalid JSON'); }
  let packageJson = null;
  try { packageJson = JSON.parse(packageJsonText); } catch { failures.push('package.json is invalid JSON'); }

  for (const category of REQUIRED_CATEGORIES) requirePattern(catalogSource, new RegExp(`id:\\s*['\"]${category}['\"]`), `settings category missing: ${category}`, failures);
  requirePattern(catalogSource, /validateSettingsPatch/, 'settings catalog validator missing', failures);
  requirePattern(settingsService, /async reset\([\s\S]*atomicJson/, 'atomic settings reset missing', failures);
  requirePattern(routes, /GET[\s\S]*\/api\/settings\/catalog|pathname === '\/api\/settings\/catalog'/, 'settings catalog route missing', failures);
  requirePattern(routes, /\/api\/settings\/reset/, 'settings reset route missing', failures);
  requirePattern(app, /const settingsDefaults = \{[\s\S]*notifications:[\s\S]*shortcuts:[\s\S]*personalization:/, 'complete settings defaults not declared', failures);
  requirePattern(app, /createTrustAdoptionFoundation\(\{[\s\S]*settingsDefaults/, 'settings foundation is not production-wired', failures);
  requirePattern(adoptionFoundation, /new SettingsService\(\{[\s\S]*defaults:\s*settingsDefaults/, 'settings source of truth is not composed by the adoption foundation', failures);
  const settingsBackend = !failures.some((item) => /settings|category/.test(item));

  requirePattern(settingsController, /api\.get\('\/api\/settings\/catalog'\)/, 'settings UI does not load catalog', failures);
  requirePattern(settingsController, /api\.put\('\/api\/settings'/, 'settings UI does not persist changes', failures);
  requirePattern(settingsController, /setExperience[\s\S]*research/, 'two-level experience controller missing', failures);
  requirePattern(settingsView, /data-settings-layer/, 'settings scope selector missing', failures);
  requirePattern(settingsView, /role="status"/, 'settings live status missing', failures);
  requirePattern(uiApp, /view\.mount\?\.|view\.mount/, 'route lifecycle mount missing', failures);
  requirePattern(uiApp, /applyPreferences/, 'immediate preference application missing', failures);
  const settingsUi = !failures.some((item) => /settings UI|experience|scope selector|live status|preference|route lifecycle/.test(item));

  requirePattern(profileRegistry, /declared:[\s\S]*discovered:[\s\S]*probed:[\s\S]*observed:/, 'model profile evidence layers missing', failures);
  requirePattern(profileRegistry, /unknownCapabilities/, 'unknown model capability state missing', failures);
  requirePattern(discovery, /gemini-generate-content[\s\S]*ollama[\s\S]*\/models/, 'provider model discovery adapters missing', failures);
  requirePattern(probes, /text[\s\S]*tools[\s\S]*structuredOutput[\s\S]*streaming/, 'bounded capability probes missing', failures);
  requirePattern(providerConnections, /discoverModels[\s\S]*probeModel/, 'provider connection model intelligence wiring missing', failures);
  requirePattern(routes, /\/api\/model-profiles\/discover[\s\S]*\/api\/model-profiles\/probe/, 'model profile APIs missing', failures);
  requirePattern(modelPanel, /Discover models/, 'model discovery UI action missing', failures);
  requirePattern(modelPanel, /Probe/, 'model probe UI action missing', failures);
  requirePattern(modelPanel, /Routing diagnostics/, 'model routing diagnostics UI missing', failures);
  if (!familyCatalog || familyCatalog.schema !== 'nolane.model-families.v1' || !Array.isArray(familyCatalog.families) || familyCatalog.families.length < 10) failures.push('model family catalog is incomplete');
  if (familyCatalog && /(apiKey|password|secret|accessToken|refreshToken)/i.test(JSON.stringify(familyCatalog))) failures.push('model family catalog contains credential-shaped metadata');
  const modelProfiles = !failures.some((item) => /model profile|model family|capability probe|discovery adapters|model intelligence/.test(item));

  requirePattern(summaryService, /maxItems[\s\S]*maxText[\s\S]*stopProcess/, 'bounded summary backend or process control missing', failures);
  requirePattern(routes, /\/api\/ui\/summary/, 'summary API missing', failures);
  requirePattern(routes, /summaryStop[\s\S]*stopProcess/, 'summary stop route missing', failures);
  requirePattern(uxRuntime, /new ManagedProcessRegistry/, 'shared managed process registry composition missing', failures);
  requirePattern(app, /createUxFoundationRuntime/, 'UX foundation runtime is not production-wired', failures);
  requirePattern(app, /managedProcessRegistry:\s*managedProcesses/, 'shared managed process registry missing', failures);
  requirePattern(outputSummary, /Outputs[\s\S]*Background processes[\s\S]*Sources/, 'summary grouped UI missing', failures);
  requirePattern(outputSummary, /visibilitychange/, 'visibility-aware summary polling missing', failures);
  requirePattern(uiApp, /toggle-summary[\s\S]*data-stop-process/, 'global summary interaction wiring missing', failures);
  const outputSummaryCoverage = !failures.some((item) => /summary|managed process/.test(item));

  requirePattern(layout, /localStorage|storage[\s\S]*sidebarWidth[\s\S]*dockWidth[\s\S]*bottomHeight/, 'persistent layout store missing', failures);
  requirePattern(resizer, /pointerdown/, 'pointer resizer behavior missing', failures);
  requirePattern(resizer, /ArrowLeft/, 'keyboard arrow resize missing', failures);
  requirePattern(resizer, /Home[\s\S]*End/, 'keyboard min-max resize missing', failures);
  requirePattern(shell, /role="separator"[\s\S]*data-resize-region="sidebar"/, 'accessible shell separator missing', failures);
  requirePattern(`${uiApp}
${shell}`, /data-resize-region="dock"/, 'artifact dock resize handle missing', failures);
  const resizableShell = !failures.some((item) => /layout store|resizer|separator|resize handle/.test(item));

  requirePattern(responsive, /@media\s*\(max-height:/, 'short-height responsive policy missing', failures);
  requirePattern(responsive, /env\(safe-area-inset-/, 'safe-area support missing', failures);
  requirePattern(responsive, /forced-colors:\s*active/, 'forced-colors support missing', failures);
  requirePattern(responsive, /settings-nav[\s\S]*output-summary/, 'responsive settings and summary support missing', failures);
  requirePattern(responsive, /overflow-x:\s*hidden/, 'horizontal overflow containment missing', failures);
  const responsiveAccessibility = !failures.some((item) => /responsive|safe-area|forced-colors|overflow/.test(item));

  if (packageJson?.version !== String(version)) failures.push(`version mismatch: expected ${version}`);
  if (!packageJson?.scripts?.['verify:checkpoint-10-ux-foundation']) failures.push('package verifier script missing');

  const coverage = Object.freeze({ settingsBackend, settingsUi, modelProfiles, outputSummary: outputSummaryCoverage, resizableShell, responsiveAccessibility });
  for (const [key, value] of Object.entries(coverage)) if (!value && !failures.some((item) => item === `${key} coverage failed`)) failures.push(`${key} coverage failed`);
  const base = {
    schema: 'nolane.checkpoint-10-ux-foundation.verification.v1', product: 'Nolane Agent', version: String(version),
    status: failures.length ? 'fail' : 'pass', coverage, familyCount: familyCatalog?.families?.length ?? 0,
    settingsCategoryCount: REQUIRED_CATEGORIES.length, claims: NON_CLAIMS, failures: Object.freeze([...new Set(failures)]),
  };
  return Object.freeze({ ...base, receiptSha256: canonicalSha256(base) });
}
