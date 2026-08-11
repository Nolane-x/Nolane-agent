# Agent Skills supply-chain policy

Nolane Agent has a read-only Skill Hub. Discovery and preview make instructions visible to a user or agent; the hub does not execute bundled scripts, install dependencies, source shell files, or grant a capability merely because a package declares one.

## Supported sources

### Nolane local

User-owned local packages are discovered only below the configured Nolane data directory at `nolane-skills/<package>/`. A package may use either of these shapes:

```text
<package>/
  SKILL.md
  nolane-skill.json       # optional Nolane-only provenance sidecar
```

```text
<package>/
  skill.json              # legacy nolane.agent.skill.v1 manifest
  <declared entrypoint>
  nolane-skill.json       # optional Nolane-only provenance sidecar
```

`SKILL.md` follows the portable [Agent Skills specification](https://agentskills.io/specification): it begins with YAML frontmatter and has a lowercase kebab-case `name` plus a single-line `description`. Nolane deliberately supports only that bounded frontmatter subset; it rejects malformed, duplicate, multiline, or ambiguous values instead of attempting to interpret arbitrary YAML.

When present, `nolane-skill.json` is metadata only and must have this schema:

```json
{
  "schema": "nolane.agent.skill-provenance.v1",
  "sourceUrl": "https://example.invalid/skills/repo-review",
  "license": "MIT",
  "capabilities": ["repo:read"]
}
```

`sourceUrl` must be HTTPS; `license` is a short declared label; and every capability remains ungranted until the caller explicitly supplies it to the bounded load operation. Local records are labelled `source: nolane`, `catalog: local`, and `provenanceStatus: local-user-supplied`. A content hash is captured at discovery and a load fails if the file changes before it is read.

### Forge OS vendor catalog

Nolane exposes the existing [Forge OS](https://github.com/Nolane-x/forge-os) catalog separately as read-only `forge-os` records. Forge OS is MIT-licensed; its v2 and legacy entries keep their source URL, vendor manifest state, commit/tree metadata when available, license, and content hash. A vendor snapshot marked dirty is shown as `vendor-snapshot-dirty`, not represented as a verified upstream release.

Forge OS provides the broad starting library; local packages let each installation retain its own curated skills without modifying the vendor tree.

### External references

Public repositories can be studied for interoperability, but a repository with no explicit license is reference-only. Its skill content is unlicensed and not copied into Nolane, automatically imported, or presented as a Nolane package. Remote URLs are not fetched by the Skill Hub.

## Rejection and execution boundary

Discovery rejects symlinks, paths that escape the package directory, duplicate IDs, malformed `SKILL.md` frontmatter, malformed provenance sidecars, and invalid legacy manifests. Preview is a bounded text read (currently capped by the UI); it does not activate a skill.

Adding a skill to a future chat or mission must remain a separate, visible consent action with scoped capabilities and a recorded receipt. This policy intentionally does not turn a catalog entry into code execution.
