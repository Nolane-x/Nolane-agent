import assert from 'node:assert/strict';
import test from 'node:test';
import { probeLanguageServerCommand } from '../src/repository/polyglot-intelligence-plane.mjs';

test('language-server probe falls back to --help when --version is unsupported', async () => {
  const calls = [];
  const result = await probeLanguageServerCommand('sourcekit-lsp', {
    runner: async (_command, args) => {
      calls.push(args);
      if (args[0] === '--version') {
        const error = new Error('Unknown option --version');
        error.code = 64;
        throw error;
      }
      return { stdout: 'OVERVIEW: Language Server Protocol implementation for Swift\n', stderr: '' };
    },
  });

  assert.deepEqual(calls, [['--version'], ['--help']]);
  assert.equal(result.available, true);
  assert.equal(result.probe, 'help');
  assert.equal(result.version, 'installed');
});

test('language-server probe reports not-installed without trying help', async () => {
  const calls = [];
  const result = await probeLanguageServerCommand('missing-lsp', {
    runner: async (_command, args) => {
      calls.push(args);
      const error = new Error('not found');
      error.code = 'ENOENT';
      throw error;
    },
  });

  assert.deepEqual(calls, [['--version']]);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'not-installed');
});
