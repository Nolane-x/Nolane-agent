import { createHash } from 'node:crypto';
import { lstat, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const RECEIPT_NAME = '.nolane-data-migration.json';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function info(file) { try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
function pathsFor(homeDirectory) {
  const home = path.resolve(String(homeDirectory ?? os.homedir()));
  return { legacy: path.join(home, '.forge-studio'), canonical: path.join(home, '.nolane-agent') };
}
function receiptBase({ legacy, canonical }) {
  return { schema: 'nolane.agent.data-directory-migration.v1', operation: 'rename', legacy, canonical };
}

export async function migrateLegacyDataDirectory({ homeDirectory = os.homedir(), explicitDataDir = null } = {}) {
  if (explicitDataDir != null && String(explicitDataDir) !== '') return { status: 'explicit', dataDir: path.resolve(String(explicitDataDir)), receiptPath: null };
  const { legacy, canonical } = pathsFor(homeDirectory);
  const [legacyInfo, canonicalInfo] = await Promise.all([info(legacy), info(canonical)]);
  if (legacyInfo?.isSymbolicLink() || canonicalInfo?.isSymbolicLink()) throw new Error('Data directory migration refuses symbolic links');
  if (legacyInfo && !legacyInfo.isDirectory()) throw new Error('Legacy data path is not a directory');
  if (canonicalInfo && !canonicalInfo.isDirectory()) throw new Error('Canonical data path is not a directory');
  if (legacyInfo && canonicalInfo) throw new Error('Data directory migration conflict: both legacy and canonical directories exist');
  if (!legacyInfo) return { status: canonicalInfo ? 'canonical' : 'new', dataDir: canonical, receiptPath: null };

  await rename(legacy, canonical);
  const base = receiptBase({ legacy, canonical });
  const receipt = { ...base, receiptSha256: sha256(JSON.stringify(base)) };
  const receiptPath = path.join(canonical, RECEIPT_NAME);
  try { await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 }); }
  catch (error) { await rename(canonical, legacy).catch(() => {}); throw error; }
  return { status: 'migrated', dataDir: canonical, receiptPath };
}

export async function rollbackDataDirectoryMigration({ receiptPath } = {}) {
  const file = path.resolve(String(receiptPath ?? ''));
  const receipt = JSON.parse(await readFile(file, 'utf8'));
  const { receiptSha256, ...base } = receipt;
  if (base.schema !== 'nolane.agent.data-directory-migration.v1' || receiptSha256 !== sha256(JSON.stringify(base))) throw new Error('Data directory migration receipt is invalid');
  const canonical = path.resolve(String(base.canonical));
  const legacy = path.resolve(String(base.legacy));
  if (file !== path.join(canonical, RECEIPT_NAME)) throw new Error('Data directory migration receipt path is invalid');
  const [canonicalInfo, legacyInfo] = await Promise.all([stat(canonical).catch(() => null), stat(legacy).catch(() => null)]);
  if (!canonicalInfo?.isDirectory() || legacyInfo) throw new Error('Data directory migration cannot be rolled back safely');
  await rename(canonical, legacy);
  return { status: 'rolled-back', dataDir: legacy, receiptPath: path.join(legacy, RECEIPT_NAME) };
}
