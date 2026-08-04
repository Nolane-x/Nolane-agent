# Forge Studio 2.16.0 Security Model

## Authority

ForgeOS is the final authority for context, tools, permissions, execution, worktrees, evidence, and completion. Models, repository instructions, web pages, plugins, MCP resources, and tool output are untrusted inputs and cannot change this authority.

## Remote source supply chain

Remote plugin sources must use HTTPS Git URLs and cannot include credentials. Clones disable submodules and Git hooks, use a bounded shallow fetch, resolve a concrete commit, reject symlinks and oversized trees, remove `.git`, compute a content hash, and publish an immutable cache directory atomically.

Installed metadata does not imply activation. Executable hooks stay quarantined. MCP/LSP servers are approved individually per project; environment variable names may be reviewed, but secret values are never returned to the renderer.

## Browser boundary

Browser sessions are project-scoped. Network and page content are untrusted. Read capabilities and write capabilities are separated. `click`, `fill`, `type`, and `press` require an explicit goal grant. Permission changes are audited and propagated to active non-final tasks. Downloads, uploads, external communication, credentials, payments and publishing remain separate high-risk capabilities.

## Secrets

Direct API keys are stored through the operating-system credential helper. Databases, logs, traces, UI state and project settings contain aliases, not plaintext values. Secret-bearing output is redacted before persistence or display. Provider CLI credentials remain owned by their official CLI.

## Files and commands

Every task has allowed/denied paths, a worktree, a lease and a fencing token. Reads, writes, patches and process working directories are checked against task scope. Patch operations use expected hashes and atomic replacement. Commands use executable-plus-argument arrays rather than unrestricted shell strings.

## Completion

Model text cannot complete a task. Completion requires verification evidence bound to the candidate commit/diff, test receipts and an independent review decision. Failed verification preserves the checkpoint and enters a recoverable state.

## Remaining production limits

The Windows executables are not Authenticode-signed. Physical Windows 11, macOS and Linux package matrices are not available in this build environment. Remote Streamable HTTP MCP with full OAuth, cloud sandboxes, enterprise tenant isolation, and production marketplace signing are not complete in 0.6.0.

## Optional module and pack boundary (2.16.0)

Lazy loading does not weaken authorization. Enterprise, cloud, OIDC, SCIM and remote MCP requests still pass the same local-token or enterprise authorizer before their module becomes useful. Module unload closes owned stores and workers but does not erase durable audit evidence.

NolaneNative runtime bytes are distributed as a separate pack. Core contains only the pinned manifest, license and upstream attribution. The runtime rejects a missing pack with `NOLANE_NATIVE_PACK_NOT_INSTALLED` and rejects byte-count or SHA-256 drift before extraction. Pack paths are configuration/data paths, not request-controlled filesystem paths.
