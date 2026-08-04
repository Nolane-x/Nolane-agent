import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
export const freeze = (value) => Object.freeze(value);
export const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const safeEqual = (left, right) => { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && timingSafeEqual(a, b); };
export async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error?.code === 'ENOENT') return fallback; throw error; } }
export async function atomicWriteJson(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); const temp = `${file}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`; await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); await fs.rename(temp, file); }
export const cleanPath = (value) => { const normalized = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) return null; return normalized; };
export const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) out[key] = /(?:secret|token|api[_-]?key|password|authorization|cookie)/i.test(key) ? '[REDACTED]' : redact(child);
  return out;
};
