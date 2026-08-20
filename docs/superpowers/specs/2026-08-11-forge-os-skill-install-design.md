# Forge OS Skill Installation Design

## Decision

Add a user-initiated, local-only installation path from the verified Forge OS catalogue into the user's Nolane Skill directory. It complements the existing read-only catalogue and mission attachment flow; it does not replace either.

## User outcome

From a Forge OS Skill preview, the user chooses **Add to my Skills**. Nolane creates one immutable local copy that is selectable for later missions. Its origin, MIT license, original hashes, source commit, and receipt remain visible.

## Boundary and safety model

- Accept only a currently discovered, hash-verified `forgeos:` ID.
- Require a labelled UI action and a POST body with `{ "confirmed": true }`; no GET mutates state.
- Write only under `<dataDir>/nolane-skills`, never the workspace or Forge OS vendor checkout.
- Copy only regular, non-symlink UTF-8 documentation/data: `SKILL.md`, `manifest.json`, and bounded `.md`, `.json`, `.txt`, `.yaml`, `.yml` under `sections/`, `references/`, and `evaluators/`.
- Never copy/execute `scripts/`, binary files, symlinks, arbitrary deep files, or capabilities. Installed sidecar sets `capabilities: []`.
- Use a staging directory inside the destination root then atomic rename. Existing destination returns `SKILL_ALREADY_INSTALLED`; this increment has no overwrite, update, or deletion action.
- Installation is content provenance, not entitlement. Existing selected-Skill hash verification and no-capability loading remains in force.

## Data model

`nolane-skill.json` keeps schema `nolane.agent.skill-provenance.v1` and adds an optional strict `import` record:

```json
{
  "schema": "nolane.agent.skill-provenance.v1",
  "sourceUrl": "https://github.com/Nolane-x/forge-os",
  "license": "MIT",
  "capabilities": [],
  "import": {
    "source": "forge-os",
    "sourceId": "writing-minimal-sufficient-code",
    "catalog": "v2",
    "contentSha256": "...",
    "manifestSha256": "...",
    "catalogSha256": "...",
    "sourceCommit": "...",
    "receiptSha256": "..."
  }
}
```

`NolaneSkillRegistry` surfaces `provenanceStatus: 'forge-os-imported'` and the import metadata, but keeps `source: 'nolane'` and `catalog: 'local'` so local loading behavior does not change or pretend the copy is a live upstream file.

## Components and flow

1. `ForgeOsSkillCatalog.readInstallBundle(id)` starts from the same record verified by `load`, enumerates only the allowlist, and returns immutable bytes plus provenance. No absolute path crosses the HTTP boundary.
2. `ForgeOsSkillInstaller.install(id)` validates that bundle, stages exact files plus sidecar, refuses collision, renames atomically, and returns an install receipt.
3. `NolaneNativeOrchestrationService.installForgeOsSkill(id)` is the only service façade and refreshes local discovery after success.
4. `POST /api/skills/catalog/:id/install` enforces confirmation and Forge OS source, maps typed errors, and returns `201`.
5. Skills UI exposes the action only for a Forge OS preview. It shows a busy/success/error state and reloads the catalogue when installation succeeds.

## Verification

Tests prove documentation/receipt preservation, scripts/symlinks/escapes exclusion, collision non-destruction, empty local capabilities, API confirmation enforcement, and UI source-only install affordance. Existing mission-selection tests remain the end-to-end proof that an installed Skill is not executable capability.

## Explicitly out of scope

Remote marketplace/repository import, automatic updates, bulk installs, deletion, bundled script execution, capability approval, account credentials, or Electron packaging. Each enlarges the supply-chain or authorization boundary and needs separate design.
