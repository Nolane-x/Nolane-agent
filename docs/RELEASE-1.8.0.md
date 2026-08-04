# Forge Studio 1.8.0 release notes

Date: 2026-07-29

## Instruction Rules & Conflict Center

Forge Studio 1.8.0 adds a typed instruction-policy graph while retaining compatibility with AGENTS.md, CLAUDE.md, FORGE.md, Cursor rules, Windsurf rules, and operator-invoked workflows.

### Completed instruction capabilities

- Explicit global, repository, directory, language, and task scopes.
- Bounded recursive directory instructions.
- Deterministic inheritance and precedence.
- Integer priority from -1000 through 1000.
- Typed scalar rules separated from free-form Markdown guidance.
- Same-precedence conflict detection and higher-precedence resolution.
- Invalid frontmatter and schema records remain visible.
- Safe relative imports with traversal, symlink, cycle, depth, size, and record-count protection.
- Workspace Trust remains mandatory before project instructions or policy can influence the agent.
- AgentLoop receives compact effective-rule, conflict, invalid-record, and receipt metadata.
- Authenticated project-scoped API and lazy Instruction Governance Center.

## Release evidence

The complete release matrix adds the required `instruction-policy-governance` gate. The item-level audit and exhaustive Remaining Gaps Report are regenerated from the same 790-item source of truth.
