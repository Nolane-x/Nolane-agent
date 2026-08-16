# API

Nolane Agent exposes local application APIs for project/task lifecycle, agent execution, model management, review/evidence, browser/MCP actions and desktop integration.

The API follows three constraints:
- mutating operations must pass the same governance rules as UI-triggered actions;
- untrusted external/tool content is never silently promoted to trusted state;
- response state distinguishes unavailable, blocked, failed and verified outcomes rather than collapsing them into success/failure booleans.

The source of truth for concrete endpoints is `src/server/routes.mjs`; clients should not depend on undocumented development-only paths.
