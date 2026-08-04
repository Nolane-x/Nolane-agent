import path from 'node:path';
import { readFile, lstat } from 'node:fs/promises';
import { canonicalSha256, deepFreeze } from './shared.mjs';
const IDS = new Set(['induction-a', 'induction-b', 'transfer-c']);
const PATHS = ['src/model.ts','src/barrel.ts','src/index.ts','src/direct.ts','src/alias.ts','src/namespace.ts'];
export async function loadCheckpoint10TypeScriptPack({ root = process.cwd(), id } = {}) {
  if (!IDS.has(id)) throw new Error(`Unknown Checkpoint 10 TypeScript pack: ${id}`);
  const rootPath = `fixtures/checkpoint-10-typescript/${id}`;
  const sourceFiles = [];
  for (const filePath of PATHS) {
    const absolute = path.join(root, rootPath, filePath); const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Checkpoint 10 fixture must be a regular file: ${filePath}`);
    const source = await readFile(absolute, 'utf8'); sourceFiles.push({ path: filePath, sha256: canonicalSha256(source) });
  }
  const base = { schema:'nolane.small-model.checkpoint-10-typescript-pack.v1', repositoryId:`checkpoint-10-typescript-${id}`, role:id.startsWith('induction')?'induction':'held-out-transfer', runtime:'typescript-5.8.3', language:'typescript', rootPath, sourceFiles, mutation:{from:'CanonicalPayload',to:'LegacyPayload',targetPath:'src/model.ts'}, repair:{from:'LegacyPayload',to:'CanonicalPayload',targetPath:'src/model.ts'}, hiddenChainOfThoughtStored:false };
  return deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
}
