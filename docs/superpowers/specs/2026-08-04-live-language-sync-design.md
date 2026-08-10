# Live language synchronization

## Problem

The onboarding and Settings views update their own content when the interface language changes, but the application shell and cached route views continue using the previous `cachedPreferences.language`. This produces mixed English and Vietnamese UI until a later navigation or reload.

`System language` also needs to resolve through the existing `normalizeLanguage()` policy so both the active view and shell use the same effective locale.

## Design

- Keep `cachedPreferences` as the single effective language source used by the shell and route controllers.
- When onboarding changes `language`, apply the draft choice through the existing preference runtime, then render the current route again so the shell and onboarding view update together.
- When Settings previews `general.language`, preserve the current Settings controller and draft, expire every other cached route, and render Settings together with the shell. Navigating away then creates the destination in the previewed language instead of reviving stale copy.
- Route titles, shell labels, and the default Home composer must read from the effective locale instead of retaining hard-coded English copy.
- After Settings saves or onboarding completes, invalidate cached route views before navigation. Language-sensitive controllers will then be recreated with the new effective language instead of retaining the locale captured when they were first loaded.
- Resolve `system` with the existing `normalizeLanguage()` function; do not add a second locale policy.
- Preserve the existing backend persistence APIs and onboarding/settings data formats. The settings secret guard must allow the non-secret boolean policy field `security.redactSecrets` while continuing to reject actual credentials.

## Scope

The change is limited to language selection, UI rerendering, route-cache lifecycle, and the `security.redactSecrets` false-positive that prevented the existing Settings payload from being saved. It does not alter translations, themes, experience levels, provider configuration, or credential storage.

## Verification

- Regression test: onboarding rendered with `English` contains English shell and onboarding labels without Vietnamese shell text.
- Regression test: onboarding rendered with `System language` follows the mocked browser locale.
- Regression test: changing Settings from English to Vietnamese updates both the Settings view and outer shell, and revisiting a cached route cannot restore its old language.
- Regression test: Vietnamese Home and shell render localized route, project, provider-status, objective, and intent labels.
- Regression test: the full Settings payload may contain `security.redactSecrets`, while actual API-key fields remain rejected.
- Run focused UI tests, the project's UI verification command, and a live browser smoke against the running source server.
