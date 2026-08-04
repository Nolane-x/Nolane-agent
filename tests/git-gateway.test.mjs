import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { GitGateway } from '../src/repository/git-gateway.mjs';
import { PullRequestProviders } from '../src/repository/pull-request-providers.mjs';
import { SecretScanner } from '../src/security/secret-scanner.mjs';

const exec = promisify(execFile);

async function git(root, args) {
  return exec('git', args, { cwd: root });
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-git-gateway-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'forge@example.test']);
  await git(root, ['config', 'user.name', 'Forge Test']);
  await writeFile(path.join(root, 'app.txt'), 'base\n');
  await git(root, ['add', 'app.txt']);
  await git(root, ['commit', '-m', 'initial']);
  const scanner = new SecretScanner();
  const approvals = [];
  const gateway = new GitGateway({
    repositoryRoot: root,
    secretScanner: scanner,
    approval: async (request) => { approvals.push(request); return { approved: true, id: `approval-${approvals.length}` }; },
  });
  return { root, gateway, scanner, approvals };
}

async function commitFile(root, file, content, message) {
  await writeFile(path.join(root, file), content);
  await git(root, ['add', file]);
  await git(root, ['commit', '-m', message]);
  return (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
}

test('SecretScanner reports fingerprints without returning plaintext secrets', () => {
  const scanner = new SecretScanner();
  const token = 'sk-proj-1234567890abcdefghijklmnop';
  const result = scanner.scanText(`OPENAI_API_KEY=${token}\nnormal=value\n`, { source: 'config.env' });
  assert.equal(result.blocked, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].source, 'config.env');
  assert.equal(result.findings[0].line, 1);
  assert.match(result.findings[0].fingerprint, /^[a-f0-9]{16}$/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(token));
  assert.match(result.redactedText, /\[REDACTED:openai_api_key\]/);
});

test('GitGateway binds mutations to expected HEAD and blocks staged secrets', async (t) => {
  const { root, gateway } = await fixture(t);
  const head = await gateway.head();
  await writeFile(path.join(root, 'app.txt'), 'changed\n');
  await assert.rejects(() => gateway.stage({ paths: ['app.txt'], expectedHead: '0'.repeat(40) }), (error) => error.code === 'GIT_HEAD_MISMATCH');
  const staged = await gateway.stage({ paths: ['app.txt'], expectedHead: head });
  assert.equal(staged.beforeHead, head);
  assert.deepEqual(staged.paths, ['app.txt']);

  await writeFile(path.join(root, 'secret.env'), 'token=ghp_1234567890abcdefghijklmnop\n');
  await assert.rejects(() => gateway.stage({ paths: ['secret.env'], expectedHead: head }), (error) => error.code === 'SECRET_SCAN_BLOCKED');
  const status = await gateway.status();
  assert.equal(status.entries.some((entry) => entry.path === 'secret.env' && entry.code === '??'), true);
});

test('GitGateway protects dirty worktrees and supports merge, rebase, cherry-pick, revert, reset and abort', async (t) => {
  const { root, gateway, approvals } = await fixture(t);
  const initial = await gateway.head();

  await gateway.createBranch({ name: 'feature', expectedHead: initial });
  const featureHead = await commitFile(root, 'feature.txt', 'feature\n', 'feature commit');
  await git(root, ['checkout', 'main']);
  await writeFile(path.join(root, 'dirty.txt'), 'dirty\n');
  await assert.rejects(() => gateway.merge({ ref: 'feature', expectedHead: initial }), (error) => error.code === 'GIT_DIRTY_WORKTREE');
  await rm(path.join(root, 'dirty.txt'));
  const merged = await gateway.merge({ ref: 'feature', expectedHead: initial });
  assert.notEqual(merged.afterHead, initial);
  assert.equal(approvals.at(-1).operation, 'merge');

  await gateway.createBranch({ name: 'topic', expectedHead: merged.afterHead });
  const topicHead = await commitFile(root, 'topic.txt', 'topic\n', 'topic commit');
  await git(root, ['checkout', 'main']);
  const cherry = await gateway.cherryPick({ commit: topicHead, expectedHead: merged.afterHead });
  assert.notEqual(cherry.afterHead, merged.afterHead);
  const reverted = await gateway.revert({ commit: cherry.afterHead, expectedHead: cherry.afterHead });
  assert.equal(await readFile(path.join(root, 'topic.txt'), 'utf8').then(() => true).catch(() => false), false);

  const reset = await gateway.reset({ mode: 'soft', ref: cherry.afterHead, expectedHead: reverted.afterHead });
  assert.equal(reset.afterHead, cherry.afterHead);
  await assert.rejects(() => gateway.reset({ mode: 'hard', ref: initial, expectedHead: reset.afterHead }), (error) => error.code === 'GIT_RESET_MODE_DENIED');

  await git(root, ['reset', '--hard', 'main']);
  await git(root, ['checkout', '-B', 'rebase-source', featureHead]);
  await commitFile(root, 'rebase.txt', 'rebased\n', 'rebase commit');
  const rebaseSourceHead = await gateway.head();
  const rebased = await gateway.rebase({ onto: 'main', expectedHead: rebaseSourceHead });
  assert.notEqual(rebased.afterHead, rebaseSourceHead);

  await git(root, ['checkout', 'main']);
  await git(root, ['checkout', '-b', 'conflict']);
  await writeFile(path.join(root, 'app.txt'), 'conflict branch\n');
  await git(root, ['add', 'app.txt']);
  await git(root, ['commit', '-m', 'conflict branch']);
  await git(root, ['checkout', 'main']);
  await writeFile(path.join(root, 'app.txt'), 'main branch\n');
  await git(root, ['add', 'app.txt']);
  await git(root, ['commit', '-m', 'main branch']);
  const conflictBase = await gateway.head();
  await assert.rejects(() => gateway.merge({ ref: 'conflict', expectedHead: conflictBase }), (error) => error.code === 'GIT_OPERATION_CONFLICT');
  const conflicts = await gateway.conflicts();
  assert.deepEqual(conflicts.paths, ['app.txt']);
  const aborted = await gateway.abort({ operation: 'merge' });
  assert.equal(aborted.operation, 'merge');
  assert.deepEqual((await gateway.conflicts()).paths, []);
});

