import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { RepositoryDiscoveryService } from '../src/repository/repository-discovery-service.mjs';

const execFileAsync = promisify(execFile);

async function put(root, relative, content) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-repository-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'package.json', JSON.stringify({
    name: 'discovery-fixture', private: true, packageManager: 'pnpm@9.0.0', workspaces: ['apps/*', 'packages/*'],
    main: 'src/server.mjs',
    scripts: { dev: 'vite --host 127.0.0.1', build: 'tsc -b && vite build', test: 'vitest run', lint: 'eslint .', format: 'prettier --check .', typecheck: 'tsc --noEmit', deploy: 'node scripts/deploy.mjs' },
    dependencies: { express: '^5.0.0', react: '^19.0.0', pg: '^8.0.0' },
    devDependencies: { vite: '^7.0.0', typescript: '^5.0.0', vitest: '^3.0.0', eslint: '^9.0.0', prettier: '^3.0.0' },
  }, null, 2));
  await put(root, 'pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - packages/*\n');
  await put(root, 'tsconfig.json', '{"compilerOptions":{"strict":true},"include":["src"]}\n');
  await put(root, 'vite.config.ts', 'import { defineConfig } from "vite";\nexport default defineConfig({});\n');
  await put(root, 'src/server.mjs', 'import express from "express";\nconst app=express();\napp.get("/api/health",(_req,res)=>res.json({ok:true}));\napp.listen(3000);\n');
  await put(root, 'src/generated/client.ts', '// generated file\nexport const generated = true;\n');
  await put(root, 'apps/web/src/main.tsx', 'import React from "react";\nexport function App(){return <main>Hello</main>}\n');
  await put(root, 'packages/core/src/index.ts', 'export const core = 1;\n');
  await put(root, '.github/workflows/ci.yml', 'name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm test\n');
  await put(root, 'Dockerfile', 'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node","src/server.mjs"]\n');
  await put(root, 'docker-compose.yml', 'services:\n  db:\n    image: postgres:17\n');
  await put(root, 'migrations/001_init.sql', 'CREATE TABLE users(id uuid primary key);\n');
  await put(root, '.env.example', 'DATABASE_URL=postgres://example\nPUBLIC_API_URL=http://localhost:3000\n');
  await put(root, 'AGENTS.md', '# Agent instructions\nRun pnpm test before commit.\n');
  await put(root, 'README.md', '# Fixture\nLayered architecture: API routes call services and repositories.\n');
  await put(root, '.env', 'SUPER_SECRET_TOKEN=do-not-read\n');
  await put(root, 'credentials.json', '{"token":"do-not-read"}\n');
  await execFileAsync('git', ['init'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await execFileAsync('git', ['add', '.'], { cwd: root });
  await execFileAsync('git', ['commit', '-m', 'fixture'], { cwd: root });
  await put(root, 'src/dirty.ts', 'export const dirty = true;\n');
  const project = { id: 'project-1', name: 'Fixture', workspaceRoot: root };
  const store = { getProject: (id) => id === project.id ? project : null };
  return { root, project, service: new RepositoryDiscoveryService({ version: '1.7.0', store, clock: () => '2026-07-29T08:00:00.000Z' }) };
}

test('RepositoryDiscoveryService detects repository architecture and tooling with evidence', async (t) => {
  const f = await fixture(t);
  const snapshot = await f.service.snapshot({ projectId: f.project.id, principalId: 'local-admin', refresh: true });
  assert.equal(snapshot.schema, 'forge.repository-discovery.v1');
  assert.equal(snapshot.version, '1.7.0');
  assert.equal(snapshot.projectId, f.project.id);
  assert.ok(snapshot.languages.some((item) => item.id === 'typescript'));
  assert.ok(snapshot.frameworks.some((item) => item.id === 'express'));
  assert.ok(snapshot.frameworks.some((item) => item.id === 'react'));
  assert.ok(snapshot.packageManagers.some((item) => item.id === 'pnpm'));
  assert.ok(snapshot.buildSystems.some((item) => item.id === 'vite'));
  assert.ok(snapshot.testRunners.some((item) => item.id === 'vitest'));
  assert.ok(snapshot.linters.some((item) => item.id === 'eslint'));
  assert.ok(snapshot.formatters.some((item) => item.id === 'prettier'));
  assert.ok(snapshot.typeCheckers.some((item) => item.id === 'typescript'));
  assert.equal(snapshot.monorepo.detected, true);
  assert.deepEqual(snapshot.monorepo.workspaces, ['apps/*', 'packages/*']);
  assert.ok(snapshot.entryPoints.some((item) => item.path === 'src/server.mjs'));
  assert.ok(snapshot.ci.workflows.some((item) => item.path === '.github/workflows/ci.yml'));
  assert.ok(snapshot.containers.files.some((item) => item.path === 'Dockerfile'));
  assert.ok(snapshot.migrations.some((item) => item.path === 'migrations/001_init.sql'));
  assert.ok(snapshot.databases.some((item) => item.id === 'postgresql'));
  assert.ok(snapshot.apiStyles.some((item) => item.id === 'rest'));
  assert.ok(snapshot.generatedPaths.includes('src/generated'));
  assert.equal(snapshot.commands.dev.command, 'vite --host 127.0.0.1');
  assert.equal(snapshot.commands.build.command, 'tsc -b && vite build');
  assert.equal(snapshot.commands.test.command, 'vitest run');
  assert.equal(snapshot.commands.deploy.command, 'node scripts/deploy.mjs');
  assert.deepEqual(snapshot.environmentVariables.map((item) => item.name), ['DATABASE_URL', 'PUBLIC_API_URL']);
  assert.ok(snapshot.agentDocumentation.some((item) => item.path === 'AGENTS.md'));
  assert.equal(snapshot.cleanliness.isGitRepository, true);
  assert.equal(snapshot.cleanliness.clean, false);
  assert.ok(snapshot.cleanliness.untrackedPaths.includes('src/dirty.ts'));
  assert.match(snapshot.receiptSha256, /^[a-f0-9]{64}$/);
  const evidence = snapshot.frameworks.find((item) => item.id === 'express').evidence[0];
  assert.equal(evidence.path, 'package.json');
  assert.ok(evidence.startLine >= 1);
  assert.ok(evidence.endLine >= evidence.startLine);
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(snapshot), /do-not-read|SUPER_SECRET_TOKEN|credentials\.json/);
  assert.doesNotMatch(JSON.stringify(snapshot), new RegExp(f.root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('RepositoryDiscoveryService leaves unsupported findings unknown and rejects unknown projects', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-repository-discovery-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await put(root, 'main.txt', 'plain text only\n');
  const project = { id: 'empty', workspaceRoot: root };
  const service = new RepositoryDiscoveryService({ version: '1.7.0', store: { getProject: (id) => id === 'empty' ? project : null } });
  const snapshot = await service.snapshot({ projectId: 'empty', principalId: 'owner' });
  assert.equal(snapshot.monorepo.detected, false);
  assert.equal(snapshot.commands.build.status, 'unknown');
  assert.equal(snapshot.databases.length, 0);
  assert.ok(snapshot.unknowns.includes('framework'));
  assert.ok(snapshot.unknowns.includes('test-runner'));
  await assert.rejects(() => service.snapshot({ projectId: 'missing', principalId: 'owner' }), /Unknown project/);
});
