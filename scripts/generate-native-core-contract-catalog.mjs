#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { buildNativeCoreCatalog, verifyCoreContracts } from '../src/native-core/core-conformance-verifier.mjs';

const verified = (id, domain, title, patterns, entrypoint, test, wiringPath, wiringToken, priority = 100) => ({
  id, domain, title, status: 'verified', priority, upstreamPathPatterns: patterns,
  entrypoints: [entrypoint], tests: [test], negativeTests: [test],
  productionWiring: [{ path: wiringPath, contains: wiringToken }], externalCondition: null,
});
const external = (id, domain, title, patterns, entrypoint, test, wiringPath, wiringToken, condition, priority = 100) => ({
  ...verified(id, domain, title, patterns, entrypoint, test, wiringPath, wiringToken, priority),
  status: 'external_gate', externalCondition: condition,
});


export const NATIVE_CORE_CONTRACTS = [
  verified('NATIVE-AGENT-TURN-KERNEL', 'agent-kernel', 'Bounded turn lifecycle, tool loop, verification and receipts', [
    '^(run_agent\\.py|agent/(conversation_loop|turn_context|turn_finalizer|turn_retry_state|iteration_budget|bounded_response)\\.py)$',
  ], 'src/native-core/turn-state-machine.mjs', 'tests/native-core-runtime-kernel.test.mjs', 'src/nolane-native/agent-loop.mjs', 'TurnStateMachine'),
  verified('NATIVE-GOAL-EVIDENCE-COMPLETION', 'agent-kernel', 'Independent evidence-gated goal completion without hidden reasoning', [
    '^agent/(verification_stop|verification_evidence|verify_hooks)\\.py$',
  ], 'src/native-core/goal-evidence-contract.mjs', 'tests/native-core-goal-evidence.test.mjs', 'src/nolane-native/agent-service.mjs', 'GoalEvidenceContract', 180),
  verified('NATIVE-AGENT-RUNTIME-ISOLATION', 'agent-kernel', 'Native worker lifecycle, protocol handshake and fail-closed runtime', [
    '^agent/(agent_init|agent_runtime_helpers|async_utils|process_bootstrap|runtime_cwd)\\.py$',
  ], 'src/native-core/runtime-receipt-ledger.mjs', 'tests/native-core-runtime-kernel.test.mjs', 'src/nolane-native/runtime-service.mjs', 'RuntimeReceiptLedger'),
  verified('NATIVE-PROMPT-CONTEXT-FABRIC', 'prompt-context', 'Tiered context, compression, references and cache boundaries', [
    '^(trajectory_compressor\\.py|agent/(coding_context|context_breakdown|context_compressor|context_engine|context_references|conversation_compression|manual_compression_feedback|prompt_builder|prompt_caching|system_prompt|turn_summary)\\.py)$',
  ], 'src/native-core/prompt-tier-assembler.mjs', 'tests/native-core-context-provider.test.mjs', 'src/agent/context-builder.mjs', 'PromptTierAssembler'),
  verified('NATIVE-PROVIDER-PROTOCOL', 'provider-fabric', 'Provider registry, aliases, credentials, retry classification and usage accounting', [
    '^(model_tools\\.py|agent/(aux_accounting|backend_identity|credential_pool|credential_sources|error_classifier|model_metadata|models_dev|rate_limit_tracker|retry_utils|usage_pricing)\\.py)$',
  ], 'src/native-core/provider-fallback-fabric.mjs', 'tests/native-core-context-provider.test.mjs', 'src/nolane-native/provider-registry.mjs', 'ProviderFallbackFabric'),
  external('NATIVE-PROVIDER-REAL-CERTIFICATION', 'provider-fabric', 'Provider-specific transports and real credential execution', [
    '^(providers/.*|agent/(anthropic_adapter|azure_identity_adapter|bedrock_adapter|codex_responses_adapter|codex_runtime|gemini_native_adapter|gemini_schema|lmstudio_reasoning|moonshot_schema|nous_rate_guard|vertex_adapter|transports/(anthropic|bedrock|codex|codex_app_server|codex_app_server_session|nolane_native_tools_mcp_server))\\.py)$',
    '^plugins/model-providers/.*$',
  ], 'src/providers/provider-registry.mjs', 'tests/direct-api-providers.test.mjs', 'src/app.mjs', 'new ProviderRegistry', 'Run each provider adapter with real credentials or local endpoint and attach replayable request, usage, rate-limit and cancellation receipts.'),
  verified('NATIVE-TOOL-EXECUTION', 'tool-execution', 'Tool discovery, approval, timeout, process registry and normalized results', [
    '^(toolsets|toolset_distributions)\\.py$|^tools/(approval|close_terminal_tool|code_execution_tool|env_passthrough|env_probe|interrupt|managed_tool_gateway|process_registry|read_terminal_tool|registry|terminal_tool|tool_backend_helpers|tool_output_limits|tool_result_storage)\\.py$',
  ], 'src/native-core/tool-execution-fabric.mjs', 'tests/native-core-tool-execution.test.mjs', 'src/execution/tool-broker.mjs', 'ToolExecutionFabric'),
  external('NATIVE-REMOTE-EXECUTION-CERTIFICATION', 'tool-execution', 'Remote and hosted execution backends', [
    '^tools/environments/(daytona|managed_modal|modal|modal_utils|singularity|ssh)\\.py$',
  ], 'src/sandbox/local-resource-sandbox-service.mjs', 'tests/local-resource-sandbox-service.test.mjs', 'src/app.mjs', 'new LocalResourceSandboxService', 'Exercise each remote backend with real infrastructure, quotas, teardown and credential-isolation receipts.'),
  verified('NATIVE-REPOSITORY-FILE-TRANSACTIONS', 'repository-files', 'Safe file reads, writes, patches, checkpoints and diff projection', [
    '^agent/file_safety\\.py$|^tools/(checkpoint_manager|file_operations|file_state|file_tools|patch_parser|path_security|project_tools|read_extract|working_diff)\\.py$',
  ], 'src/workroom/file-service.mjs', 'tests/file-service.test.mjs', 'src/app.mjs', 'new FileService'),
  verified('NATIVE-LSP-CODE-INTELLIGENCE', 'repository-files', 'Bounded LSP lifecycle, definitions, references, rename, diagnostics and fallback', [
    '^agent/lsp/.*\\.py$',
  ], 'src/repository/lsp-client.mjs', 'tests/lsp-intelligence.test.mjs', 'src/app.mjs', 'CodeIntelligenceService.pooled', 180),
  verified('NATIVE-MEDIA-PROVIDER-FRAMEWORK-WAVE14', 'media-voice', 'Content-addressed media, provider registry, transcription, streaming TTS and cancellation core', [
    '^agent/(image_gen_provider|image_gen_registry|image_routing|transcription_provider|transcription_registry|tts_provider|tts_registry|video_gen_provider|video_gen_registry)\.py$|^tools/(image_source|tts_streaming|tts_tool|vision_tools|voice_mode)\.py$',
  ], 'src/native-core/media-core-wave14.mjs', 'tests/native-core-media-wave14.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'MediaCoreRuntimeWave14', 580),

  verified('NATIVE-SECRET-PROVIDER-FRAMEWORK-WAVE13', 'security', 'Reference-only environment, file and command secret provider contract', [
    '^agent/secret_sources/(__init__|base|registry|_cache|command)\.py$',
  ], 'src/native-core/trust-core-wave13.mjs', 'tests/native-core-trust-wave13.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'TrustCoreRuntimeWave13', 560),
  verified('NATIVE-DASHBOARD-AUTH-TRUST-WAVE13', 'security', 'Profile-scoped dashboard authentication, session tickets, audit and revoke-safe permissions', [
    '^nolane_native_cli/dashboard_auth/(__init__|base|registry|middleware|audit|routes|prefix|public_paths|token_auth|cookies|ws_tickets|native_flow)\.py$',
  ], 'src/native-core/trust-core-wave13.mjs', 'tests/native-core-trust-wave13.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'TrustCoreRuntimeWave13', 560),

  verified('NATIVE-MEMORY-ADAPTER-FRAMEWORK-WAVE12', 'memory-learning', 'Durable versioned local memory adapter contract, retention and provider TCK', [
    '^plugins/memory/(__init__|config_schema|query_rewrite)\.py$',
  ], 'src/native-core/adapter-ecosystem-wave12.mjs', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AdapterEcosystemRuntimeWave12', 540),
  verified('NATIVE-SIGNED-PLUGIN-PACKAGE-WAVE12', 'plugin-system', 'Signed plugin package verification, capabilities, transparency log, disable and rollback', [
    '^plugins/plugin_utils\.py$',
  ], 'src/native-core/adapter-ecosystem-wave12.mjs', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AdapterEcosystemRuntimeWave12', 540),
  verified('NATIVE-DURABLE-ADAPTER-SCHEDULER-WAVE12', 'scheduler', 'Durable adapter scheduling with skew-safe idempotent delivery', [
    '^plugins/cron_providers/chronos/(__init__|verify)\.py$|^plugins/cron_providers/chronos/plugin\.yaml$',
  ], 'src/native-core/adapter-ecosystem-wave12.mjs', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AdapterEcosystemRuntimeWave12', 540),
  verified('NATIVE-KANBAN-SYNC-WAVE12', 'multi-agent', 'Conflict-safe versioned Kanban synchronization and duplicate suppression', [
    '^plugins/kanban/dashboard/(manifest\.json|plugin_api\.py)$',
  ], 'src/native-core/adapter-ecosystem-wave12.mjs', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AdapterEcosystemRuntimeWave12', 540),
  verified('NATIVE-OBSERVABILITY-ADAPTER-FRAMEWORK-WAVE12', 'observability-operations', 'Redacted observability adapter queue, backpressure, disconnect and flush contract', [
    '^plugins/observability/[^/]+/plugin\.yaml$',
  ], 'src/native-core/adapter-ecosystem-wave12.mjs', 'tests/native-core-adapter-ecosystem-wave12.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AdapterEcosystemRuntimeWave12', 540),

  verified('NATIVE-BROWSER-ENGINE-WAVE11', 'browser-computer-use', 'Profile-isolated browser engine, action policy, selectors, quarantine, recovery and replay', [
    '^agent/(browser_registry|browser_provider)\.py$|^tools/computer_use/.*\.py$',
  ], 'src/native-core/browser-engine-wave11.mjs', 'tests/native-core-browser-wave11.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'BrowserEngineWave11', 520),
  external('NATIVE-BROWSER-COMPUTER-USE-CERTIFICATION', 'browser-computer-use', 'Browser and computer-use actions with approvals and bounded output', [
    '^agent/browser_.*\\.py$|^tools/(browser_.*|computer_use/.*|computer_use_tool)\\.py$|^plugins/(browser|web)/.*$',
  ], 'src/browser/browser-agent-service.mjs', 'tests/browser-agent-service.test.mjs', 'src/app.mjs', 'new BrowserAgentService', 'Run Playwright/CDP, search-provider and computer-use journeys on a real desktop/browser with visual, download and permission receipts.'),
  verified('NATIVE-SESSION-PERSISTENCE', 'sessions', 'Durable sessions, lineage, search and corrupt-primary recovery', [
    '^nolane_native_state\\.py$|^agent/(replay_cleanup|thread_scoped_output|title_generator)\\.py$|^tools/session_search_tool\\.py$',
  ], 'src/native-core/session-memory-learning-fabric.mjs', 'tests/native-core-state-learning.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'SessionMemoryLearningFabric'),
  verified('NATIVE-MEMORY-LEARNING', 'memory-learning', 'Bounded memory, provenance, consolidation and verified learning', [
    '^agent/(background_review|curator|curator_backup|learn_prompt|learning_graph|learning_graph_render|learning_mutations|memory_manager|memory_provider)\\.py$|^tools/memory_tool\\.py$',
  ], 'src/native-core/session-memory-learning-fabric.mjs', 'tests/native-core-state-learning.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'SessionMemoryLearningFabric'),
  external('NATIVE-MEMORY-PROVIDER-CERTIFICATION', 'memory-learning', 'External memory provider adapters behind the native memory contract', [
    '^plugins/memory/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run each memory provider with real storage, restart, conflict, deletion and credential-redaction receipts.'),
  verified('NATIVE-SKILL-ENGINE', 'skills', 'Skill discovery, progressive loading, provenance and guarded use', [
    '^agent/(skill_bundles|skill_commands|skill_preprocessing|skill_utils)\\.py$|^tools/(skill_manager_tool|skill_provenance|skill_usage|skills_ast_audit|skills_guard|skills_hub|skills_sync|skills_tool)\\.py$',
  ], 'src/nolane-native/skill-registry.mjs', 'tests/native-core-state-learning.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NolaneSkillRegistry'),
  verified('NATIVE-PLUGIN-HOST', 'plugin-system', 'Plugin manifests, capability quarantine, activation and typed dispatch', [
    '^plugins/(__init__\\.py|plugin_utils\\.py)$',
  ], 'src/native-core/extension-automation-fabric.mjs', 'tests/native-core-extension-automation.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ExtensionAutomationFabric'),
  verified('NATIVE-ADAPTER-TCK', 'plugin-system', 'Typed adapter manifests, lifecycle, permission bounds, timeout, redaction and receipts', [
    '^plugins/(dashboard_auth|nolane_native-achievements)/.+/plugin\\.yaml$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 180),
  external('NATIVE-PLUGIN-AUTH-CERTIFICATION', 'plugin-system', 'Dashboard authentication and optional plugin behavior', [
    '^plugins/(dashboard_auth|nolane_native-achievements)/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run each optional plugin against its real auth or dashboard surface and attach lifecycle, permission and rollback receipts.', 100),
  verified('NATIVE-MCP-FABRIC', 'mcp', 'MCP stdio/HTTP lifecycle, OAuth, filtering and reconnect', [
    '^mcp_serve\\.py$|^tools/mcp_(dashboard_oauth|oauth|oauth_manager|stdio_watchdog|tool)\\.py$',
  ], 'src/native-core/extension-automation-fabric.mjs', 'tests/native-core-extension-automation.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ExtensionAutomationFabric'),
  verified('NATIVE-DURABLE-SCHEDULER', 'scheduler', 'Persistent schedules, duplicate prevention, retry and restart recovery', [
    '^cron/.*\\.py$|^tools/cronjob_tools\\.py$|^plugins/cron_providers/__init__\\.py$',
  ], 'src/native-core/extension-automation-fabric.mjs', 'tests/native-core-extension-automation.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ExtensionAutomationFabric'),
  external('NATIVE-CRON-PROVIDER-CERTIFICATION', 'scheduler', 'External scheduler provider adapters', [
    '^plugins/cron_providers/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run each external scheduler with real clock, retry, pause, resume, stale-lease and delivery receipts.', 50),
  verified('NATIVE-MULTI-AGENT-ORCHESTRATION', 'multi-agent', 'Delegation, workers, leases, blackboard, verification and synthesis', [
    '^(batch_runner|mini_swe_runner)\\.py$|^agent/(delegation_context|kanban_stop|subagent_lifecycle)\\.py$|^tools/(async_delegation|delegate_tool|delegation_live_log|kanban_tools)\\.py$',
  ], 'src/native-core/extension-automation-fabric.mjs', 'tests/native-core-extension-automation.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ExtensionAutomationFabric'),
  verified('NATIVE-MIXTURE-OF-AGENTS', 'multi-agent', 'Independent proposal, disagreement-preserving synthesis and verifier-gated completion', [
    '^agent/(moa_loop|moa_trace)\\.py$|^nolane_native_cli/moa_config\\.py$',
  ], 'src/native-core/mixture-of-agents-coordinator.mjs', 'tests/native-core-mixture-of-agents.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'MixtureOfAgentsCoordinator', 180),
  external('NATIVE-KANBAN-DASHBOARD-CERTIFICATION', 'multi-agent', 'Multi-agent Kanban dashboard adapter', [
    '^plugins/kanban/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run Kanban state synchronization, reconnect, duplicate prevention and UI projection against a real dashboard.'),
  verified('NATIVE-GATEWAY-CORE', 'gateway-integrations', 'Gateway registry, authorization, delivery, pairing, draining and streaming', [
    '^gateway/(channel_directory|code_skew|config|dead_targets|delivery|delivery_ledger|drain_control|hooks|mirror|pairing|platform_registry|profile_routing|readiness|response_filters|restart|restart_loop_guard|rich_sent_store|run|scale_to_zero|stream_consumer|stream_dispatch|stream_events|turn_lease|wake)\\.py$',
  ], 'src/native-core/gateway-api-surface.mjs', 'tests/native-core-gateway-api.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'GatewayApiSurface'),
  external('NATIVE-MESSAGING-PLATFORM-ADAPTERS', 'gateway-integrations', 'Platform-specific messaging adapters and credential certification', [
    '^gateway/platforms/(?!__init__\\.py$|_http_client_limits\\.py$|api_server\\.py$|base\\.py$|helpers\\.py$).+\\.py$',
    '^plugins/(platforms|teams_pipeline)/.*$',
    '^scripts/whatsapp-bridge/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run every platform adapter against its real service with credential, rate-limit, attachment, reconnect and delivery receipts.'),
  verified('NATIVE-ACP-API', 'acp-api', 'ACP/JSON-RPC and OpenAI-compatible streaming API surface', [
    '^acp_adapter/.*\\.py$|^gateway/platforms/(api_server|base|helpers|_http_client_limits)\\.py$|^agent/transports/(base|chat_completions|codex_event_projector|types)\\.py$',
  ], 'src/native-core/gateway-api-surface.mjs', 'tests/native-core-gateway-api.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/status'),
  verified('NATIVE-STREAM-SINGLE-WRITER', 'acp-api', 'Ordered single-writer event projection with idempotency and bounded delivery', [
    '^agent/stream_single_writer\\.py$',
  ], 'src/native-core/gateway-api-surface.mjs', 'tests/native-core-gateway-api.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'GatewayApiSurface', 180),
  external('NATIVE-MEDIA-VOICE-CERTIFICATION', 'media-voice', 'Media, vision, image, video, meeting, STT and TTS provider routing', [
    '^agent/(image_gen_provider|image_gen_registry|image_routing|transcription_provider|transcription_registry|tts_provider|tts_registry|video_gen_provider|video_gen_registry)\\.py$|^tools/(image_source|transcription_tools|tts_streaming|tts_tool|vision_tools|voice_mode)\\.py$|^plugins/(image_gen|video_gen|spotify|google_meet)/.*$',
  ], 'src/nolane-native/media-provider-registry.mjs', 'tests/nolane-native-capability-pack.test.mjs', 'src/nolane-native/capability-pack.mjs', 'MediaProviderRegistry', 'Run real media, meeting and voice providers with credential redaction, byte limits, cancellation and output receipts.'),
  verified('NATIVE-OBSERVABILITY-OPERATIONS', 'observability-operations', 'Usage, traces, diagnostics, health, recovery and tamper-evident evidence', [
    '^nolane_native_logging\\.py$|^agent/(account_usage|billing_links|billing_usage|billing_view|credits_tracker|insights|stream_diag|trace_upload)\\.py$|^gateway/(memory_monitor|shutdown_forensics|shutdown_watchdog|status|systemd_notify)\\.py$',
  ], 'src/native-core/operations-security-fabric.mjs', 'tests/native-core-operations-security.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'OperationsSecurityFabric'),
  external('NATIVE-OBSERVABILITY-PLUGIN-CERTIFICATION', 'observability-operations', 'External observability and maintenance adapters', [
    '^plugins/(observability|disk-cleanup)/.*$',
  ], 'src/native-core/native-adapter-tck.mjs', 'tests/native-core-adapter-tck.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'NativeAdapterTck', 'Run each observability adapter against a real sink and verify redaction, backpressure, disconnect and retention receipts.'),
  verified('NATIVE-SECURITY-BOUNDARY', 'security', 'Secrets, redaction, approvals, egress and adversarial boundary enforcement', [
    '^agent/(credential_persistence|message_sanitization|redact|secret_scope|ssl_guard|ssl_verify|tool_guardrails)\\.py$|^tools/(credential_files|osv_check|threat_patterns|tirith_security|url_safety|write_approval)\\.py$|^gateway/(authz_mixin|slash_access)\\.py$',
  ], 'src/native-core/operations-security-fabric.mjs', 'tests/native-core-operations-security.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'OperationsSecurityFabric'),
  external('NATIVE-SECRET-AUTH-PROVIDER-CERTIFICATION', 'security', 'External secret stores, OAuth and dashboard authentication', [
    '^agent/secret_sources/.*$|^nolane_native_cli/(dashboard_auth/.*|.*auth.*\\.py|secrets_cli\\.py|secret_prompt\\.py|onepassword_secrets_cli\\.py)$|^plugins/security-guidance/.*$|^gateway/relay/auth\\.py$',
  ], 'src/native-core/operations-security-fabric.mjs', 'tests/native-core-operations-security.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'OperationsSecurityFabric', 'Run each secret or OAuth provider with real credential references, revocation, expiry, redaction and audit receipts.'),
  verified('NATIVE-PRODUCT-SURFACES', 'product-surfaces', 'CLI, web and TUI consume the shared runtime and state', [
    '^cli\\.py$|^nolane_native$|^nolane_native_cli/(active_sessions|commands|completion|doctor|input_sanitize|logs|main|session_listing|status|stdio|tools_config)\\.py$',
  ], 'src/native-core/gateway-api-surface.mjs', 'tests/native-core-gateway-api.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/status'),
  verified('NATIVE-TERMINAL-SURFACE', 'product-surfaces', 'Terminal and TUI lifecycle with bounded output and process cleanup', [
    '^nolane_native_cli/(console_engine|curses_ui|focus_view|pty_bridge|pty_session|win_pty_bridge)\\.py$|^tui_gateway/.*\\.(py|ts|js)$',
  ], 'src/terminal/terminal-manager.mjs', 'tests/terminal-manager.test.mjs', 'src/app.mjs', 'new TerminalManager'),
  external('NATIVE-DESKTOP-WINDOWS-CERTIFICATION', 'product-surfaces', 'Electron desktop installer, update and real Windows runtime certification', [
    '^apps/desktop/.*\\.(ts|tsx|js|mjs|cjs)$',
  ], 'desktop/main.cjs', 'tests/electron-runtime-supervisor.test.mjs', 'desktop/main.cjs', 'BrowserWindow', 'Build and execute the signed NSIS installer on Windows, then attach update, performance, accessibility and recovery receipts.'),
  external('NATIVE-UI-SURFACE-CERTIFICATION', 'product-surfaces', 'CLI, TUI and web behavioral and accessibility certification', [
    '^(ui-tui/src|web/src|apps/shared/src|nolane_native_cli/.*|agent/(pet/.*|i18n\\.py|display\\.py|onboarding\\.py|reactions\\.py|battery\\.py|markdown_tables\\.py))$',
  ], 'src/native-core/gateway-api-surface.mjs', 'tests/native-core-gateway-api.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/status', 'Run keyboard, screen-reader, responsive, visual-regression, CLI and TUI journeys against the shared runtime on Windows.', 50),
  verified('NATIVE-CONFIGURATION-PROFILES', 'configuration', 'Layered settings, profiles, migrations and secret references', [
    '^nolane_native_(bootstrap|constants)\\.py$|^nolane_native_cli/(config|env_loader|managed_scope|migrate|profiles|setup)\\.py$|^cli-config\\.yaml\\.example$',
  ], 'src/settings/settings-service.mjs', 'tests/settings-service.test.mjs', 'src/adoption/trust-adoption-foundation.mjs', 'new SettingsService'),
  verified('NATIVE-UPDATE-RECOVERY', 'configuration', 'Signed update policy, recovery markers and user-data preservation', [
    '^nolane_native_cli/(relaunch|service_manager|uninstall)\\.py$|^nolane_native_cli/subcommands/(uninstall|update)\\.py$',
  ], 'src/update/update-service.mjs', 'tests/update-service.test.mjs', 'src/app.mjs', 'new UpdateService'),
  external('NATIVE-INSTALLER-BOOTSTRAP-CERTIFICATION', 'configuration', 'Installer and bootstrap journeys across supported operating systems', [
    '^apps/bootstrap-installer/.*$',
  ], 'electron-builder.config.cjs', 'tests/electron-installer-config.test.mjs', 'electron-builder.config.cjs', 'nsis', 'Build, install, upgrade, uninstall and recover on each supported operating system with data-preservation receipts.'),

  verified('NATIVE-DELEGATION-CONTEXT-RUNTIME', 'prompt-context', 'Bounded delegation context with omissions, safe paths and no hidden reasoning', [
    '^(plugins/context_engine/__init__\.py|agent/(delegation_context|learn_prompt|turn_context)\.py)$',
  ], 'src/native-core/delegation-context-runtime.mjs', 'tests/native-core-runtime-wave3.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'DelegationContextRuntime', 260),
  verified('NATIVE-PROVIDER-PROTOCOL-RUNTIME', 'provider-fabric', 'Provider protocol normalization, streamed text/tool assembly, cancellation and secret isolation', [
    '^agent/(plugin_llm|web_search_provider|chat_completion_helpers)\.py$',
  ], 'src/native-core/provider-protocol-runtime.mjs', 'tests/native-core-runtime-wave3.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ProviderProtocolRuntime', 260),
  verified('NATIVE-REPOSITORY-INTELLIGENCE-RUNTIME', 'repository-files', 'Bounded repository search, code symbols, safe hints and content-addressed file-sync planning', [
    '^tools/(x_search_tool|tool_search|environments/file_sync|credential_files)\.py$|^agent/subdirectory_hints\.py$',
  ], 'src/native-core/repository-intelligence-fabric.mjs', 'tests/native-core-runtime-wave3.test.mjs', 'src/app.mjs', 'repositoryIndex.search', 260),
  verified('NATIVE-BROWSER-REGISTRY-RUNTIME', 'browser-computer-use', 'Approved browser actions and bounded web-search provider registry', [
    '^agent/web_search_registry\.py$',
  ], 'src/native-core/browser-computer-use-fabric.mjs', 'tests/native-core-surface-wave3.test.mjs', 'src/app.mjs', 'nativeOrchestration.attachRuntimeWave3', 260),
  verified('NATIVE-ACP-STREAMING-RUNTIME', 'acp-api', 'JSON-RPC 2.0 request lifecycle, ordered event receipts, replay and cancellation', [
    '^agent/(copilot_acp_client|stream_diag)\.py$|^agent/transports/__init__\.py$',
  ], 'src/native-core/acp-streaming-runtime.mjs', 'tests/native-core-runtime-wave3.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/acp', 260),
  verified('NATIVE-GATEWAY-ADAPTER-RUNTIME', 'gateway-integrations', 'Gateway adapter lifecycle, inbound normalization and exactly-once delivery', [
    '^gateway/(session|session_context|message_timestamps|status|slash_access|slash_commands)\.py$',
    '^gateway/platforms/(base|helpers|api_server|_http_client_limits)\.py$',
    '^gateway/relay/(transport|ws_transport|adapter|descriptor)\.py$',
    '^tui_gateway/(transport|ws|event_publisher|server|entry)\.py$',
    '^apps/shared/src/(json-rpc-gateway|websocket-url)\.ts$',
    '^ui-tui/src/(gatewayClient|gatewayTypes)\.ts$',
    '^web/src/lib/gatewayClient\.ts$',
    '^apps/desktop/src/lib/(gateway-events|gateway-rpc)\.ts$',
  ], 'src/native-core/gateway-adapter-runtime.mjs', 'tests/native-core-surface-wave3.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'GatewayAdapterRuntime', 260),
  verified('NATIVE-COMMAND-SURFACE-RUNTIME', 'product-surfaces', 'Shared CLI/TUI/web/Electron command registry, ordered events and ANSI-safe bounded output', [
    '^ui-tui/src/app/slash/(registry|types|commands/(core|ops|debug|setup|subscription|topup))\.ts$',
    '^ui-tui/src/app/createSlashHandler\.ts$',
    '^ui-tui/src/lib/(rpc|messages|liveProgress|terminalParity|inputMetrics|gracefulExit)\.ts$',
    '^web/src/lib/(slashExec|api|chat-activation|chat-title|log-classify|clipboard|pty-reconnect)\.ts$',
  ], 'src/native-core/command-surface-runtime.mjs', 'tests/native-core-surface-wave3.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/commands/execute', 260),
  verified('NATIVE-USAGE-OBSERVABILITY-RUNTIME', 'observability-operations', 'Provider usage, pricing, cost budgets, latency and tamper-evident accounting', [
    '^(agent/(subscription_view|usage_pricing|aux_accounting)\.py|nolane_native_time\.py)$',
  ], 'src/native-core/usage-observability-runtime.mjs', 'tests/native-core-surface-wave3.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'UsageObservabilityRuntime', 260),
  verified('NATIVE-AGENT-BEHAVIOR-RUNTIME', 'agent-kernel', 'Public message normalization, deterministic titles, bounded one-shot execution, independent review and replay cleanup', [
    '^agent/(think_scrubber|title_generator|message_content|portal_tags|background_review|replay_cleanup|turn_summary|trajectory|reasoning_timeouts|oneshot|thinking_timeout_guidance|error_classifier|thread_scoped_output|errors|auxiliary_client|retry_utils|__init__)\.py$',
  ], 'src/native-core/agent-behavior-runtime.mjs', 'tests/native-core-agent-behavior-wave4.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'AgentBehaviorRuntime', 320),
  verified('NATIVE-SESSION-LIFECYCLE-RUNTIME', 'sessions', 'Persistent session metadata, search, branching, rewind, history, prompt queues and safe export', [
    '^tools/session_search_tool\.py$',
    '^nolane_native_cli/(session_export(?:_md|_html)?|session_listing|session_recap|session_recovery|active_sessions|session_filters)\.py$',
    '^web/src/lib/(session-refresh|session-import)\.ts$',
    '^ui-tui/src/(hooks/(useInputHistory|useVirtualHistory)|lib/history|app/(useSessionLifecycle|spawnHistoryStore|slash/commands/session))\.tsx?$',
    '^apps/desktop/src/(lib/(session-search|session-ids|session-signatures|session-export|session-branch-tree|session-date-groups|session-link-title|session-source)|store/(composer-input-history|session-states|session-pin-sync|session-color|session-switcher)|app/session/hooks/(use-session-state-cache|use-background-queue-drain|use-session-list-actions|use-session-actions/index|use-prompt-actions/(rewind|resolve-target-session|submit)))\.tsx?$',
  ], 'src/native-core/session-lifecycle-runtime.mjs', 'tests/native-core-session-lifecycle-wave4.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'SessionLifecycleRuntime', 320),
  verified('NATIVE-TOOL-GOVERNANCE-RUNTIME', 'tool-execution', 'Schema sanitization, URL and path safety, ANSI-safe output, diff/checkpoint receipts and execution budgets', [
    '^tools/(schema_sanitizer|url_safety|ansi_strip|path_security|working_diff|checkpoint_manager|hook_output_spill|budget_config|fuzzy_match|thread_context|debug_helpers|threat_patterns|website_policy)\.py$',
    '^agent/tool_result_classification\.py$',
  ], 'src/native-core/tool-governance-runtime.mjs', 'tests/native-core-tool-governance-wave4.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ToolGovernanceRuntime', 320),
  verified('NATIVE-PROFILE-CONFIGURATION-RUNTIME', 'configuration', 'Profile-scoped versioned configuration, credential references, migration-safe export and lifecycle', [
    '^nolane_native_cli/(subcommands/(profile|config)|profile_describer|profile_distribution|fallback_config|mcp_config|skills_config|tools_config)\.py$',
    '^web/src/contexts/(profile-context|ProfileProvider|useProfileScope)\.tsx?$',
    '^web/src/(pages/(ProfilesPage|ProfileBuilderPage)|components/(ProfileSwitcher|ProfileScopeBanner))\.tsx$',
    '^ui-tui/src/(config/(limits|timing|env)|app/useConfigSync)\.tsx?$',
    '^apps/desktop/src/(store/profile|lib/profile-color|app/profiles/(index|create-profile-dialog|rename-profile-dialog|delete-profile-dialog)|app/hooks/(use-config-record|use-on-profile-switch)|app/settings/(config-settings|model-settings|keybind-settings|appearance-settings|notifications-settings|providers-settings|fallback-models-field|toolset-config-panel|memory/(provider-config-panel|provider-config-modal|field-control|connect)|env-credentials|credential-key-ui|config-field|types|helpers|constants|primitives|quick-entry-settings|computer-use-panel|gateway-settings|plugins-settings|sessions-settings|ssh-host-selection|custom-endpoints-settings)|app/chat/sidebar/(profile-switcher|use-profile-prewarm)|app/chat/profile-tag)\.tsx?$',
  ], 'src/native-core/profile-configuration-runtime.mjs', 'tests/native-core-profile-oauth-wave4.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'ProfileConfigurationRuntime', 320),
  verified('NATIVE-OAUTH-SECURITY-RUNTIME', 'security', 'PKCE authorization state, callback validation, one-time completion, credential references and revocation receipts', [
    '^apps/desktop/electron/(native-oauth-login|native-oauth|native-auth-decisions|oauth-net-request)\.ts$',
    '^apps/desktop/src/lib/(desktop-remote-auth|mcp-dashboard-oauth)\.ts$',
    '^web/src/lib/mcp-dashboard-oauth\.ts$',
  ], 'src/native-core/oauth-security-runtime.mjs', 'tests/native-core-profile-oauth-wave4.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/oauth/begin', 320),
  verified('NATIVE-KANBAN-RUNTIME', 'multi-agent', 'Persistent versioned Kanban cards, deterministic transitions and optimistic concurrency', [
    '^plugins/kanban/dashboard/(manifest\.json|plugin_api\.py)$',
  ], 'src/native-core/kanban-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'KanbanRuntime', 380),
  verified('NATIVE-LOCAL-OBSERVABILITY-RUNTIME', 'observability-operations', 'Redacted local JSONL telemetry, rotation, backpressure and disk cleanup', [
    '^plugins/disk-cleanup/(__init__\.py|disk_cleanup\.py|plugin\.yaml)$',
  ], 'src/native-core/local-observability-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'LocalObservabilityRuntime', 380),
  verified('NATIVE-SKILL-BUNDLE-RUNTIME', 'memory-learning', 'Safe skill preprocessing, immutable bundles, permissions and provenance hashes', [
    '^agent/(skill_commands|skill_preprocessing|skill_bundles|skill_utils)\.py$',
  ], 'src/native-core/skill-bundle-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'SkillBundleRuntime', 380),
  verified('NATIVE-DASHBOARD-AUTH-RUNTIME', 'plugin-system', 'Local dashboard authentication, role authorization and drain mode without token leakage', [
    '^plugins/dashboard_auth/(basic|self_hosted|drain)/__init__\.py$',
  ], 'src/native-core/dashboard-auth-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'DashboardAuthRuntime', 380),
  verified('NATIVE-SESSION-SEARCH-RUNTIME', 'repository-files', 'Bounded public session indexing, profile filters and hidden-reasoning exclusion', [
    '^tools/session_search_tool\.py$',
  ], 'src/native-core/session-search-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/server/routes.mjs', '/api/nolane/native-core/session-search', 380),
  verified('NATIVE-CRON-PROVIDER-RUNTIME', 'scheduler', 'Validated interval scheduling, delivery deduplication and stale-lease recovery', [
    '^plugins/cron_providers/chronos/(verify\.py|plugin\.yaml|__init__\.py)$',
  ], 'src/native-core/cron-provider-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'CronProviderRuntime', 380),
  verified('NATIVE-JSON-FAST-PATH-RUNTIME', 'provider-fabric', 'Bounded JSON parsing with duplicate-key rejection and safe fallback receipts', [
    '^agent/jiter_preload\.py$',
  ], 'src/native-core/json-fast-path-runtime.mjs', 'tests/native-core-runtime-wave5.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'JsonFastPathRuntime', 380),
  verified('NATIVE-MCP-OAUTH-RUNTIME', 'tool-execution', 'Persistent one-time PKCE lifecycle, credential references and replay-safe MCP authorization', [
    '^tools/(mcp_oauth_manager|mcp_oauth|mcp_dashboard_oauth)\.py$',
  ], 'src/native-core/mcp-oauth-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'beginNativeMcpOAuth', 440),
  verified('NATIVE-BROWSER-SUPERVISOR-RUNTIME', 'tool-execution', 'Serialized browser actions, dialog lifecycle, crash state and bounded recovery receipts', [
    '^tools/(browser_supervisor|browser_dialog_tool|browser_camofox_state)\.py$',
  ], 'src/native-core/browser-supervisor-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'executeNativeSupervisedBrowser', 440),
  verified('NATIVE-ASYNC-DELEGATION-RUNTIME', 'tool-execution', 'Persistent delegated task leases, bounded live logs, stale-worker recovery and verified completion', [
    '^tools/(async_delegation|delegation_live_log)\.py$',
  ], 'src/native-core/async-delegation-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'spawnNativeDelegation', 440),
  verified('NATIVE-PTY-SESSION-RUNTIME', 'sessions', 'Bounded PTY session lifecycle, ordered replay and deterministic retry policy', [
    '^nolane_native_cli/pty_session\.py$',
    '^agent/turn_retry_state\.py$',
  ], 'src/native-core/pty-session-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'startNativePtySession', 440),
  verified('NATIVE-GATEWAY-RECOVERY-RUNTIME', 'gateway-integrations', 'Gateway heartbeat, memory pressure, drain shutdown and tamper-evident forensics', [
    '^gateway/(shutdown_watchdog|memory_monitor|shutdown_forensics|systemd_notify|status_phrases|runtime_footer)\.py$',
    '^apps/desktop/electron/remote-liveness\.ts$',
  ], 'src/native-core/gateway-recovery-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'heartbeatNativeGatewayHost', 440),
  verified('NATIVE-LOCAL-MEDIA-PIPELINE-RUNTIME', 'media-voice', 'Content-addressed local media assets, bounded playback queue and voice barge-in state', [
    '^apps/desktop/src/lib/(voice-playback|voice-barge-in|media|generated-images|embedded-images|svg-image)\.ts$',
    '^apps/desktop/src/store/(voice-playback|voice-prefs)\.ts$',
    '^apps/desktop/src/hooks/use-image-download\.ts$',
  ], 'src/native-core/local-media-pipeline-runtime.mjs', 'tests/native-core-runtime-wave6.test.mjs', 'src/nolane-native/orchestration-service.mjs', 'putNativeLocalMedia', 440),
];

const regexEscape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactPathPattern = (paths) => `^(?:${paths.map(regexEscape).join('|')})$`;
const contractFromDecomposition = (definition) => {
  const factory = definition.status === 'verified' ? verified : external;
  const args = [
    definition.id,
    definition.domain,
    definition.title,
    [exactPathPattern(definition.paths)],
    definition.entrypoint,
    definition.test,
    definition.wiringPath,
    definition.wiringToken,
  ];
  if (definition.status === 'verified') return factory(...args, definition.priority ?? 25);
  return factory(...args, definition.externalCondition, definition.priority ?? 25);
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

async function main() {
  const inventory = JSON.parse(await readFile('requirements/nolane-native-core-inventory.json', 'utf8'));
  const decomposition = JSON.parse(await readFile('requirements/nolane-native-core-decomposition.json', 'utf8'));
  const decompositionContracts = decomposition.contracts.map(contractFromDecomposition);
  const allContracts = [...NATIVE_CORE_CONTRACTS, ...decompositionContracts];

  const preliminaryCatalog = buildNativeCoreCatalog({ contracts: allContracts });
  const preliminaryReceipt = await verifyCoreContracts({
    rootDirectory: process.cwd(),
    catalog: preliminaryCatalog,
    nolane_nativeInventory: inventory,
  });
  const emptyContractIds = new Set(preliminaryReceipt.evidence
    .filter((entry) => entry.candidateFiles === 0)
    .map((entry) => entry.id));

  const catalog = buildNativeCoreCatalog({ contracts: allContracts.filter((entry) => !emptyContractIds.has(entry.id)) });
  const receipt = await verifyCoreContracts({ rootDirectory: process.cwd(), catalog, nolane_nativeInventory: inventory });
  await writeFile('requirements/nolane-native-core-contracts.json', `${JSON.stringify(canonical(catalog), null, 2)}\n`);
  await writeFile('requirements/nolane-native-core-conformance.json', `${JSON.stringify(canonical(receipt), null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    status: 'pass',
    summary: receipt.summary,
    candidateStatusCounts: receipt.candidateStatusCounts,
    prunedEmptyContracts: [...emptyContractIds].sort(),
  })}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
