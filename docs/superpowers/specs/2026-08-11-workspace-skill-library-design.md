# Workspace Skill Library

## Purpose

Expose the existing native and ForgeOS skill catalog as a first-class Workspace
surface. Today it can be reached only through the Expert Control Plane or the
composer context menu, which makes a real capability look absent.

## Chosen approach

Add a dedicated `/skills` route at Workspace level and a visible Home workspace
action. The page is a catalogue and preview surface, not an installer:
installation and trust decisions stay in the existing Extension Control Plane.

The page has three bounded responsibilities:

1. Fetch the existing `/api/skills/catalog` data and provide local, accessible
   text search plus a catalog filter.
2. Render a compact, theme-token-driven list whose source and maturity make
   each skill scannable without marketing copy.
3. Load the selected skill through the existing catalog preview endpoint and
   render only its text preview; it never executes or installs a skill.

## Interaction and accessibility

- Search is labelled and filters immediately.
- Catalog filtering uses a labelled native select, which follows the active
  `color-scheme` token.
- Each row is a real button, exposes selection through `aria-pressed`, and is
  usable with Tab/Enter/Space without custom key handling.
- Loading, error, empty, and preview states contain explicit user-facing copy.
- The page uses a single-column reading order on narrow screens and avoids
  storing or showing credentials.

## Visual direction

The signature is a quiet catalogue rail: source/maturity are treated as small
utility labels beside the skill name, while the selected preview has a slim
accent rule. This encodes the actual relationship between a selectable skill
and its safe inspection state. It uses existing semantic surface, text,
border, and accent tokens; no new raw colors, gradients, or oversized card grid
are introduced.

## Verification

- Unit tests prove filtering, state transitions, safe escaping, and empty/error
  rendering.
- A route/rail contract proves the surface is available at Workspace level.
- Existing UI token, accessibility, responsive, and release-build checks run
  after the source change.

## Explicit bounds

This does not claim that every catalog skill is installed, trusted, or runnable.
The existing Control Plane remains the place for extensions, providers, and
trust management. The work only makes the already integrated catalog
discoverable and safely inspectable.
