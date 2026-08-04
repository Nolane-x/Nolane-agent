import crypto from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DOMAIN_DEFINITIONS = Object.freeze([
  ['agent-kernel', 'Agent lifecycle, goal completion, model/tool turns, cancellation and receipts'],
  ['prompt-context', 'Prompt assembly, context discovery, references, compression and cache boundaries'],
  ['provider-fabric', 'Model providers, credentials, aliases, fallback and usage accounting'],
  ['tool-execution', 'Tool schemas, dispatch, local/remote execution, PTY and environments'],
  ['repository-files', 'Repository, file, patch, search, checkpoint and rollback behavior'],
  ['browser-computer-use', 'Browser automation, computer use, snapshots, downloads and approvals'],
  ['sessions', 'Session persistence, lineage, search and profile isolation'],
  ['memory-learning', 'Memory, consolidation, learning, curator and journey behavior'],
  ['skills', 'Skill discovery, disclosure, grading, pruning and compatibility'],
  ['plugin-system', 'Plugin manifests, hooks, commands, providers and trust'],
  ['mcp', 'MCP stdio/HTTP lifecycle, filtering, sampling and credentials'],
  ['scheduler', 'Cron, intervals, durable jobs, retries and delivery'],
  ['multi-agent', 'Delegation, kanban, worker leases, blackboards and synthesis'],
  ['gateway-integrations', 'Gateway authorization, pairing, routing and messaging adapters'],
  ['acp-api', 'ACP, JSON-RPC, OpenAI-compatible API and streaming surfaces'],
  ['media-voice', 'Vision, images, video, speech-to-text and text-to-speech'],
  ['observability-operations', 'Logging, traces, diagnostics, health, deployment and recovery'],
  ['security', 'Secrets, permissions, redaction, egress, provenance and adversarial controls'],
  ['product-surfaces', 'CLI, TUI, desktop, web dashboard and onboarding'],
  ['configuration', 'Configuration, profiles, bootstrap and migration behavior'],
]);

const DOMAIN_SET = new Set(DOMAIN_DEFINITIONS.map(([id]) => id));
const SOURCE_EXTENSIONS = new Set(['.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.go', '.rs', '.c', '.cc', '.cpp', '.h', '.hpp', '.sh', '.ps1', '.bat']);
const CONFIG_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.nix']);
const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.mp3', '.wav', '.mp4', '.pdf']);

const TOP_LEVEL_DOMAIN = Object.freeze({
  agent: 'agent-kernel',
  providers: 'provider-fabric',
  tools: 'tool-execution',
  gateway: 'gateway-integrations',
  acp_adapter: 'acp-api',
  cron: 'scheduler',
  plugins: 'plugin-system',
  skills: 'skills',
  nolane_native_cli: 'product-surfaces',
  apps: 'product-surfaces',
  web: 'product-surfaces',
  'ui-tui': 'product-surfaces',
  tui_gateway: 'product-surfaces',
  native: 'tool-execution',
  scripts: 'observability-operations',
  docker: 'observability-operations',
  nix: 'observability-operations',
});

const TOP_LEVEL_FILES = Object.freeze({
  'run_agent.py': 'agent-kernel',
  'batch_runner.py': 'multi-agent',
  'mini_swe_runner.py': 'multi-agent',
  'trajectory_compressor.py': 'prompt-context',
  'model_tools.py': 'provider-fabric',
  'toolsets.py': 'tool-execution',
  'toolset_distributions.py': 'tool-execution',
  'mcp_serve.py': 'mcp',
  'nolane_native_state.py': 'sessions',
  'nolane_native_logging.py': 'observability-operations',
  'nolane_native_time.py': 'observability-operations',
  'nolane_native_bootstrap.py': 'configuration',
  'nolane_native_constants.py': 'configuration',
  'utils.py': 'observability-operations',
  'cli.py': 'product-surfaces',
  nolane_native: 'product-surfaces',
  'cli-config.yaml.example': 'configuration',
});

