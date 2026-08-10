# Native localized READMEs design

## Goal

Replace the current partially localized README set with native-language product
documentation. Each localized README must read as prose written for its named
language, rather than a translated introduction followed by the English master
README.

## Scope

- Regenerate `README-*.md` for all 22 localized variants: Arabic, Simplified
  and Traditional Chinese, German, Spanish, Persian, French, Hebrew, Hindi,
  Indonesian, Italian, Japanese, Korean, Dutch, Polish, Brazilian Portuguese,
  Russian, Swedish, Thai, Turkish, Ukrainian, and Vietnamese.
- Keep `README.md` as the English source document.
- Keep product names, commands, source paths, URLs, protocol names, code blocks,
  and established technical abbreviations intact. All explanatory prose,
  headings, table labels, descriptions, and navigation labels must use the
  target language.
- Preserve factual claims, commands, links, version numbers, and stated product
  limits. Do not manufacture localized claims or expand the product scope.

## Design

The localized-README generator becomes the single source of truth. It will
contain complete native-language content for each supported locale, organized
around the same reader journey: overview, verified scope, quick start, how the
system works, components, team usage, verification, repository map, suitable
uses, non-goals, production limits, and contribution guidance.

The language selector remains in every README, but its labels are native to the
current document. A locale may retain an English product or technical proper
noun where translating it would make commands or standards ambiguous; it may
not retain an English explanatory sentence or a block of English narrative.

## Verification

1. Add a regression check that inspects every localized README and rejects the
   known English template paragraphs and headings.
2. Run the localized README generator twice and require no second-run diff.
3. Run the documentation-link validator and the localization regression check.
4. Perform a targeted manual review of each locale's headings, selector, and
   representative prose before publishing.

## Non-goals

- Translating source code, CLI output, JSON schemas, adapter protocol payloads,
  or the full documentation tree.
- Altering behavior, APIs, release version, or technical claims.
