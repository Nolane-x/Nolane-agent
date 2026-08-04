# Provider Selection and Codex App Server Compatibility Design

Date: 2026-08-04
Status: approved design; implementation pending written-spec review

## Goal

Make mission submission use the actual provider identifier for every built-in
CLI provider and make the Codex App Server adapter compatible with the
installed Codex CLI sandbox schema.

## Scope

The change covers the home composer selection path and the Codex App Server
thread-start path. It applies uniformly to `codex`, `claude`, `gemini`,
`opencode`, and `codex-app-server`. API model discovery and unrelated routing
behavior remain unchanged.

## Current failure

The model profile key is shaped like `codex/cli-selected`, while the planner
router accepts a provider ID such as `codex`. The home composer uses the model
profile key as `planningProviderId`, so the router looks up a provider that
does not exist and the HTTP layer reduces the resulting exception to
`internal-error`.

The Codex App Server methods have asymmetric sandbox wire shapes.
`thread/start.params.sandbox` is a string enum such as `read-only`, while
`turn/start.params.sandboxPolicy` is an object variant such as
`{ type: 'readOnly' }`. Sending the turn-policy object to `thread/start`
causes the installed Codex CLI to reject the thread before a turn can begin.

## Design

### Provider selection contract

The composer will use `providerId` as the submitted value for an explicit
provider choice. The visible label may continue to include the selected model
profile. The `auto` option remains `auto`. A small backend compatibility
normalizer will also accept a legacy model-profile key (`provider/model`) and
resolve its provider prefix before router selection; malformed or unknown IDs
will retain the existing bounded failure behavior.

This keeps the UI contract semantically correct while preventing stale clients
from failing with an opaque 500. All built-in providers share the same path.

### Codex sandbox normalization

`CodexAppServerClient` will preserve the method-specific wire contracts at
the adapter boundary. `startThread` sends `sandbox: 'read-only'`, including
when an existing caller supplies `{ type: 'readOnly' }` or
`{ type: 'read-only' }`. `startTurn` separately sends
`sandboxPolicy: { type: 'readOnly' }`. `openSession` and `complete` use these
same normalized defaults so thread and turn calls cannot diverge.

### Error and safety boundaries

No credentials or provider response bodies are exposed. The provider resolver
will never infer a provider from arbitrary text; it only accepts a registered
provider ID or a well-formed model key whose prefix is a registered provider.
The App Server continues to use the existing read-only sandbox and declined
approval handler.

## Testing

1. Add a failing home-composer test proving every built-in provider option
   submits its provider ID rather than `provider/model`.
2. Add a failing planner/router compatibility test proving a legacy model key
   resolves to its registered provider and an unknown key fails clearly.
3. Add a failing Codex App Server fixture test proving all thread-start paths
   send `sandbox: 'read-only'`, including an old `readOnly` caller input, and
   all turn-start paths send `sandboxPolicy: { type: 'readOnly' }`.
4. Run the focused tests, the relevant HTTP/provider suites, and a real
   read-only Codex CLI/App Server smoke check where the local installation is
   available. Missing optional CLIs are reported as unavailable, not passed.

## Non-goals

- Adding new providers or API credentials.
- Changing model discovery or API adapter wire formats.
- Allowing a mission to run without a selected project.
- Reworking the broader routing policy or UI styling.
