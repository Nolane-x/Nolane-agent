# README fact synchronization design

## Goal

Publish a coherent ForgeOS v0.6.1 reader surface: the English README, the
Vietnamese README, and every generated localized README must describe the
current verified catalog and the same trust boundaries.

## Scope

- Correct the stale public facts: 60 schema-strict MCP tools, 250 skills
  (146 core and 104 domain), 1,299 built-in mappings, and 242 candidate
  procedural providers.
- Add a concise, factual universal-lanes entry point that links to
  `docs/UNIVERSAL-LANES.md`; include the fail-closed remote microVM boundary
  and the human-approval boundary for physical-world work.
- Update the 21 localized README source templates and regenerate their root
  `README-<locale>.md` outputs. `README-vn.md` remains its maintained native
  document.
- Make generated README alt text derive from the current 60-tool wording.
- Add regression coverage for stale metrics and generated/template parity.

## Non-goals

- No new languages, source-code localization, API change, hardware control,
  production certification, or claim that an external microVM provider is
  deployed.
- No assertion that candidate skills are stable, certified, or automatically
  enabled.

## Design

`README.md` and `README-vn.md` are the detailed primary documents. Each gets
the corrected inventory, a short universal-lanes section, and links to the
trust-boundary documentation. The localized documents retain their existing
native prose; their templates receive only the equivalent factual inventory,
one concise universal-lanes/trust-boundary paragraph, and corrected MCP badge
and architecture counts. The generator remains the only writer of non-Vietnamese
localized README outputs.

The verification test reads every generated README and each source template.
It rejects obsolete inventory tokens, checks the expected current values and
universal-lanes link, and regenerates the locale outputs to prove that the
checked-in files match their templates. Documentation lint provides link and
Markdown structural checks.

## Acceptance criteria

1. The English and Vietnamese README contain the current inventory and truthful
   universal-lane and microVM boundaries.
2. All 21 localized source templates and generated README outputs use the
   current MCP and mapping facts, and include the universal-lanes entry point.
3. No public README still presents `58` MCP tools, `1,291` mappings, or `234`
   candidate providers as current inventory.
4. The localization regression test, documentation lint, and full test suite
   pass after generation; the committed tree is clean.
