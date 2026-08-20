import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { authenticatedSourceUiUrl, sourceBrowserDataDirectory } from '../src/development/source-browser-launcher.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'nolane-source-browser-'));
const runtimeFile = path.join(root, 'runtime.json');
const routeIndex = process.argv.indexOf('--route');
const route = routeIndex >= 0 ? process.argv[routeIndex + 1] : '/';
const noOpen = process.argv.includes('--no-open');
const dataDirectory = sourceBrowserDataDirectory({ temporaryRoot: root });
let child = null;
let closing = false;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function redact(value) {
  return String(value ?? '').replace(/((?:token|secret|password|credential|api[-_]?key|authorization)[=:])[^\s&]+/gi, '$1[redacted]');
}

function openDefaultBrowser(url) {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const opener = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  opener.unref();
}

async function waitForRuntime(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try { return JSON.parse(await readFile(runtimeFile, 'utf8')); }
    catch (error) { lastError = error; }
    if (child?.exitCode != null) throw new Error(`Source runtime exited before authenticated browser handoff (${child.exitCode})`);
    await sleep(50);
  }
  throw new Error(`Source runtime did not produce an authenticated handoff within ${timeoutMs}ms: ${lastError?.code ?? 'unknown error'}`);
}

async function close(signal = 'SIGTERM') {
  if (closing) return;
  closing = true;
  if (child?.exitCode == null) child.kill(signal);
  if (child?.exitCode == null) await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(5_000)]);
  await rm(root, { recursive: true, force: true });
}

process.once('SIGINT', () => { close('SIGINT').finally(() => process.exit(0)); });
process.once('SIGTERM', () => { close('SIGTERM').finally(() => process.exit(0)); });

try {
  child = spawn(process.execPath, [path.join(process.cwd(), 'src', 'app.mjs')], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      NOLANE_AGENT_HOST: '127.0.0.1',
      NOLANE_AGENT_PORT: '0',
      NOLANE_AGENT_RUNTIME_FILE: runtimeFile,
      NOLANE_AGENT_DATA_DIR: dataDirectory,
    },
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  const runtime = await waitForRuntime();
  const destination = authenticatedSourceUiUrl({ runtimeUrl: runtime.url, token: runtime.token, route });
  if (!noOpen) openDefaultBrowser(destination);
  console.log(JSON.stringify({ status: 'ready', url: runtime.url, browserOpened: !noOpen, authentication: 'one-time fragment bootstrap' }));
  await new Promise((resolve) => child.once('exit', resolve));
  if (!closing && child.exitCode !== 0) throw new Error(`Source runtime exited unexpectedly: ${redact(stderr)}`);
} finally {
  await close();
}
