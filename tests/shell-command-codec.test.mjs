import test from 'node:test';
import assert from 'node:assert/strict';

import { ShellCommandCodec } from '../src/security/shell-command-codec.mjs';

test('validates bounded argv and rejects shell-control bytes', () => {
  const codec = new ShellCommandCodec({ platform: 'linux' });
  assert.deepEqual(codec.validateArgv({ command: '/usr/bin/node', args: ['script.mjs', '--flag=value'], env: { CI: '1' } }), {
    command: '/usr/bin/node', args: ['script.mjs', '--flag=value'], env: { CI: '1' },
  });
  assert.deepEqual(codec.validateArgv({ command: '/usr/bin/node', args: ['-e', ''], env: { EMPTY: '' } }), {
    command: '/usr/bin/node', args: ['-e', ''], env: { EMPTY: '' },
  });
  assert.throws(() => codec.validateArgv({ command: 'node\nrm', args: [] }), /newline/i);
  assert.throws(() => codec.validateArgv({ command: 'node', args: ['ok\0bad'] }), /NUL/i);
  assert.throws(() => codec.validateArgv({ command: 'node', args: Array.from({ length: 129 }, () => 'x') }), /128/);
  assert.throws(() => codec.validateArgv({ command: 'node', args: ['x'.repeat(8_193)] }), /8192/);
});

test('builds exact Bash, PowerShell, CMD, and WSL interactive argv without a free-form shell string', () => {
  const linux = new ShellCommandCodec({ platform: 'linux' });
  assert.deepEqual(linux.prepareInteractive({ kind: 'bash', executable: '/bin/bash', args: ['--noprofile'] }), {
    kind: 'bash', executable: '/bin/bash', args: ['--noprofile'], capability: 'available',
  });
  assert.deepEqual(linux.prepareInteractive({ kind: 'powershell', executable: '/usr/bin/pwsh', args: ['-NoLogo'] }), {
    kind: 'powershell', executable: '/usr/bin/pwsh', args: ['-NoLogo'], capability: 'available',
  });
  assert.throws(() => linux.prepareInteractive({ kind: 'cmd', executable: 'cmd.exe', args: [] }), /Windows/i);
  assert.throws(() => linux.prepareInteractive({ kind: 'wsl', executable: 'wsl.exe', args: [], distribution: 'Ubuntu' }), /Windows/i);

  const windows = new ShellCommandCodec({ platform: 'win32' });
  assert.deepEqual(windows.prepareInteractive({ kind: 'powershell', executable: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: ['-NoLogo'] }), {
    kind: 'powershell', executable: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: ['-NoLogo'], capability: 'available',
  });
  assert.deepEqual(windows.prepareInteractive({ kind: 'cmd', executable: 'C:\\Windows\\System32\\cmd.exe', args: ['/d'] }), {
    kind: 'cmd', executable: 'C:\\Windows\\System32\\cmd.exe', args: ['/d'], capability: 'available',
  });
  assert.deepEqual(windows.prepareInteractive({ kind: 'wsl', executable: 'C:\\Windows\\System32\\wsl.exe', distribution: 'Ubuntu-24.04', args: ['--noprofile'] }), {
    kind: 'wsl', executable: 'C:\\Windows\\System32\\wsl.exe', args: ['--distribution', 'Ubuntu-24.04', '--exec', 'bash', '--noprofile'], capability: 'available',
  });
  assert.throws(() => windows.prepareInteractive({ kind: 'wsl', executable: 'wsl.exe', distribution: '--evil', args: [] }), /distribution/i);
});

test('renders bounded audit previews with shell-specific quoting', () => {
  const codec = new ShellCommandCodec({ platform: 'linux' });
  assert.equal(codec.preview({ kind: 'bash', command: 'printf', args: ["a b", "x'y"] }), "printf 'a b' 'x'\\''y'");
  assert.equal(codec.preview({ kind: 'powershell', command: 'Write-Output', args: ["a b", "x'y"] }), "Write-Output 'a b' 'x''y'");
  assert.equal(codec.preview({ kind: 'cmd', command: 'echo', args: ['a b', 'x&y'] }), 'echo "a b" "x^&y"');
  assert.ok(codec.preview({ kind: 'bash', command: 'x'.repeat(500), args: [] }, { maxLength: 80 }).endsWith('…'));
});
