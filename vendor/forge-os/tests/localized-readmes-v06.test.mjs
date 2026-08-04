import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLocalizedReadme } from '../scripts/generate-localized-readmes-v06.mjs';

const locales = ['ar','cn','de','es','fa','fr','he','hi','id','it','ja','ko','nl','pl','pt-br','ru','sv','th','tr','tw','uk','vn'];
const generatedLocales = locales.filter((locale) => locale !== 'vn');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = path.join(ROOT, 'scripts', 'localized-readmes-v06');
const inheritedEnglish = [
  'ForgeOS separates **outcomes, techniques, providers',
  'ForgeOS is not only a prompt collection.',
  'Release verification checks state and fencing invariants',
  'Contributions are evaluated by behavior, not persuasive prose.',
  'Skill Intelligence OS and Trust Control Plane for AI agents.',
  '<p align="center"><strong>Skill Intelligence OS',
  'confirmed intent or failed gate',
];

test('localized READMEs are substantive native documents without the English shared template', async () => {
  for (const locale of locales) {
    const text = await readFile(`README-${locale}.md`, 'utf8');
    assert.ok(text.length > 12_000, `${locale} README must remain complete`);
    assert.match(text, /\[[^\]]+\]\(LICENSE\)/u, `${locale} README must retain its LICENSE link`);
    assert.doesNotMatch(text, /\[\[FOS\d+\]\]/u, `${locale} README must not expose translation placeholders`);
    assert.doesNotMatch(text, /\[FOS\d+\]?/u, `${locale} README must not expose malformed translation placeholders`);
    assert.doesNotMatch(text, /\[[^\]\n]+\]\s+\([^\)\n]+\)/u, `${locale} README must retain Markdown link syntax`);
    assert.doesNotMatch(text, /\|\|[-: ]+\|/u, `${locale} README must retain Markdown table boundaries`);
    for (const phrase of inheritedEnglish) {
      assert.doesNotMatch(text, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});

test('localized README templates and outputs keep verified inventory and boundaries in sync', async () => {
  for (const locale of generatedLocales) {
    const template = await readFile(path.join(TEMPLATE_DIR, `README-${locale}.md.txt`), 'utf8');
    const output = await readFile(path.join(ROOT, `README-${locale}.md`), 'utf8');
    for (const text of [template, output]) {
      assert.doesNotMatch(text, /MCP-58_tools|tests-388%2F388|1[,.\s\u00A0\u202F]?291/u, `${locale} must not retain obsolete public inventory`);
      assert.match(text, /MCP-60_tools/u, `${locale} must declare 60 MCP tools`);
      assert.match(text, /tests-release--gated/u, `${locale} must use release-gated verification`);
      assert.match(text, /\b242\b/u, `${locale} must declare 242 candidate providers`);
      assert.match(text, /1[,.\s\u00A0\u202F]?299/u, `${locale} must declare 1,299 mappings`);
      assert.match(text, /UNIVERSAL-LANES\.md/u, `${locale} must link the universal lane registry`);
    }
    assert.equal(output, renderLocalizedReadme(locale, template), `${locale} output must equal rendered template`);
  }
});

test('primary English and Vietnamese READMEs keep current inventory and lane boundaries', async () => {
  const [english, vietnamese] = await Promise.all([
    readFile(path.join(ROOT, 'README.md'), 'utf8'),
    readFile(path.join(ROOT, 'README-vn.md'), 'utf8'),
  ]);
  assert.match(english, /242 candidates/u);
  assert.match(english, /UNIVERSAL-LANES\.md/u);
  assert.match(vietnamese, /1\.299/u);
  assert.match(vietnamese, /UNIVERSAL-LANES\.md/u);
});
