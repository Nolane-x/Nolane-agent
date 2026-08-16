import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parsed = JSON.parse(readFileSync(path.join(root, 'config', 'product-identity.json'), 'utf8'));
if (parsed.schema !== 'nolane.agent.product-identity.v1') throw new Error('Nolane Agent product identity schema is invalid');
if (parsed.product !== 'Nolane Agent' || parsed.packageName !== 'nolane-agent') throw new Error('Nolane Agent canonical identity is invalid');
if (!/^0\.0\.\d+$/.test(parsed.version)) throw new Error('Nolane Agent 0.0.x version is invalid');
if (parsed.channel !== 'stable') throw new Error('Nolane Agent baseline channel must be stable');

export const PRODUCT_IDENTITY = Object.freeze({ ...parsed, legacyProductNames: Object.freeze([...(parsed.legacyProductNames ?? [])]), components: Object.freeze({ ...parsed.components }) });
export const canonicalEnvironmentName = (suffix) => `${PRODUCT_IDENTITY.environmentPrefix}${String(suffix).replace(/^_+/, '').toUpperCase()}`;
export const isLegacyProductName = (value) => PRODUCT_IDENTITY.legacyProductNames.some((item) => item.toLowerCase() === String(value).trim().toLowerCase());
