import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

export function finite(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
export function unit(value, fallback = 0) { return Math.max(0, Math.min(1, finite(value, fallback))); }
export function text(value, name = 'value', max = 512) { const out = String(value ?? '').trim(); if (!out) throw new TypeError(`${name} is required`); return out.slice(0, max); }
export function sha(value, name = 'sha256') { const out = text(value, name, 64); if (!/^[a-f0-9]{64}$/i.test(out)) throw new TypeError(`${name} must be sha256`); return out.toLowerCase(); }
export function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
export function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
export function boundedArray(value, max = 64) { return Array.isArray(value) ? value.slice(0, max) : []; }
