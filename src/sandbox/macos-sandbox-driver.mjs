import { execFile } from 'node:child_process';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
function defaultRunner(command, args, options = {}) { return execFileAsync(command, args, { windowsHide: true, timeout: options.timeoutMs ?? 10_000, maxBuffer: options.maxOutputBytes ?? 128_000 }); }
function coded(code, message, statusCode = 400) { return Object.assign(new Error(message), { code, statusCode }); }
function safeId(value) { const text = String(value ?? '').trim(); if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(text)) throw new TypeError('Invalid macOS sandbox id'); return text; }
function commandArgv(value) { if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || item.includes('\0'))) throw new TypeError('command must be a non-empty string array'); return value.slice(0, 128); }
function quoteProfile(value) { return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`; }

export class MacOsSandboxDriver {
  constructor({ platform = process.platform, executable = '/usr/bin/sandbox-exec', profileRoot = path.join(os.tmpdir(), 'forge-studio-sandbox-profiles'), runner = defaultRunner } = {}) { this.platform = platform; this.executable = executable; this.profileRoot = path.resolve(profileRoot); this.runner = runner; }
  async capabilities() {
    if (this.platform !== 'darwin') return Object.freeze({ schema: 'forge.macos-sandbox-capabilities.v1', available: false, platform: this.platform, externalOsRuntime: true, reason: 'wrong-platform' });
    try { await this.runner(this.executable, ['-h'], { timeoutMs: 5_000, maxOutputBytes: 64_000 }); return Object.freeze({ schema: 'forge.macos-sandbox-capabilities.v1', available: true, platform: this.platform, executable: this.executable, externalOsRuntime: true }); }
    catch (error) { return Object.freeze({ schema: 'forge.macos-sandbox-capabilities.v1', available: false, platform: this.platform, executable: this.executable, externalOsRuntime: true, reason: error?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' }); }
  }
  async prepare({ id, workspaceRoot, command, allowNetwork = false } = {}) {
    const sandboxId = safeId(id); const capability = await this.capabilities(); if (!capability.available) throw coded('MACOS_SANDBOX_UNAVAILABLE', `macOS sandbox runtime unavailable: ${capability.reason}`, 503);
    const workspace = await realpath(path.resolve(String(workspaceRoot ?? ''))); const argv = commandArgv(command);
    const profile = [
      '(version 1)', '(deny default)', '(allow process*)', '(allow sysctl-read)', '(allow file-read*)',
      `(allow file-write* (subpath ${quoteProfile(workspace)}))`,
      allowNetwork ? '(allow network*)' : '(deny network*)',
    ].join('\n') + '\n';
    await mkdir(this.profileRoot, { recursive: true, mode: 0o700 });
    const profilePath = path.join(this.profileRoot, `${sandboxId}.sb`); await writeFile(profilePath, profile, { mode: 0o600 });
    return Object.freeze({ schema: 'forge.macos-sandbox-command.v1', id: sandboxId, workspaceRoot: workspace, profilePath, profile, command: this.executable, args: Object.freeze(['-f', profilePath, '--', ...argv]), network: allowNetwork ? 'allow' : 'deny' });
  }
}
