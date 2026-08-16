# Task 8 — Skills / Settings / Control Plane Source Closure

**Exact verified implementation revision:** `07d24efbd589065a023750c14f326fa3141aa9e0`  
**Workflow run:** `31878104779`  
**Status:** PASS for source truth, focused behavior, canonical build, token and static-quality scope.

Verified:

- Skills preserves and renders only capability states explicitly declared by the backend; no readiness is inferred from installation/configuration metadata;
- explicit skill capability states participate in search and remain localized;
- Settings search preserves active focus, value and caret/selection through the debounced custom rerender path without stealing focus after the user moves away;
- Control Plane classifies semantic blocked/offline/not-ready states before positive ready matching;
- configured/attention records are not counted as online;
- aggregate Control Plane status is degraded for hard semantic failures and attention for non-ready warnings;
- Control Plane skill catalog search owns a shared focus-preservation key;
- focused Skills, Settings, Control Plane, accessibility and perfection regressions pass;
- canonical `ui-dist`, UI tokens and static UI quality audit pass.

Runtime visual/interaction re-observation remains required before Task 8 final certification.
