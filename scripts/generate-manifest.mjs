import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const packageMetadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = String(packageMetadata.version);
const isNolane = packageMetadata.name === 'nolane-agent';
const product = isNolane ? 'Nolane Agent' : 'Forge Studio';
const output = path.resolve(root, process.argv[3] ?? 'project-manifest.json');
const excluded = new Set(['.git', '.worktrees', '.cache', 'release', 'node_modules', 'data']);
const excludedVendorParts = new Set(['.git', 'node_modules', 'release', '.cache', 'coverage', '.forgeos-data', 'dist']);

function include(relative) {
  const normalized = relative.replaceAll('\\', '/');
  const first = normalized.split('/')[0];
  if (excluded.has(first)) return false;
  if (normalized.split('/').includes('__pycache__') || /\.py[co]$/i.test(normalized)) return false;
  if (normalized.split('/').includes('.forge-vscode-build.lock')) return false;
  if (!normalized.startsWith('vendor/')) return true;
  if (normalized === 'vendor/forge-os.manifest.json' || normalized === 'vendor/forge-os') return true;
  if (!normalized.startsWith('vendor/forge-os/')) return false;
  return !normalized.split('/').some((part) => excludedVendorParts.has(part));
}
async function walk(current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name); const relative = path.relative(root, absolute).replaceAll('\\', '/');
    if (!include(relative)) continue;
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile() && absolute !== output) files.push(absolute);
  }
  return files;
}
function mime(file) {
  const extension = path.extname(file).toLowerCase();
  return ({ '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.md': 'text/markdown', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.go': 'text/x-go', '.sh': 'text/x-shellscript', '.ps1': 'text/plain', '.txt': 'text/plain' })[extension] ?? 'application/octet-stream';
}
function description(relative) {
  if (relative.startsWith('src/')) return `${product} runtime source module`;
  if (relative.startsWith('tests/')) return 'Automated behavior and regression test';
  if (relative.startsWith('ui-v3/') || relative.startsWith('ui-dist/')) return 'Nolane Agent v3 renderer source or deterministic build output';
  if (relative.startsWith('ui/')) return 'Legacy dependency-free local workroom interface';
  if (relative.startsWith('launcher/')) return 'Native application launcher and signed-update supervisor source';
  if (relative.startsWith('native/')) return 'Native PTY or operating-system credential helper source';
  if (relative.startsWith('config/')) return 'Signed-update configuration example and operational documentation';
  if (relative.startsWith('scripts/')) return 'Build, bootstrap, smoke, or release utility';
  if (relative.startsWith('docs/')) return 'Architecture, operations, security, or research documentation';
  if (relative.startsWith('vendor/forge-os/')) return 'Vendored ForgeOS authority component';
  if (relative.startsWith('third_party/')) return 'Third-party license notice';
  return 'Project configuration, license, or release documentation';
}
const files = [];
for (const file of (await walk()).sort()) {
  const content = await readFile(file); const info = await stat(file); const relativePath = path.relative(root, file).replaceAll('\\', '/');
  files.push({ relativePath, fileName: path.basename(file), mimeType: mime(file), version, status: 'ready', description: description(relativePath), bytes: info.size, sha256: createHash('sha256').update(content).digest('hex') });
}
const manifest = { schema: isNolane ? 'nolane.agent.project-manifest.v1' : 'forge.studio.project-manifest.v1', product, version, generatedAt: new Date().toISOString(), files };
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ output, files: files.length }));
