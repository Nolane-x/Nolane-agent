# Composer picker dismissal

## Purpose

Keep the home composer compact: an open intent, effort, or model menu must not
obscure unrelated composer content after the user clicks elsewhere.

## Scope

- Reuse the existing composer picker rendering, tokens, and keyboard handling.
- Close open composer pickers for a pointer interaction outside any composer
  picker.
- Preserve the existing Escape, Tab, option-selection, and project-picker
  behavior.

## Decision

Use the same document-level outside-interaction rule already applied to the
project picker. The implementation will be a small, testable shared helper
used by the application click handler. It introduces no visual restyle, new
dependencies, or state store.

## Verification

1. A focused unit test proves outside interactions close an open composer
   picker while interactions inside it do not.
2. The home UI contract tests and the UI build pass.
3. The existing GitHub UI/runtime evidence remains the visual regression gate.
