import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
const SHA256 = /^[a-f0-9]{64}$/i;
function readJson(file) { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } }
export function resolveUiRoot({ appRoot, requestedVersion = process.env.NOLANE_AGENT_UI_VERSION ?? 'v3', production = process.env.NODE_ENV === 'production' } = {}) {
  const root = path.resolve(appRoot ?? process.cwd());
  const legacy = path.join(root, 'ui'); const modern = path.join(root, 'ui-dist');
  if (requestedVersion === 'v2') return Object.freeze({ root: legacy, version: 'v2', fallback: false, recoveryOverride: true });
  const manifestPath = path.join(modern, 'manifest.json'); const releasePath = path.join(modern, 'source-release.json');
  const manifest = readJson(manifestPath); const release = readJson(releasePath);
  const receiptValid = Boolean(manifest?.uiVersion === 3 && SHA256.test(manifest?.receiptSha256 ?? '') && release?.schema === 'nolane.ui.source-release.v1' && release?.sourceLocalVerified === true && SHA256.test(release?.receiptSha256 ?? '') && release?.manifestReceiptSha256 === manifest?.receiptSha256);
  if (receiptValid) return Object.freeze({ root: modern, version: 'v3', fallback: false, manifestReceiptSha256: manifest.receiptSha256, sourceReleaseReceiptSha256: release.receiptSha256 });
  const reason = !existsSync(manifestPath) || !existsSync(releasePath) ? 'ui-v3-build-or-receipt-missing' : 'ui-v3-release-receipt-invalid';
  if (production) throw new Error(`Nolane Agent UI v3 release receipt is invalid or missing at ${modern}: ${reason}`);
  if (!existsSync(legacy)) throw new Error(`Legacy UI is missing at ${legacy}`);
  return Object.freeze({ root: legacy, version: 'v2', fallback: true, reason });
}
