#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const version = String(packageJson.version ?? '');
const expectedTag = `v${version}`;
const tag = String(process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME || process.argv[2] || '');
const commit = String(process.env.GITHUB_SHA || process.argv[3] || '');
if (tag !== expectedTag) throw new Error(`Release tag ${tag || '<missing>'} does not match package.json version ${expectedTag}`);
if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('GITHUB_SHA must be a full 40-character commit hash');
process.stdout.write(`${JSON.stringify({ status: 'pass', version, tag, commit: commit.toLowerCase() })}\n`);
