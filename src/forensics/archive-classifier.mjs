import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.kts', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.sh', '.ps1', '.lua', '.sql', '.proto']);
const DOCUMENT_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc', '.pdf']);
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.wav', '.mp3', '.ogg', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.otf']);
const BINARY_EXTENSIONS = new Set(['.exe', '.dll', '.so', '.dylib', '.node', '.wasm', '.bin', '.class', '.jar', '.appimage', '.deb', '.rpm', '.msi']);
const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '.tar.xz', '.txz', '.7z', '.rar', '.vsix', '.whl'];

function segments(value) {
  return value.toLowerCase().replaceAll('\\', '/').split('/').filter(Boolean);
}

function hasSegment(parts, values) {
  return parts.some((part) => values.has(part));
}

export function classifyArchiveEntry({ path: entryPath, bytes = 0, magic = '', mode = null } = {}) {
  const normalized = String(entryPath ?? '').replaceAll('\\', '/');
  if (!normalized) return Object.freeze({ category: 'unknown', reason: 'missing-path' });
  const lower = normalized.toLowerCase();
  const parts = segments(lower);
  const ext = path.posix.extname(lower);
  const archiveMatch = ARCHIVE_EXTENSIONS.find((candidate) => lower.endsWith(candidate));
  if (archiveMatch) return Object.freeze({ category: 'nested-archive', reason: `archive-extension:${archiveMatch}` });
  if (hasSegment(parts, new Set(['test', 'tests', '__tests__', 'spec', 'specs', 'fixtures', 'testdata']))) return Object.freeze({ category: 'test', reason: 'test-path' });
  if (hasSegment(parts, new Set(['docs', 'doc', 'documentation'])) || DOCUMENT_EXTENSIONS.has(ext) || /^(?:readme|license|notice|copying)(?:\.|$)/i.test(path.posix.basename(lower))) return Object.freeze({ category: 'documentation', reason: DOCUMENT_EXTENSIONS.has(ext) ? `documentation-extension:${ext}` : 'documentation-path' });
  if (hasSegment(parts, new Set(['node_modules', 'vendor', 'third_party', 'third-party', 'site-packages', 'deps', 'dependencies']))) return Object.freeze({ category: 'vendor-dependency', reason: 'dependency-path' });
  if (hasSegment(parts, new Set(['dist', 'build', 'out', 'target', 'release', 'bin', 'obj', 'recovered-artifacts'])) || BINARY_EXTENSIONS.has(ext) || ['4d5a', '7f454c46', 'cffaedfe', 'feedfacf'].some((prefix) => String(magic).toLowerCase().startsWith(prefix))) return Object.freeze({ category: 'binary-build-output', reason: BINARY_EXTENSIONS.has(ext) ? `binary-extension:${ext}` : 'build-or-binary-path' });
  if (hasSegment(parts, new Set(['assets', 'asset', 'images', 'image', 'icons', 'public', 'media'])) || ASSET_EXTENSIONS.has(ext)) return Object.freeze({ category: 'asset', reason: ASSET_EXTENSIONS.has(ext) ? `asset-extension:${ext}` : 'asset-path' });
  if (hasSegment(parts, new Set(['requirements', 'generated', 'coverage', 'reports', 'report', 'data', 'datasets', '.cache'])) || /(?:manifest|ledger|inventory|measurement|verification|receipt)\.(?:json|jsonl|csv)$/i.test(lower)) return Object.freeze({ category: 'generated-data', reason: 'generated-or-evidence-path' });
  if (SOURCE_EXTENSIONS.has(ext) || hasSegment(parts, new Set(['src', 'app', 'apps', 'packages', 'lib', 'server', 'client', 'ui', 'ui-v3', 'scripts', 'launcher', 'native']))) return Object.freeze({ category: 'production-source', reason: SOURCE_EXTENSIONS.has(ext) ? `source-extension:${ext}` : 'source-path' });
  if (['.json', '.jsonl', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.xml', '.html', '.css', '.vsixmanifest'].includes(ext) || /^\.(?:gitignore|gitattributes|npmignore|dockerignore|editorconfig)$/.test(path.posix.basename(lower))) return Object.freeze({ category: 'production-source', reason: `runtime-config-or-markup:${ext}` });
  if (bytes === 0 && (mode === 'directory' || normalized.endsWith('/'))) return Object.freeze({ category: 'generated-data', reason: 'directory-entry' });
  return Object.freeze({ category: 'unknown', reason: 'no-classification-rule' });
}
