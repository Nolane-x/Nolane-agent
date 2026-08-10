#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'scripts', 'localized-readmes-v06');
const THIS_FILE = fileURLToPath(import.meta.url);

export const locales = ['ar','cn','de','es','fa','fr','he','hi','id','it','ja','ko','nl','pl','pt-br','ru','sv','th','tr','tw','uk'];

export function renderLocalizedReadme(locale, content) {
  if (locale !== 'vn') {
    return content
      .replace(/(<h1 align="center">ForgeOS<\/h1>\r?\n)<p align="center"><strong>[^<]*<\/strong><\/p>\r?\n/u, '$1')
      .replace('alt="ForgeOS v0.6 — Deterministic Skill Intelligence OS"', 'alt="ForgeOS v0.6"')
      .replace('alt="MIT License"', 'alt="MIT"')
      .replace('alt="128 kernel techniques"', 'alt="128"')
      .replace('alt="60 MCP tools"', 'alt="MCP 60"')
      .replace('alt="388 of 388 tests passing"', 'alt="388/388"');
  }

  return content;
}

export async function generateLocalizedReadmes() {
  for (const locale of locales) {
    const template = await readFile(path.join(SOURCE, `README-${locale}.md.txt`), 'utf8');
    const content = renderLocalizedReadme(locale, template);
    await writeFile(path.join(ROOT, `README-${locale}.md`), content);
  }

  console.log(`Generated ${locales.length} complete native-language README files for v0.6.1; README-vn.md remains its maintained native source.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  await generateLocalizedReadmes();
}
