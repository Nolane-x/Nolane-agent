#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const posix = (value) => value.replaceAll('\\', '/');
const canonicalText = (value) => value.replaceAll('\r\n', '\n');

async function filesUnder(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(root, full));
    else if (entry.isFile()) output.push(posix(path.relative(root, full)));
  }
  return output.sort();
}

function outputName(relative, source, sourceGraphDigest) {
  const parsed = path.posix.parse(relative);
  // Include the complete source graph in every fingerprint. Import specifiers
  // are rewritten after the initial mapping is created, so hashing only the
  // raw file would allow an entry module to keep the same URL while pointing
  // at a changed dependency. A graph digest makes browser/Electron caches
  // invalidate whenever any local UI module changes.
  return path.posix.join(parsed.dir, `${parsed.name}.${sha256(Buffer.concat([Buffer.isBuffer(source) ? source : Buffer.from(String(source)), Buffer.from(`\n${sourceGraphDigest}`)])).slice(0, 12)}${parsed.ext}`);
}

function rewriteSpecifier(fromRelative, specifier, mapping) {
  if (!specifier.startsWith('.')) {
    if (/^(https?:|data:|blob:|\/\/)/.test(specifier)) throw new Error(`Network or opaque asset is forbidden in UI v3: ${specifier}`);
    return specifier;
  }
  const target = posix(path.posix.normalize(path.posix.join(path.posix.dirname(fromRelative), specifier)));
  const mapped = mapping.get(target);
  if (!mapped) throw new Error(`UI v3 dependency is not in the local module graph: ${fromRelative} -> ${specifier}`);
  let next = posix(path.posix.relative(path.posix.dirname(mapping.get(fromRelative)), mapped));
  if (!next.startsWith('.')) next = `./${next}`;
  return next;
}

function rewrite(relative, text, mapping) {
  if (relative.endsWith('.mjs')) {
    return text.replace(/(\b(?:from\s*|import\s*\()\s*['"])([^'"]+)(['"]\)?)/g, (all, before, specifier, after) => `${before}${rewriteSpecifier(relative, specifier, mapping)}${after}`);
  }
  if (relative.endsWith('.css')) {
    return text.replace(/(@import\s+['"])([^'"]+)(['"]\s*;)/g, (all, before, specifier, after) => `${before}${rewriteSpecifier(relative, specifier, mapping)}${after}`);
  }
  if (relative.endsWith('.html')) {
    return text.replace(/((?:src|href)=['"])(\.\/[^'"]+)(['"])/g, (all, before, specifier, after) => `${before}${rewriteSpecifier(relative, specifier, mapping)}${after}`);
  }
  return text;
}

export async function buildUiV3({ sourceRoot = path.resolve('ui-v3'), outputRoot = path.resolve('ui-dist') } = {}) {
  const source = path.resolve(sourceRoot); const output = path.resolve(outputRoot);
  const relatives = await filesUnder(source);
  if (!relatives.includes('index.html') || !relatives.includes('app.mjs')) throw new Error('UI v3 requires index.html and app.mjs');
  const sources = new Map();
  for (const relative of relatives) sources.set(relative, await readFile(path.join(source, relative)));
  const sourceGraphDigest = sha256(relatives.map((relative) => `${relative}:${sha256(sources.get(relative))}`).join('\n'));
  const mapping = new Map(relatives.map((relative) => [relative, outputName(relative, sources.get(relative), sourceGraphDigest)]));
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  const files = {};
  for (const relative of relatives) {
    const raw = sources.get(relative);
    const textLike = /\.(?:mjs|css|html|svg|json)$/.test(relative);
    const content = textLike ? Buffer.from(canonicalText(rewrite(relative, raw.toString('utf8'), mapping))) : raw;
    const targetRelative = mapping.get(relative); const target = path.join(output, targetRelative);
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content);
    files[targetRelative] = Object.freeze({ path: targetRelative, bytes: content.length, sha256: sha256(content), source: relative });
  }
  // The HTTP server intentionally resolves `/` to `index.html`. Keep the
  // immutable hashed entry for receipts and caches, while publishing a stable
  // bootstrap document that references only hashed local assets.
  const hashedEntry = mapping.get('index.html');
  await writeFile(path.join(output, 'index.html'), await readFile(path.join(output, hashedEntry)));
  const base = {
    schema: 'nolane.agent.ui-manifest.v1', product: 'Nolane Agent', uiVersion: 3,
    entry: { html: hashedEntry, stableHtml: 'index.html', module: mapping.get('app.mjs'), stylesheet: mapping.get('styles/index.css') },
    modules: Object.fromEntries([...mapping].filter(([key]) => key.endsWith('.mjs'))), files,
  };
  const receiptSha256 = sha256(JSON.stringify(base));
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify({ ...base, receiptSha256 }, null, 2)}\n`);
  const releaseBase = { schema: 'nolane.ui.source-release.v1', manifestReceiptSha256: receiptSha256, sourceLocalVerified: true, externalCertification: false };
  const releaseReceiptSha256 = sha256(JSON.stringify(releaseBase));
  await writeFile(path.join(output, 'source-release.json'), `${JSON.stringify({ ...releaseBase, receiptSha256: releaseReceiptSha256 }, null, 2)}\n`);
  return Object.freeze({ outputRoot: output, files: Object.keys(files).length, receiptSha256, releaseReceiptSha256 });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) buildUiV3().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
