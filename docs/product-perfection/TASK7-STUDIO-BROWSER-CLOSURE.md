# Task 7 — Studio / Browser Source Closure

**Exact verified implementation revision:** `0fdd1b19952d71e9d42b6b3cb28c3f86694474e5`  
**Workflow run:** `31877524693`  
**Status:** PASS for source, focused behavior, canonical build, token and static-quality scope.

Verified:

- compact Studio exposes explicit Files / Editor / Agent pane switching instead of deleting side panes;
- Studio route cache is path-scoped so different project URLs do not reuse one stale view model;
- wide Studio panel/open-state behavior remains covered by existing Workroom tests;
- Browser inspector exposes explicit origin, active-session and permission-boundary facts;
- page-derived Browser artifacts are semantically wrapped as bounded external/untrusted content;
- origin display does not leak query secrets;
- focused accessibility/perfection contracts pass;
- canonical `ui-dist`, token validation and static UI quality audit pass.

Runtime visual/Axe re-observation remains required before Task 7 final certification.