test('GitGateway commit returns bounded content-addressed receipts and never shells commands', async (t) => {
  const { root, gateway } = await fixture(t);
  const head = await gateway.head();
  await writeFile(path.join(root, 'safe.txt'), 'safe\n');
  const committed = await gateway.commit({ message: 'feat: safe change', paths: ['safe.txt'], expectedHead: head });
  assert.notEqual(committed.afterHead, head);
  assert.match(committed.receiptSha256, /^[a-f0-9]{64}$/);
  assert.equal(committed.command, 'git');
  assert.deepEqual(committed.args.slice(0, 2), ['commit', '-m']);
  assert.equal(committed.shell, false);
  assert.ok(committed.stdout.length < 100_000);
});

test('PullRequestProviders builds typed GitHub, GitLab and Bitbucket requests without leaking credentials', async () => {
  const seen = [];
  const fetch = async (url, options) => {
    seen.push({ url, options });
    return { ok: true, status: 201, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ id: 7, html_url: 'https://example.test/pr/7', web_url: 'https://example.test/mr/7', links: { html: { href: 'https://example.test/pull/7' } } }) };
  };
  const tokens = { github: 'github-secret-token', gitlab: 'gitlab-secret-token', bitbucket: 'bitbucket-secret-token' };
  const providers = new PullRequestProviders({ fetch, credentialResolver: async ({ provider }) => tokens[provider] });

  const github = await providers.createPullRequest({ provider: 'github', baseUrl: 'https://api.github.test', owner: 'acme', repository: 'forge', sourceBranch: 'feature', targetBranch: 'main', title: 'Change', body: 'Body' });
  const gitlab = await providers.createPullRequest({ provider: 'gitlab', baseUrl: 'https://gitlab.test', project: 'acme/forge', sourceBranch: 'feature', targetBranch: 'main', title: 'Change', body: 'Body' });
  const bitbucket = await providers.createPullRequest({ provider: 'bitbucket', baseUrl: 'https://api.bitbucket.test', workspace: 'acme', repository: 'forge', sourceBranch: 'feature', targetBranch: 'main', title: 'Change', body: 'Body' });

  assert.equal(github.url, 'https://example.test/pr/7');
  assert.equal(gitlab.url, 'https://example.test/mr/7');
  assert.equal(bitbucket.url, 'https://example.test/pull/7');
  assert.equal(seen[0].url, 'https://api.github.test/repos/acme/forge/pulls');
  assert.equal(seen[1].url, 'https://gitlab.test/api/v4/projects/acme%2Fforge/merge_requests');
  assert.equal(seen[2].url, 'https://api.bitbucket.test/2.0/repositories/acme/forge/pullrequests');
  assert.equal(seen.every(({ options }) => options.method === 'POST'), true);
  const publicResults = JSON.stringify([github, gitlab, bitbucket]);
  for (const token of Object.values(tokens)) assert.doesNotMatch(publicResults, new RegExp(token));
});