const TEST_DOMAIN_HINTS = Object.freeze({
  agent: 'agent-kernel',
  run_agent: 'agent-kernel',
  providers: 'provider-fabric',
  tools: 'tool-execution',
  computer_use: 'browser-computer-use',
  gateway: 'gateway-integrations',
  acp: 'acp-api',
  acp_adapter: 'acp-api',
  cron: 'scheduler',
  plugins: 'plugin-system',
  skills: 'skills',
  secret_sources: 'security',
  state: 'sessions',
  nolane_native_state: 'sessions',
  tui_gateway: 'product-surfaces',
  dashboard: 'product-surfaces',
  cli: 'product-surfaces',
  e2e: 'product-surfaces',
  integration: 'observability-operations',
  stress: 'observability-operations',
  docker: 'observability-operations',
  ci: 'observability-operations',
  scripts: 'observability-operations',
});

const EXCLUDED_PREFIXES = [
  '.git/', '.github/ISSUE_TEMPLATE/', '.github/pr-screenshots/', '.plans/',
  'contributors/', 'locales/', 'website/i18n/', 'website/static/',
  'optional-skills/', 'optional-mcps/', 'mcp-research-data/', 'datagen-config-examples/',
];

const MARKETING_PREFIXES = ['website/', 'docs/'];

const DEVELOPMENT_BUILD_FILES = new Set([
  '.hadolint.yaml', '.prettierrc', '.prettierignore',
  'eslint.config.shared.mjs', 'package-lock.json', 'pnpm-lock.yaml',
  'yarn.lock', 'uv.lock', 'flake.lock', 'cargo.lock',
  'package.json', 'pyproject.toml', 'setup.py', 'flake.nix', '.env.example',
  'docker-compose.yml', 'docker-compose.windows.yml', 'dockerfile', 'setup-nolane_native.sh',
]);

const DEVELOPMENT_BUILD_BASENAMES = [
  /^tsconfig(?:\.[^/]+)?\.json$/,
  /^vite\.config\.[cm]?[jt]s$/,
  /^vitest\.config\.[cm]?[jt]s$/,
  /^jest\.config\.[cm]?[jt]s$/,
  /^eslint\.config\.[cm]?[jt]s$/,
  /^rollup\.config\.[cm]?[jt]s$/,
  /^webpack\.config\.[cm]?[jt]s$/,
];

const RUNTIME_SCRIPT_PREFIXES = [
  'scripts/whatsapp-bridge/',
];

function isDevelopmentBuildInfrastructure(relativePath) {
  const lower = relativePath.toLowerCase();
  const basename = path.posix.basename(lower);
  if (DEVELOPMENT_BUILD_FILES.has(lower)) return true;
  if (lower.startsWith('.github/')) return true;
  if (lower.startsWith('ui-tui/packages/nolane_native-ink/') || lower.startsWith('ui-tui/scripts/')) return true;
  if (/(^|\/)dashboard\/dist\//.test(lower)) return true;
  if (/(^|\/)vendor\//.test(lower)) return true;
  if (lower.startsWith('nix/') || lower.startsWith('docker/')) return true;
  if (lower.startsWith('native/') && basename === 'build.sh') return true;
  if (DEVELOPMENT_BUILD_BASENAMES.some((pattern) => pattern.test(basename))) return true;
  if (lower.startsWith('scripts/') && !RUNTIME_SCRIPT_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  return false;
}

function normalizeRelative(input) {
  return String(input ?? '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function classifyKind(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower === 'license' || lower.endsWith('/license') || lower.endsWith('/license.md')) return 'license';
  if (lower.startsWith('tests/') || lower.startsWith('tests-js/') || /(^|\/)test_[^/]+\.py$/.test(lower) || /\.test\.[cm]?[jt]sx?$/.test(lower)) return 'test';
  const ext = path.posix.extname(lower);
  if (SOURCE_EXTENSIONS.has(ext) || path.posix.basename(lower) === 'nolane_native') return 'source';
  if (CONFIG_EXTENSIONS.has(ext) || lower.endsWith('.yaml.example') || lower === '.env.example') return 'config';
  if (ext === '.md' || ext === '.rst' || ext === '.txt') return 'doc';
  if (ASSET_EXTENSIONS.has(ext)) return 'asset';
  return 'data';
}

function pluginDomain(relativePath) {
  const second = relativePath.split('/')[1] ?? '';
  if (['memory', 'context_engine'].includes(second)) return second === 'memory' ? 'memory-learning' : 'prompt-context';
  if (['image_gen', 'video_gen', 'spotify', 'google_meet'].includes(second)) return 'media-voice';
  if (['security-guidance'].includes(second)) return 'security';
  if (['observability', 'disk-cleanup'].includes(second)) return 'observability-operations';
  if (['cron_providers'].includes(second)) return 'scheduler';
  if (['platforms', 'teams_pipeline'].includes(second)) return 'gateway-integrations';
  if (['model-providers'].includes(second)) return 'provider-fabric';
  if (['browser', 'web'].includes(second)) return 'browser-computer-use';
  if (['kanban'].includes(second)) return 'multi-agent';
  return 'plugin-system';
}

function toolsDomain(relativePath) {
  if (relativePath.startsWith('tools/computer_use/')) return 'browser-computer-use';
  if (/image|video|audio|speech|tts|stt|vision|neutts/i.test(relativePath)) return 'media-voice';
  if (/file|patch|repo|search|git/i.test(relativePath)) return 'repository-files';
  return 'tool-execution';
}

function agentDomain(relativePath) {
  if (/^agent\/lsp\//i.test(relativePath)) return 'repository-files';
  if (/^agent\/(?:moa_|subagent|delegate|worker|kanban|swarm)/i.test(relativePath)) return 'multi-agent';
  if (/^agent\/(?:copilot_acp_client|stream_single_writer|proxy_sources\/|transports\/)/i.test(relativePath)) return 'acp-api';
  if (/^agent\/(?:web_search_registry|browser_)/i.test(relativePath)) return 'browser-computer-use';
  if (/^agent\/secret_sources\//i.test(relativePath)) return 'security';
  if (/^agent\/(?:pet\/|i18n\.py$|display\.py$|onboarding\.py$|reactions\.py$|battery\.py$|markdown_tables\.py$)/i.test(relativePath)) return 'product-surfaces';
  if (/^agent\/(?:image_gen_(?:provider|registry)|image_routing|transcription_(?:provider|registry)|tts_(?:provider|registry)|video_gen_(?:provider|registry))\.py$/i.test(relativePath)) return 'media-voice';
  if (/^agent\/(?:account_usage|aux_accounting|billing_links|billing_usage|billing_view|credits_tracker|insights|subscription_view|trace_upload|usage_pricing)\.py$/i.test(relativePath)) return 'observability-operations';
  if (/^agent\/(?:tool_dispatch_helpers|tool_executor|tool_result_classification|shell_hooks)\.py$/i.test(relativePath)) return 'tool-execution';
  if (/^agent\/(?:file_safety|subdirectory_hints)\.py$/i.test(relativePath)) return 'repository-files';
  if (/^agent\/(?:credential_persistence|message_sanitization|ssl_guard|ssl_verify|tool_guardrails)\.py$/i.test(relativePath)) return 'security';
  if (/^agent\/(?:anthropic_adapter|azure_identity_adapter|backend_identity|bedrock_adapter|chat_completion_helpers|codex_responses_adapter|codex_runtime|credential_pool|credential_sources|gemini_native_adapter|gemini_schema|jiter_preload|lmstudio_reasoning|moonshot_schema|nous_rate_guard|plugin_llm|rate_limit_tracker|vertex_adapter)\.py$/i.test(relativePath)) return 'provider-fabric';
  if (/context|prompt|compress|cache/i.test(relativePath)) return 'prompt-context';
  if (/secret|permission|security|redact|auth/i.test(relativePath)) return 'security';
  if (/session|state/i.test(relativePath)) return 'sessions';
  if (/memory|learn|curator|journey|skill/i.test(relativePath)) return 'memory-learning';
  if (/subagent|delegate|worker|kanban|swarm/i.test(relativePath)) return 'multi-agent';
  if (/provider|model|inference/i.test(relativePath)) return 'provider-fabric';
  if (/transport|proxy|api|stream/i.test(relativePath)) return 'acp-api';
  return 'agent-kernel';
}

function surfaceDomain(relativePath) {
  if (/voice|audio|image|video|media/i.test(relativePath)) return 'media-voice';
  if (/update|bootstrap|installer|profile|settings|config/i.test(relativePath)) return 'configuration';
  if (/auth|oauth|secret|permission/i.test(relativePath)) return 'security';
  if (/gateway|remote|websocket/i.test(relativePath)) return 'gateway-integrations';
  if (/session|history|archive/i.test(relativePath)) return 'sessions';
  return 'product-surfaces';
}

function testDomain(relativePath) {
  const parts = relativePath.split('/');
  for (const part of parts.slice(1)) {
    if (TEST_DOMAIN_HINTS[part]) return TEST_DOMAIN_HINTS[part];
  }
  const joined = relativePath.toLowerCase();
  if (/memory|learn|curator|journey/.test(joined)) return 'memory-learning';
  if (/mcp/.test(joined)) return 'mcp';
  if (/browser|playwright|computer/.test(joined)) return 'browser-computer-use';
  if (/security|secret|redact|permission|auth/.test(joined)) return 'security';
  if (/session|state/.test(joined)) return 'sessions';
  if (/kanban|worker|subagent|swarm/.test(joined)) return 'multi-agent';
  if (/media|image|video|audio|voice|speech/.test(joined)) return 'media-voice';
  return 'observability-operations';
}

export function classifyNolaneNativePath(inputPath) {
  const relativePath = normalizeRelative(inputPath);
  const lower = relativePath.toLowerCase();
  const kind = classifyKind(relativePath);

  if (!relativePath || relativePath.endsWith('/')) {
    return { domain: null, kind: 'directory', core: false, reason: 'directory-entry' };
  }
  if (lower === 'license') {
    return { domain: 'provenance', kind: 'license', core: false, reason: 'retain-license-attribution' };
  }
  if (lower.startsWith('website/i18n/') || lower.startsWith('locales/')) {
    return { domain: 'product-surfaces', kind, core: false, reason: 'localized-marketing-or-doc' };
  }
  if (lower.startsWith('web/src/i18n/')) {
    return { domain: 'product-surfaces', kind, core: false, reason: 'localized-product-copy' };
  }
  if (lower.startsWith('skills/')) {
    return { domain: 'skills', kind, core: false, reason: 'bundled-skill-payload' };
  }
  if (isDevelopmentBuildInfrastructure(lower)) {
    return { domain: null, kind, core: false, reason: 'development-build-infrastructure' };
  }
  if (lower.startsWith('website/')) {
    return { domain: null, kind, core: false, reason: 'documentation-or-marketing' };
  }
  if (EXCLUDED_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return { domain: null, kind, core: false, reason: 'optional-generated-or-community-payload' };
  }
  if (MARKETING_PREFIXES.some((prefix) => lower.startsWith(prefix)) && kind !== 'source' && kind !== 'config') {
    return { domain: null, kind, core: false, reason: 'documentation-or-marketing' };
  }
  if (lower.startsWith('tests/') || lower.startsWith('tests-js/')) {
    return { domain: testDomain(lower), kind: 'test', core: true, reason: 'behavioral-test' };
  }
  if (lower.startsWith('plugins/')) {
    return { domain: pluginDomain(lower), kind, core: true, reason: 'plugin-runtime-source' };
  }
  if (lower.startsWith('tools/')) {
    return { domain: toolsDomain(lower), kind, core: true, reason: 'tool-runtime-source' };
  }
  if (lower.startsWith('agent/')) {
    return { domain: agentDomain(lower), kind, core: true, reason: 'agent-runtime-source' };
  }
  if (lower.startsWith('apps/') || lower.startsWith('web/') || lower.startsWith('ui-tui/') || lower.startsWith('tui_gateway/') || lower.startsWith('nolane_native_cli/')) {
    return { domain: surfaceDomain(lower), kind, core: true, reason: 'product-surface-source' };
  }
  if (lower.startsWith('gateway/')) {
    return { domain: /auth|security|pair|permission/.test(lower) ? 'security' : 'gateway-integrations', kind, core: true, reason: 'gateway-source' };
  }
  if (lower.startsWith('cron/')) return { domain: 'scheduler', kind, core: true, reason: 'scheduler-source' };
  if (lower.startsWith('acp_adapter/')) return { domain: 'acp-api', kind, core: true, reason: 'acp-source' };
  if (lower.startsWith('providers/')) return { domain: 'provider-fabric', kind, core: true, reason: 'provider-source' };
  if (lower.startsWith('native/')) return { domain: 'tool-execution', kind, core: true, reason: 'native-runtime-source' };
  if (lower.startsWith('scripts/whatsapp-bridge/')) return { domain: 'gateway-integrations', kind, core: true, reason: 'gateway-runtime-bridge' };
  if (lower.startsWith('docker/') || lower.startsWith('nix/')) return { domain: 'observability-operations', kind, core: true, reason: 'deployment-source' };
  if (TOP_LEVEL_FILES[lower]) return { domain: TOP_LEVEL_FILES[lower], kind, core: true, reason: `${TOP_LEVEL_FILES[lower]}-source` };
  const top = lower.split('/')[0];
  if (TOP_LEVEL_DOMAIN[top]) return { domain: TOP_LEVEL_DOMAIN[top], kind, core: true, reason: `${TOP_LEVEL_DOMAIN[top]}-source` };

  if (kind === 'doc' || kind === 'asset' || kind === 'data') {
    return { domain: null, kind, core: false, reason: 'non-runtime-document-or-asset' };
  }
  return { domain: null, kind, core: true, reason: 'unmapped' };
}

async function walkFiles(rootDirectory, excludeSet) {
  const files = [];
  async function visit(current, prefix = '') {
    const items = await readdir(current, { withFileTypes: true });
    items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      const relative = prefix ? `${prefix}/${item.name}` : item.name;
      if (excludeSet.has(relative)) continue;
      const absolute = path.join(current, item.name);
      if (item.isSymbolicLink()) {
        files.push({ path: relative, absolute, symbolicLink: true });
      } else if (item.isDirectory()) {
        await visit(absolute, relative);
      } else if (item.isFile()) {
        files.push({ path: relative, absolute, symbolicLink: false });
      }
    }
  }
  await visit(rootDirectory);
  return files;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function contractIdFor(entry) {
  const domain = entry.domain.toUpperCase().replaceAll('-', '_');
  return `NOLANE_NATIVE_${domain}_${sha256(entry.path).slice(0, 12).toUpperCase()}`;
}

export async function generateNolaneNativeCoreInventory({
  upstreamRoot,
  historicalLedgerPath = null,
  outputPath = null,
  sourceLabel = 'nolane_native-upstream-snapshot',
  excludeRelativePaths = [],
} = {}) {
  if (!upstreamRoot) throw new Error('upstreamRoot is required');
  const rootStats = await stat(upstreamRoot);
  if (!rootStats.isDirectory()) throw new Error('upstreamRoot must be a directory');
  const excludeSet = new Set(excludeRelativePaths.map(normalizeRelative));
  if (outputPath && path.dirname(outputPath) === path.resolve(upstreamRoot)) {
    excludeSet.add(path.basename(outputPath));
  }
  const historicalByPath = new Map();
  if (historicalLedgerPath) {
    const lines = (await readFile(historicalLedgerPath, 'utf8')).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const record = JSON.parse(line);
      if (!record.directory && record.source) historicalByPath.set(normalizeRelative(record.source), record);
    }
  }

  const walked = await walkFiles(upstreamRoot, excludeSet);
  const entries = [];
  let totalBytes = 0;
  for (const file of walked) {
    const classification = classifyNolaneNativePath(file.path);
    const bytes = file.symbolicLink ? 0 : (await stat(file.absolute)).size;
    const content = file.symbolicLink ? Buffer.from('SYMLINK') : await readFile(file.absolute);
    const contentSha256 = sha256(content);
    totalBytes += bytes;
    const historical = historicalByPath.get(file.path);
    entries.push({
      path: file.path,
      ...classification,
      bytes,
      sha256: contentSha256,
      historicalAction: historical?.action ?? null,
      historicalEntrySha256: historical?.sourceArchiveEntrySha256 ?? null,
    });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const treeSha256 = sha256(entries.map((entry) => `${entry.path}\0${entry.sha256}\0${entry.bytes}`).join('\n'));
  const unmappedCorePaths = entries.filter((entry) => entry.core && (!entry.domain || entry.reason === 'unmapped')).map((entry) => entry.path);
  const excludedPaths = entries.filter((entry) => !entry.core).map((entry) => ({ path: entry.path, reason: entry.reason, kind: entry.kind }));
  const domains = DOMAIN_DEFINITIONS.map(([id, description]) => {
    const selected = entries.filter((entry) => entry.core && entry.domain === id);
    return {
      id,
      description,
      entries: selected.length,
      sourceEntries: selected.filter((entry) => entry.kind === 'source' || entry.kind === 'config').length,
      testEntries: selected.filter((entry) => entry.kind === 'test').length,
      bytes: selected.reduce((sum, entry) => sum + entry.bytes, 0),
    };
  }).filter((domain) => domain.entries > 0);
  const contracts = entries
    .filter((entry) => entry.core && entry.domain && (entry.kind === 'source' || entry.kind === 'config'))
    .map((entry) => ({
      id: contractIdFor(entry),
      domain: entry.domain,
      behaviorSourcePath: entry.path,
      sourceSha256: entry.sha256,
      status: 'inventory_only',
    }));
  const withoutReceipt = {
    schemaVersion: 'nolane.nolane_native.core.inventory.v1',
    sourceSnapshot: { label: sourceLabel, treeSha256, fileCount: entries.length, bytes: totalBytes },
    entries,
    domains,
    contracts,
    unmappedCorePaths,
    excludedPaths,
    summary: {
      entries: entries.length,
      coreEntries: entries.filter((entry) => entry.core).length,
      excludedEntries: entries.filter((entry) => !entry.core).length,
      unmappedCorePaths: unmappedCorePaths.length,
      contractCandidates: contracts.length,
    },
  };
  const inventory = { ...withoutReceipt, receiptSha256: sha256(JSON.stringify(canonical(withoutReceipt))) };
  validateNolaneNativeCoreInventory(inventory);
  if (outputPath) await writeFile(outputPath, canonicalJson(inventory));
  return inventory;
}

export function rehydrateNolaneNativeCoreInventory(inventory) {
  if (!inventory || typeof inventory !== 'object') throw new TypeError('inventory is required');
  const { receiptSha256: _discardedReceipt, ...withoutReceipt } = inventory;
  const rehydrated = { ...withoutReceipt, receiptSha256: sha256(JSON.stringify(canonical(withoutReceipt))) };
  validateNolaneNativeCoreInventory(rehydrated);
  return rehydrated;
}

export function validateNolaneNativeCoreInventory(inventory) {
  if (!inventory || inventory.schemaVersion !== 'nolane.nolane_native.core.inventory.v1') throw new Error('invalid NolaneNative core inventory schema');
  if (!Array.isArray(inventory.entries) || !Array.isArray(inventory.domains) || !Array.isArray(inventory.contracts)) throw new Error('invalid NolaneNative core inventory collections');
  if (!inventory.sourceSnapshot || !/^[a-f0-9]{64}$/.test(inventory.sourceSnapshot.treeSha256 ?? '')) throw new Error('invalid NolaneNative source snapshot hash');
  if ((inventory.unmappedCorePaths ?? []).length > 0) throw new Error(`NolaneNative inventory contains unmapped core paths: ${inventory.unmappedCorePaths.join(', ')}`);
  for (const entry of inventory.entries) {
    if (entry.core && !DOMAIN_SET.has(entry.domain)) throw new Error(`unknown core domain for ${entry.path}`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw new Error(`invalid entry hash for ${entry.path}`);
  }
  const { receiptSha256, ...withoutReceipt } = inventory;
  const expected = sha256(JSON.stringify(canonical(withoutReceipt)));
  if (receiptSha256 !== expected) throw new Error('NolaneNative inventory receipt hash mismatch');
  return { status: 'pass', receiptSha256, coreEntries: inventory.summary.coreEntries, contracts: inventory.contracts.length };
}

export const NOLANE_NATIVE_CORE_DOMAINS = Object.freeze(DOMAIN_DEFINITIONS.map(([id]) => id));
