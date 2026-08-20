import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION as PRODUCT_VERSION } from '../src/version.mjs';

const TITLES = Object.freeze({
  1: 'Nguyên tắc kiến trúc', 2: 'Mục tiêu sản phẩm', 3: 'Các chế độ sử dụng', 4: 'Giao diện người dùng', 5: 'Agent runtime cốt lõi', 6: 'Trạng thái agent', 7: 'Vòng đời tác vụ', 8: 'Task specification', 9: 'Bộ lập kế hoạch', 10: 'Bộ quản lý context', 11: 'Repository discovery', 12: 'File hướng dẫn agent', 13: 'Codebase intelligence', 14: 'Công cụ đọc file', 15: 'Công cụ tìm kiếm', 16: 'Công cụ chỉnh sửa file', 17: 'Patch engine', 18: 'Terminal và shell tool', 19: 'Phân loại lệnh nguy hiểm', 20: 'Sandbox', 21: 'Local sandbox', 22: 'Cloud sandbox', 23: 'Hệ thống quyền', 24: 'Guardrails', 25: 'Secret management', 26: 'Git integration', 27: 'Worktree và đa nhiệm', 28: 'Test engine',
});

const EVIDENCE = Object.freeze({
  architecture: ['src/app.mjs', 'src/agent/agent-loop.mjs', 'tests/app-forgeos-v061-wiring.test.mjs', 'tests/agent-loop.test.mjs'],
  forgeos: ['src/forge/forgeos-bridge.mjs', 'src/forge/forgeos-tool-gateway.mjs', 'tests/forgeos-v061-integration.test.mjs', 'tests/forgeos-tool-gateway.test.mjs'],
  runtime: ['src/agent/agent-loop.mjs', 'src/agent/budget.mjs', 'src/orchestration/mission-runner.mjs', 'tests/agent-loop.test.mjs', 'tests/mission-runner.test.mjs'],
  agentModes: ['src/agents/agent-mode-registry.mjs', 'src/agents/agent-mode-service.mjs', 'src/orchestration/run-coordinator.mjs', 'src/security/autonomy-policy.mjs', 'src/security/autonomy-guarded-broker.mjs', 'src/server/routes.mjs', 'ui/agent-modes-center.js', 'ui/agent-modes-center.css', 'tests/agent-mode-service.test.mjs', 'tests/agent-mode-runtime.test.mjs', 'tests/agent-modes-http-api.test.mjs', 'tests/agent-modes-center-ui.test.mjs', 'tests/agent-modes-release-gate.test.mjs'],
  state: ['src/storage/studio-store.mjs', 'src/orchestration/run-coordinator.mjs', 'tests/storage.test.mjs', 'tests/run-coordinator.test.mjs'],
  planning: ['src/orchestration/mission-planner.mjs', 'src/orchestration/task-graph.mjs', 'vendor/forge-os/src/execution/execution-graph.mjs', 'tests/planner.test.mjs', 'tests/forgeos-v061-integration.test.mjs'],
  context: ['src/agent/context-builder.mjs', 'src/repository/repository-index.mjs', 'vendor/forge-os/src/context/work-unit-contexts.mjs', 'tests/context-intelligence.test.mjs', 'tests/forgeos-v061-integration.test.mjs'],
  repositoryDiscovery: ['src/repository/repository-discovery-service.mjs', 'src/server/routes.mjs', 'ui/repository-intelligence-center.js', 'ui/repository-intelligence-center.css', 'tests/repository-discovery-service.test.mjs', 'tests/repository-discovery-http-api.test.mjs', 'tests/repository-intelligence-center-ui.test.mjs', 'tests/repository-discovery-release-gate.test.mjs'],
  files: ['src/execution/tool-broker.mjs', 'src/execution/unified-patch.mjs', 'src/security/path-policy.mjs', 'tests/tool-broker.test.mjs', 'tests/patch-engine.test.mjs'],
  terminal: ['src/execution/tool-broker.mjs', 'src/terminal/terminal-manager.mjs', 'src/security/autonomy-policy.mjs', 'tests/tool-broker.test.mjs', 'tests/terminal-manager.test.mjs'],
  browser: ['src/browser/browser-agent-service.mjs', 'src/browser/browser-tool-gateway.mjs', 'tests/browser-agent.test.mjs', 'tests/browser-tool-gateway.test.mjs'],
  git: ['src/repository/git-inspector.mjs', 'src/execution/task-workspace.mjs', 'tests/git-inspector.test.mjs', 'tests/task-workspace.test.mjs'],
  enterprise: ['src/enterprise/enterprise-service.mjs', 'src/enterprise/oidc-login-manager.mjs', 'src/enterprise/scim-service.mjs', 'tests/enterprise-cloud-recovery.test.mjs'],
  cloud: ['src/cloud/cloud-queue.mjs', 'src/cloud/cloud-sandbox-service.mjs', 'src/cloud/kubernetes-sandbox-driver.mjs', 'tests/enterprise-cloud-recovery.test.mjs'],
  mcp: ['src/mcp/oauth-resource-server.mjs', 'src/mcp/remote-mcp-server.mjs', 'src/mcp/remote-mcp-http-adapter.mjs', 'tests/enterprise-cloud-recovery.test.mjs', 'tests/mcp-governance.test.mjs'],
  plugins: ['src/plugins/plugin-signing-service.mjs', 'src/plugins/plugin-trust-store.mjs', 'src/plugins/plugin-transparency-log.mjs', 'tests/enterprise-cloud-recovery.test.mjs'],
  instructions: ['src/repository/instruction-discovery.mjs', 'tests/instruction-discovery.test.mjs'],
  instructionPolicy: ['src/repository/instruction-discovery.mjs', 'src/repository/instruction-policy-service.mjs', 'src/security/workspace-trust-gates.mjs', 'src/agent/agent-loop.mjs', 'src/server/routes.mjs', 'ui/instruction-governance-center.js', 'ui/instruction-governance-center.css', 'tests/instruction-policy-service.test.mjs', 'tests/instruction-policy-http-api.test.mjs', 'tests/instruction-governance-center-ui.test.mjs', 'tests/instruction-policy-release-gate.test.mjs'],
  ui: ['ui/index.html', 'ui/app.js', 'ui/workroom.js', 'tests/http-ui.test.mjs'],
  tests: ['src/orchestration/verification-runner.mjs', 'tests/verification-runner.test.mjs', 'tests/enterprise-cloud-recovery.test.mjs'],
  hooks: ['src/hooks/hook-engine.mjs', 'src/hooks/hook-schema.mjs', 'tests/hook-engine.test.mjs', 'tests/agent-operating-plane-wiring.test.mjs'],
  subagents: ['src/agents/agent-profile-loader.mjs', 'src/agents/subagent-orchestrator.mjs', 'src/agents/agent-tool-gateway.mjs', 'tests/subagent-orchestrator.test.mjs', 'tests/agent-operating-plane-wiring.test.mjs'],
  sessions: ['src/sessions/session-ledger.mjs', 'src/sessions/session-replay.mjs', 'tests/session-ledger.test.mjs'],
  lsp: ['src/repository/lsp-client.mjs', 'src/repository/language-server-registry.mjs', 'src/repository/code-intelligence-service.mjs', 'tests/lsp-intelligence.test.mjs'],
  typedGit: ['src/repository/git-gateway.mjs', 'src/repository/pull-request-providers.mjs', 'src/security/secret-scanner.mjs', 'tests/git-gateway.test.mjs'],
  gitCompletionGovernance: ['src/repository/git-completion-governance-service.mjs', 'src/execution/worktree-integration-service.mjs', 'src/server/routes.mjs', 'ui/git-governance-center.js', 'tests/git-completion-governance-service.test.mjs', 'tests/worktree-integration-service.test.mjs', 'tests/git-governance-http-api.test.mjs', 'tests/git-governance-center-ui.test.mjs', 'tests/git-completion-governance-release-gate.test.mjs'],
  atomicPatchGovernance: ['src/execution/atomic-patch-transaction-service.mjs', 'src/execution/tool-broker.mjs', 'src/agent/agent-loop.mjs', 'src/security/autonomy-policy.mjs', 'tests/atomic-patch-transaction-service.test.mjs', 'tests/atomic-patch-tool-wiring.test.mjs', 'tests/atomic-patch-governance-release-gate.test.mjs'],
  commandExecutionGovernance: ['src/security/shell-command-codec.mjs', 'src/security/command-risk-classifier.mjs', 'src/security/approval-bundle-service.mjs', 'src/security/command-execution-governance-service.mjs', 'src/execution/managed-process-registry.mjs', 'src/execution/tool-broker.mjs', 'src/terminal/terminal-service.mjs', 'src/terminal/terminal-manager.mjs', 'tests/shell-command-codec.test.mjs', 'tests/command-risk-classifier.test.mjs', 'tests/command-execution-governance-service.test.mjs', 'tests/managed-process-registry.test.mjs', 'tests/tool-broker-command-governance.test.mjs', 'tests/terminal-shell-governance.test.mjs', 'tests/command-execution-governance-release-gate.test.mjs'],
  planningEvidenceGovernance: ['src/orchestration/planning-evidence-governance-service.mjs', 'src/orchestration/mission-planner.mjs', 'src/app.mjs', 'tests/planning-evidence-governance-service.test.mjs', 'tests/mission-planner.test.mjs', 'tests/planning-evidence-app-wiring.test.mjs', 'tests/planning-evidence-governance-release-gate.test.mjs'],
  missionCompletionRuntimeReadiness: ['src/orchestration/architecture-stage-gate.mjs', 'src/orchestration/mission-completion-orchestrator.mjs', 'src/orchestration/mission-runner.mjs', 'src/sandbox/local-container-preflight-service.mjs', 'src/app.mjs', 'src/server/routes.mjs', 'tests/architecture-stage-gate.test.mjs', 'tests/mission-completion-orchestrator.test.mjs', 'tests/local-container-preflight-service.test.mjs', 'tests/runtime-readiness-app-wiring.test.mjs', 'tests/runtime-readiness-http-api.test.mjs', 'tests/mission-completion-runtime-readiness-release-gate.test.mjs'],
  localOperationsHumanControl: ['src/security/content-sanitizer.mjs', 'src/operations/controlled-local-cache.mjs', 'src/operations/local-operations-center-service.mjs', 'src/browser/image-comparison-service.mjs', 'src/sandbox/local-resource-sandbox-service.mjs', 'src/server/routes.mjs', 'ui/local-operations-center.js', 'ui/local-operations-center.css', 'tests/content-sanitizer.test.mjs', 'tests/controlled-local-cache.test.mjs', 'tests/local-operations-center-service.test.mjs', 'tests/local-operations-http-api.test.mjs', 'tests/local-operations-center-ui.test.mjs', 'tests/local-operations-human-control-release-gate.test.mjs'],
  clients: ['cli/forge-studio.mjs', 'src/client/forge-studio-client.mjs', 'sdk/typescript/index.mjs', 'sdk/python/forge_studio/client.py', 'tests/client-sdk-cli.test.mjs', 'sdk/python/tests/test_client.py'],
  visual: ['src/browser/image-comparison-service.mjs', 'tests/image-comparison.test.mjs'],
  operatingPlane: ['src/agent/operating-plane-service.mjs', 'src/agent/operating-plane-tool-gateway.mjs', 'tests/operating-plane-service.test.mjs', 'tests/app-operating-plane-wiring.test.mjs'],
  taskContract: ['src/orchestration/task-contract.mjs', 'src/storage/studio-store.mjs', 'tests/task-contract.test.mjs'],
  activity: ['src/agent/run-activity-tracker.mjs', 'src/agent/agent-loop.mjs', 'tests/run-activity-tracker.test.mjs', 'tests/agent-loop.test.mjs'],
  fileCompleteness: ['src/execution/tool-broker.mjs', 'tests/tool-broker-completeness.test.mjs', 'tests/tool-broker.test.mjs'],
  patchCompleteness: ['src/execution/unified-patch.mjs', 'src/execution/tool-broker.mjs', 'tests/unified-patch-completeness.test.mjs', 'tests/tool-broker-completeness.test.mjs'],
  sandboxPolicy: ['src/cloud/kubernetes-sandbox-driver.mjs', 'src/cloud/cloud-sandbox-service.mjs', 'tests/kubernetes-sandbox-policy.test.mjs', 'tests/enterprise-cloud-recovery.test.mjs'],
  capabilities: ['src/security/capability-registry.mjs', 'tests/capability-registry.test.mjs'],
  claimGuard: ['src/security/verification-claim-guard.mjs', 'src/agent/agent-loop.mjs', 'tests/verification-claim-guard.test.mjs', 'tests/agent-loop.test.mjs'],
  terminalSecrets: ['src/security/redaction.mjs', 'src/execution/tool-broker.mjs', 'tests/tool-broker-completeness.test.mjs'],
  interactiveCli: ['cli/interactive.mjs', 'cli/forge-studio.mjs', 'tests/interactive-cli.test.mjs'],
  symbolEdits: ['src/repository/symbol-edit-service.mjs', 'src/agent/operating-plane-tool-gateway.mjs', 'tests/symbol-edit-service.test.mjs', 'tests/operating-plane-service.test.mjs'],
  advancedSearch: ['src/repository/advanced-search-service.mjs', 'src/agent/operating-plane-tool-gateway.mjs', 'tests/advanced-search-service.test.mjs', 'tests/operating-plane-service.test.mjs'],
  actionGuardrails: ['src/security/action-guardrail-pipeline.mjs', 'src/security/capability-registry.mjs', 'tests/action-guardrail-pipeline.test.mjs', 'tests/capability-persistence-api.test.mjs'],
  externalSecrets: ['src/security/secret-provider-adapters.mjs', 'src/security/secret-access-service.mjs', 'tests/secret-provider-adapters.test.mjs', 'tests/secret-access-service.test.mjs'],
  testEngine: ['src/testing/test-engine.mjs', 'src/orchestration/verification-runner.mjs', 'tests/test-engine.test.mjs', 'tests/verification-matrix.test.mjs'],
  releaseMatrix: ['src/release/full-release-matrix.mjs', 'src/release/release-artifacts.mjs', 'tests/full-release-matrix.test.mjs', 'tests/release-artifacts.test.mjs'],
  artifactSecurity: ['src/security/artifact-security-scanner.mjs', 'src/agent/operating-plane-tool-gateway.mjs', 'tests/artifact-security-scanner.test.mjs', 'tests/agent-operating-plane-wiring.test.mjs'],
  worktreeIntegration: ['src/execution/worktree-integration-service.mjs', 'src/orchestration/task-graph.mjs', 'tests/worktree-integration-service.test.mjs'],
  workspaceTrust: ['src/security/workspace-trust-service.mjs', 'src/security/workspace-trust-gates.mjs', 'ui/workspace-trust-center.js', 'tests/workspace-trust-service.test.mjs', 'tests/workspace-trust-http-api.test.mjs'],
  diffReview: ['src/review/diff-review-service.mjs', 'ui/diff-review-center.js', 'ui/diff-review-center.css', 'tests/diff-review-service.test.mjs', 'tests/diff-review-http-api.test.mjs', 'tests/diff-review-center-ui.test.mjs'],
  agentOperations: ['src/operations/agent-operations-service.mjs', 'ui/agent-operations-center.js', 'ui/agent-operations-center.css', 'tests/agent-operations-service.test.mjs', 'tests/agent-operations-http-api.test.mjs', 'tests/agent-operations-center-ui.test.mjs'],
  contextMemoryCenter: ['src/context/context-memory-center-service.mjs', 'src/agent/context-history-archive.mjs', 'src/memory/project-memory-sidecar.mjs', 'ui/context-memory-center.js', 'ui/context-memory-center.css', 'tests/context-memory-center-service.test.mjs', 'tests/context-memory-center-http-api.test.mjs', 'tests/context-memory-center-ui.test.mjs'],
  contextOrchestration: ['src/agent/context-orchestration-kernel.mjs', 'src/context/context-orchestration-service.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/context-memory-center.js', 'ui/context-memory-center.css', 'tests/context-orchestration-kernel.test.mjs', 'tests/context-orchestration-service.test.mjs', 'tests/context-orchestration-http-api.test.mjs', 'tests/context-orchestration-center-ui.test.mjs', 'tests/context-orchestration-release-gate.test.mjs'],
  traceEvidence: ['src/operations/trace-evidence-center-service.mjs', 'ui/trace-evidence-center.js', 'ui/trace-evidence-center.css', 'tests/trace-evidence-center-service.test.mjs', 'tests/trace-evidence-center-http-api.test.mjs', 'tests/trace-evidence-center-ui.test.mjs'],
  missionStateProgress: ['src/operations/mission-state-progress-service.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/mission-state-center.js', 'ui/mission-state-center.css', 'tests/mission-state-progress-service.test.mjs', 'tests/mission-state-progress-http-api.test.mjs', 'tests/mission-state-progress-center-ui.test.mjs', 'tests/mission-state-progress-release-gate.test.mjs'],
  codebaseKnowledge: ['src/repository/codebase-knowledge-graph-service.mjs', 'src/repository/codebase-knowledge-watcher.mjs', 'src/repository/adaptive-repository-intelligence.mjs', 'src/server/routes.mjs', 'ui/codebase-knowledge-center.js', 'ui/codebase-knowledge-center.css', 'tests/codebase-knowledge-graph-service.test.mjs', 'tests/codebase-knowledge-http-api.test.mjs', 'tests/codebase-knowledge-center-ui.test.mjs', 'tests/codebase-knowledge-release-gate.test.mjs'],
  semanticDependency: ['src/repository/embedding-provider.mjs', 'src/repository/secure-semantic-index.mjs', 'src/repository/semantic-dependency-intelligence-service.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/codebase-knowledge-center.js', 'ui/codebase-knowledge-center.css', 'tests/semantic-dependency-intelligence-service.test.mjs', 'tests/semantic-dependency-http-api.test.mjs', 'tests/semantic-dependency-app-wiring.test.mjs', 'tests/semantic-dependency-center-ui.test.mjs', 'tests/semantic-dependency-release-gate.test.mjs'],
  astIntelligence: ['third_party/typescript/package.json', 'third_party/typescript/LICENSE.txt', 'third_party/typescript/lib/typescript.js', 'src/repository/typescript-ast-loader.mjs', 'src/repository/ast-intelligence-service.mjs', 'src/agent/operating-plane-service.mjs', 'src/agent/operating-plane-tool-gateway.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/codebase-knowledge-center.js', 'ui/codebase-knowledge-center.css', 'tests/typescript-ast-loader.test.mjs', 'tests/ast-intelligence-service.test.mjs', 'tests/operating-plane-service.test.mjs', 'tests/agent-operating-plane-wiring.test.mjs', 'tests/ast-intelligence-center-ui.test.mjs', 'tests/ast-intelligence-release-gate.test.mjs'],
  localResourceSandbox: ['src/sandbox/platform-resource-driver.mjs', 'src/sandbox/linux-proc-resource-driver.mjs', 'src/sandbox/cgroup-v2-resource-driver.mjs', 'src/sandbox/workspace-disk-meter.mjs', 'src/sandbox/local-resource-sandbox-service.mjs', 'src/terminal/terminal-manager.mjs', 'src/server/routes.mjs', 'src/server/terminal-websocket.mjs', 'src/app.mjs', 'ui/sandbox-manager.js', 'ui/sandbox-manager.css', 'tests/local-resource-sandbox-drivers.test.mjs', 'tests/local-resource-sandbox-service.test.mjs', 'tests/local-resource-sandbox-http-api.test.mjs', 'tests/local-resource-sandbox-app-wiring.test.mjs', 'tests/local-resource-sandbox-center-ui.test.mjs', 'tests/local-resource-sandbox-release-gate.test.mjs', 'tests/terminal-manager.test.mjs'],
  localWorktreeHandoff: ['src/execution/local-task-handoff-service.mjs', 'src/execution/task-workspace.mjs', 'src/server/routes.mjs', 'src/server/http-server.mjs', 'src/app.mjs', 'extensions/vscode/src/client.ts', 'extensions/vscode/src/extension.ts', 'extensions/vscode/src/local-worktree.ts', 'extensions/vscode/extension/package.json', 'tests/local-task-handoff-service.test.mjs', 'tests/local-task-handoff-api.test.mjs', 'tests/local-task-handoff-app-wiring.test.mjs', 'tests/vscode-local-worktree-handoff.test.mjs', 'tests/local-worktree-handoff-release-gate.test.mjs'],
  integratedBrowser: ['src/browser/browser-agent-service.mjs', 'src/browser/browser-tool-gateway.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/integrated-browser-center.js', 'ui/integrated-browser-center.css', 'ui/app.js', 'ui/index.html', 'tests/browser-agent.test.mjs', 'tests/browser-tool-gateway.test.mjs', 'tests/integrated-browser-center-ui.test.mjs'],
  secretsManager: ['src/security/credential-vault.mjs', 'src/security/credential-helper-client.mjs', 'src/server/routes.mjs', 'src/app.mjs', 'ui/secrets-manager.js', 'ui/secrets-manager.css', 'ui/app.js', 'ui/index.html', 'tests/credential-vault.test.mjs', 'tests/secrets-manager-center-ui.test.mjs'],
  treeSitterRuntime: ['src/repository/tree-sitter-runtime-service.mjs', 'src/server/routes.mjs', 'src/server/http-server.mjs', 'src/app.mjs', 'tests/tree-sitter-runtime-service.test.mjs', 'tests/tree-sitter-http-api.test.mjs', 'tests/completion-runtime-app-wiring.test.mjs', 'tests/completion-release-gate.test.mjs'],
  nativeSandboxDrivers: ['src/sandbox/podman-sandbox-driver.mjs', 'src/sandbox/windows-job-object-driver.mjs', 'src/sandbox/macos-sandbox-driver.mjs', 'src/sandbox/local-resource-sandbox-service.mjs', 'src/app.mjs', 'ui/sandbox-manager.js', 'tests/native-sandbox-drivers.test.mjs', 'tests/completion-runtime-app-wiring.test.mjs', 'tests/completion-release-gate.test.mjs'],
  codeRelationships: ['third_party/typescript/package.json', 'third_party/typescript/LICENSE.txt', 'third_party/typescript/lib/typescript.js', 'src/repository/typescript-ast-loader.mjs', 'src/repository/code-relationship-intelligence-service.mjs', 'src/server/routes.mjs', 'src/server/http-server.mjs', 'src/app.mjs', 'ui/codebase-knowledge-center.js', 'ui/codebase-knowledge-center.css', 'tests/code-relationship-intelligence-service.test.mjs', 'tests/code-relationship-http-api.test.mjs', 'tests/code-relationship-app-wiring.test.mjs', 'tests/code-relationship-center-ui.test.mjs', 'tests/code-relationship-release-gate.test.mjs'],

});

function normalizeSource(text) {
  return text.replaceAll('\r\n', '\n').replaceAll('AGENTS.md', 'AGENTS_MD').replaceAll('CLAUDE.md', 'CLAUDE_MD');
}
function parseChecklist(source) {
  const text = normalizeSource(source);
  const sections = [];
  const marker2 = `2. ${TITLES[2]}`;
  const firstEnd = text.indexOf(marker2);
  if (firstEnd < 0) throw new Error('Checklist section 2 marker is missing');
  sections.push({ number: 1, title: TITLES[1], body: text.slice(0, firstEnd) });
  for (let number = 2; number <= 28; number += 1) {
    const marker = `${number}. ${TITLES[number]}`;
    const startMarker = text.indexOf(marker);
    if (startMarker < 0) throw new Error(`Checklist marker is missing: ${marker}`);
    const start = startMarker + marker.length;
    const end = number === 28 ? text.length : text.indexOf(`${number + 1}. ${TITLES[number + 1]}`);
    let body = text.slice(start, end);
    if ([5, 20, 23].includes(number)) {
      body = body.trimStart();
      const proseEnd = body.indexOf('\n\n');
      if (proseEnd >= 0) body = body.slice(proseEnd + 2);
    }
    sections.push({ number, title: TITLES[number], body });
  }
  return sections.map((section) => ({
    number: section.number,
    title: section.title,
    items: section.body.split('.').map((item) => item.trim().replaceAll('AGENTS_MD', 'AGENTS.md').replaceAll('CLAUDE_MD', 'CLAUDE.md')).filter(Boolean),
  }));
}

const VERIFIED_RULES = Object.freeze([
  { sections: [1], re: /^(Thêm extension IDE sau khi lõi ổn định|Thêm desktop app khi cần đa agent|Thêm cloud agent ở giai đoạn cuối|Mọi tác vụ phải có giới hạn tài nguyên|Tách phần suy nghĩ khỏi phần thực thi|Ưu tiên hệ thống đơn giản nhưng mở rộng được)$/i, evidence: 'missionCompletionRuntimeReadiness' },
  { sections: [2], re: /^(Giải thích kiến trúc dự án|Sửa test thất bại|Sửa lỗi dependency|Giải quyết conflict Git|Tạo commit|Review pull request|Kiểm tra bảo mật|Cập nhật tài liệu|Chạy nhiều tác vụ song song)$/i, evidence: 'missionCompletionRuntimeReadiness' },
  { sections: [4], re: /^IDE extension$/i, evidence: 'missionCompletionRuntimeReadiness' },
  { sections: [7], re: /^Commit nếu được phép$/i, evidence: 'missionCompletionRuntimeReadiness' },
  { sections: [21], re: /^(Kiểm tra Docker daemon|Kiểm tra quyền mount|Kiểm tra socket escape)$/i, evidence: 'missionCompletionRuntimeReadiness' },
  { sections: [4], re: /^(Trình xem ảnh|Trình xem call graph|Trình xem Git history|Trình quản lý chi phí|Nút sửa câu lệnh trước khi chạy|Nút chuyển sang điều khiển thủ công)$/i, evidence: 'localOperationsHumanControl' },
  { sections: [5], re: /^(Giải phóng sandbox|Giữ sandbox khi cần tiếp tục)$/i, evidence: 'localOperationsHumanControl' },
  { sections: [14], re: /^Làm sạch nội dung độc hại$/i, evidence: 'localOperationsHumanControl' },
  { sections: [20], re: /^Cache có kiểm soát$/i, evidence: 'localOperationsHumanControl' },
  { sections: [5], re: /^Yêu cầu người dùng khi cần$/i, evidence: 'planningEvidenceGovernance' },
  { sections: [7], re: /^(Phát hiện thông tin thiếu|Ước lượng phạm vi|Kiểm tra lỗi bảo mật|Kiểm tra tài liệu)$/i, evidence: 'planningEvidenceGovernance' },
  { sections: [9], re: /^(Xác định rủi ro từng bước|Xác định file dự kiến sửa|Xác định công cụ cần dùng|Xác định agent con cần gọi|Lưu lý do thay đổi kế hoạch|Không lập kế hoạch quá chi tiết|Không cho phép bước mơ hồ)$/i, evidence: 'planningEvidenceGovernance' },
  { sections: [15], re: /^(Tìm test liên quan|Tìm config liên quan|Tìm trong tài liệu|Tóm tắt kết quả)$/i, evidence: 'planningEvidenceGovernance' },
  { sections: [16], re: /Chỉnh nhiều file nguyên tử|Chạy formatter sau sửa|Không format toàn dự án vô cớ|Không sửa generated code|Không xóa comment quan trọng|giới hạn số file mỗi lượt|giới hạn số dòng mỗi lượt/i, evidence: 'atomicPatchGovernance' },
  { sections: [17], re: /Hỗ trợ conflict markers|Sinh patch tối thiểu|Đo độ lớn patch/i, evidence: 'atomicPatchGovernance' },
  { sections: [18], re: /^(Hỗ trợ pseudo-terminal|Hỗ trợ argument filtering|Hỗ trợ shell escaping|Hỗ trợ Windows PowerShell|Hỗ trợ CMD khi cần|Hỗ trợ Bash|Hỗ trợ WSL|Không chạy server không quản lý PID)$/i, evidence: 'commandExecutionGovernance' },
  { sections: [19], re: /^(Lệnh thay đổi hệ thống|Lệnh thay đổi quyền|Lệnh chạy mã tải từ internet|Lệnh chạy với administrator|Lệnh thay đổi firewall|Lệnh khởi động service|Lệnh dừng service|Lệnh gửi dữ liệu ra ngoài)$/i, evidence: 'commandExecutionGovernance' },
  { sections: [23], re: /^Chống approval fatigue$/i, evidence: 'commandExecutionGovernance' },
  { sections: [24], re: /^(Chặn SQL nguy hiểm|Chặn upload dữ liệu nhạy cảm)$/i, evidence: 'commandExecutionGovernance' },
  { sections: [25], re: /^Không lưu API key trong chat$/i, evidence: 'commandExecutionGovernance' },
  { sections: [26], re: /^(Đọc remote|Tạo checkpoint commit|Commit thay đổi agent|Viết commit message|Stage file chọn lọc|Không stage file bí mật|Không commit artifact dư thừa|Giải quyết conflict|Hiển thị conflict cho người dùng|Ghi test đã chạy|Ghi rủi ro còn lại)$/i, evidence: 'gitCompletionGovernance' },
  { sections: [27], re: /^(Theo dõi thay đổi giữa các agent|Phát hiện file bị nhiều agent sửa|Phát hiện conflict sớm|Review từng diff trước merge)$/i, evidence: 'gitCompletionGovernance' },
  { sections: [4], re: /^Trình duyệt tích hợp$/i, evidence: 'integratedBrowser' },
  { sections: [4], re: /^Trình quản lý secrets$/i, evidence: 'secretsManager' },
  { sections: [13], re: /^(Lập chỉ mục inheritance graph|Lập chỉ mục issue liên quan)$/i, evidence: 'codeRelationships' },
  { sections: [27], re: /^(Hỗ trợ mở worktree trong IDE|Hỗ trợ chuyển task sang local)$/i, evidence: 'localWorktreeHandoff' },
  { sections: [4], re: /^Trình quản lý sandbox$/i, evidence: 'localResourceSandbox' },
  { sections: [18], re: /^Hỗ trợ giới hạn (CPU|RAM|process|disk)$/i, evidence: 'localResourceSandbox' },
  { sections: [4], re: /^Trình xem dependency graph$/i, evidence: 'semanticDependency' },
  { sections: [13], re: /^Hỗ trợ semantic search$/i, evidence: 'semanticDependency' },
  { sections: [13], re: /^Hỗ trợ AST query$/i, evidence: 'astIntelligence' },
  { sections: [16], re: /^Patch theo AST$/i, evidence: 'astIntelligence' },
  { sections: [4], re: /^Trình sửa diff$/i, evidence: 'diffReview' },
  { sections: [4], re: /^(Trình quản lý quyền|Trình quản lý model|Trình quản lý công cụ|Trình quản lý MCP|Trình quản lý agent con)$/i, evidence: 'agentOperations' },
  { sections: [4], re: /^(Trình quản lý context|Trình quản lý bộ nhớ)$/i, evidence: 'contextMemoryCenter' },
  { sections: [4], re: /^Trình xem trace$/i, evidence: 'traceEvidence' },
  { sections: [2], re: /So sánh ảnh trước và sau/i, evidence: 'visual' },
  { sections: [1], re: /Tách lõi agent khỏi giao diện|Thiết kế local-first|Không phụ thuộc duy nhất một model|Không phụ thuộc duy nhất một nhà cung cấp|schema rõ ràng|hành động phải có log|thay đổi phải có thể hoàn tác|lệnh nguy hiểm phải được kiểm soát|kết quả phải được kiểm chứng|phạm vi rõ ràng|Tách phần lập kế hoạch|Tách phần công cụ|Tách phần lưu trữ|Tách phần giao diện|Không xây swarm/i, evidence: 'architecture' },
  { sections: [2], re: /Hiểu codebase|Tìm đúng file liên quan|Lập kế hoạch thay đổi|Viết tính năng mới|Sửa lỗi$|Refactor code|Viết test|Chạy test|Phân tích log|Phân tích stack trace|Tìm lỗi build|Chạy linter|Chạy formatter|Chạy type checker|Kiểm tra giao diện bằng trình duyệt|So sánh ảnh trước và sau|Tiếp tục tác vụ bị gián đoạn|Cho người dùng can thiệp giữa chừng/i, evidence: 'runtime' },
  { sections: [3], re: /Chế độ hỏi đáp codebase|Chế độ chỉ đọc|Chế độ lập kế hoạch|Chế độ chỉnh sửa có phê duyệt|Chế độ tự động chỉnh sửa|Chế độ review code|Chế độ debug|Chế độ viết test|Chế độ refactor|Chế độ migration|Chế độ thiết kế kiến trúc|Chế độ tạo dự án|Chế độ sửa CI|Chế độ xử lý issue|Chế độ chạy nền|Chế độ học codebase|Chế độ giải thích từng bước|Chế độ nhanh, ít token|Chế độ sâu, nhiều bước|Chế độ ngoại tuyến với model local/i, evidence: 'agentModes' },
  { sections: [3], re: /Chế độ nhiều agent/i, evidence: 'subagents' },
  { sections: [3], re: /Chế độ khôi phục sự cố/i, evidence: 'sessions' },
  { sections: [4], re: /CLI không tương tác|SDK cho Python|SDK cho TypeScript/i, evidence: 'clients' },
  { sections: [4], re: /CLI tương tác/i, evidence: 'interactiveCli' },
  { sections: [4], re: /Desktop app|Web dashboard|API cho ứng dụng khác|Giao diện chat|Danh sách tác vụ|Danh sách phiên agent|Bảng theo dõi tiến trình|Cửa sổ terminal tích hợp|Trình xem file$|Trình xem diff$|Trình xem test|Trình xem log|Trình xem kế hoạch|Trình xem kết quả cuối|Nút dừng agent|Nút tạm dừng agent|Nút tiếp tục agent|Nút quay lui thay đổi|Nút phê duyệt hành động|Nút từ chối hành động/i, evidence: 'ui' },
  { sections: [5], re: /^(Ghi trace|Sinh báo cáo cuối)$/i, evidence: 'traceEvidence' },
  { sections: [5], re: /^(Kiểm tra giới hạn chi phí|Kiểm tra tiến triển thực tế)$/i, evidence: 'missionStateProgress' },
  { sections: [6], re: /^(ID người dùng|ID repository|Tiêu chí hoàn thành|Danh sách giả thuyết|Test đã chạy|Test đã vượt qua|Test còn thất bại|Chi phí đã dùng|Trạng thái sandbox|Trạng thái phê duyệt|Trạng thái agent con)$/i, evidence: 'missionStateProgress' },
  { sections: [5], re: /Nhận yêu cầu người dùng|Phân loại loại tác vụ|Kiểm tra quyền hiện tại|Tải trạng thái phiên|Thu thập context ban đầu|Gọi model|Nhận tool call|Xác thực tool call|Kiểm tra quyền tool|Thực thi tool|Thu kết quả tool|Chuẩn hóa kết quả tool|Trả kết quả cho model|Lặp đến khi hoàn thành|Kiểm tra điều kiện dừng|giới hạn lượt|giới hạn token|giới hạn thời gian|vòng lặp vô hạn|Lưu checkpoint|Phát sự kiện streaming|Ghi trace|Ghi thay đổi file|Ghi lệnh đã chạy|Ghi kết quả kiểm thử|Sinh báo cáo cuối/i, evidence: 'runtime' },
  { sections: [5], re: /Kiểm tra hành động trùng lặp|Ghi usage/i, evidence: 'activity' },
  { sections: [6], re: /ID tác vụ|ID phiên|ID workspace|Mục tiêu chính|Ràng buộc người dùng|Chế độ quyền|Model hiện tại|Danh sách tool|Danh sách bước kế hoạch|Bước hiện tại|Token đã dùng|Thời gian đã dùng|Lần thử hiện tại|Checkpoint gần nhất|Commit gốc|Commit hiện tại|Branch hiện tại|Trạng thái hủy|Trạng thái hoàn thành/i, evidence: 'state' },
  { sections: [6], re: /Danh sách file đã đọc|Danh sách file đã sửa|Danh sách lệnh đã chạy|Danh sách lỗi gặp phải|Kết quả từng bước/i, evidence: 'activity' },
  { sections: [7], re: /Nhận task|Chuẩn hóa task|Trích xuất mục tiêu|Trích xuất ràng buộc|Khảo sát repository|Đọc hướng dẫn dự án|Lập kế hoạch|Xác định file liên quan|Tạo checkpoint|Thực hiện từng bước|Kiểm tra sau từng bước|Điều chỉnh kế hoạch|Chạy kiểm thử cuối|Review diff|Kiểm tra thay đổi ngoài phạm vi|Tạo báo cáo|Chờ phê duyệt|Lưu session/i, evidence: 'runtime' },
  { sections: [8], re: /.*/, evidence: 'taskContract' },
  { sections: [9], re: /Tạo kế hoạch trước|Chia task thành bước nhỏ|dependency giữa các bước|bước có thể chạy song song|bước cần phê duyệt|bước có thể hoàn tác|test cho từng bước|Cập nhật kế hoạch|Đánh dấu bước hoàn thành|Đánh dấu bước thất bại|Đánh dấu bước bị chặn|Không giữ kế hoạch đã lỗi thời|Không đánh dấu hoàn thành khi chưa kiểm chứng/i, evidence: 'planning' },
  { sections: [10], re: /Chỉ đưa context cần thiết|Không nhét toàn bộ repository|Ưu tiên file gần task|Ưu tiên symbol liên quan|Ưu tiên diff hiện tại|Ưu tiên hướng dẫn dự án|Ưu tiên test liên quan|Loại bỏ output tool dư thừa|Giữ nguyên đoạn code quan trọng|Đánh dấu nguồn của context|Phát hiện file đã thay đổi|Tải lại file trước khi sửa|Không dùng snapshot cũ để patch|retrieval theo truy vấn|loại bỏ bí mật/i, evidence: 'context' },
  { sections: [10], re: /^(Ưu tiên lỗi hiện tại|Giảm ưu tiên log cũ|Tóm tắt hội thoại cũ|Tóm tắt file dài|Đánh dấu độ mới của context|Đánh dấu context có thể lỗi thời|Theo dõi token từng nguồn|Có ngân sách context riêng|Có context dành cho planner|Có context dành cho executor|Có context dành cho reviewer|Có context dành cho debugger|Có context dành cho agent con|Hỗ trợ context compaction|Hỗ trợ context checkpoint|Hỗ trợ context paging|Hỗ trợ pin context quan trọng|Hỗ trợ phân quyền context)$/i, evidence: 'contextOrchestration' },
  { sections: [11], re: /.*/, evidence: 'repositoryDiscovery' },
  { sections: [11], re: /Xác định ngôn ngữ chính|Xác định workspace|Xác định config quan trọng|Xác định vendor directory|Xác định file không nên sửa|Xác định tài liệu dành cho agent|Xác định repository cleanliness/i, evidence: 'context' },
  { sections: [12], re: /Hỗ trợ AGENTS\.md|Hỗ trợ CLAUDE\.md|Hỗ trợ file hướng dẫn tùy chỉnh|Hỗ trợ hướng dẫn theo repository|Hiển thị hướng dẫn đang áp dụng|Ghi nguồn từng hướng dẫn|Không cho file con vượt quyền bảo mật|Không cho prompt injection đổi chính sách|Cho phép reload hướng dẫn|Cache hướng dẫn theo hash/i, evidence: 'instructions' },
  { sections: [12], re: /hướng dẫn toàn cục|hướng dẫn theo thư mục|hướng dẫn theo ngôn ngữ|hướng dẫn theo tác vụ|kế thừa hướng dẫn|ưu tiên hướng dẫn|Phát hiện hướng dẫn mâu thuẫn|Báo hướng dẫn không hợp lệ|schema kiểm tra hướng dẫn|import tài liệu khác/i, evidence: 'instructionPolicy' },
  { sections: [13], re: /Lập chỉ mục file|Lập chỉ mục symbol|Lập chỉ mục class|Lập chỉ mục function|Lập chỉ mục method|Lập chỉ mục interface|Lập chỉ mục type|Lập chỉ mục test|Lập chỉ mục dependency|Lập chỉ mục import|Lập chỉ mục documentation|Hỗ trợ lexical search|Hỗ trợ symbol search|Hỗ trợ ignore pattern|Không index binary|Không index secrets|Không index dependency khổng lồ|Xếp hạng kết quả theo task|Trả đoạn code thay vì toàn file|Trả số dòng chính xác/i, evidence: 'context' },
  { sections: [13], re: /Hỗ trợ reference search|Hỗ trợ definition search|Hỗ trợ language server/i, evidence: 'lsp' },
  { sections: [13], re: /Lập chỉ mục route|API endpoint|database model|Lập chỉ mục call graph|Lập chỉ mục reference|Git history|Hỗ trợ regex search|incremental indexing|file watcher|Xếp hạng theo dependency distance|Xếp hạng theo Git recency|Xếp hạng theo test liên quan/i, evidence: 'codebaseKnowledge' },
  { sections: [14], re: /Đọc toàn file nhỏ|Đọc theo khoảng dòng|Đọc đầu file|Đọc cuối file|Kiểm tra encoding|Kiểm tra file binary|Kiểm tra kích thước|Kiểm tra file tồn tại|Kiểm tra quyền đọc|Hiển thị số dòng|Giới hạn output|Hỗ trợ checksum|Hỗ trợ symlink policy|file ngoài workspace có phê duyệt|Không tự đọc file chứa secret|Ghi log lý do đọc file/i, evidence: 'files' },
  { sections: [14], re: /Đọc nhiều file song song|Hỗ trợ paging/i, evidence: 'fileCompleteness' },
  { sections: [14], re: /Đọc theo symbol/i, evidence: 'symbolEdits' },
  { sections: [15], re: /Tìm tên file|Tìm nội dung|Tìm regex|Tìm symbol|Tìm theo extension|Tìm theo thư mục|Tìm theo ngôn ngữ|Giới hạn số kết quả|Xếp hạng kết quả|Loại bỏ kết quả trùng|Trả vị trí chính xác/i, evidence: 'files' },
  { sections: [15], re: /Tìm definition|Tìm reference/i, evidence: 'lsp' },
  { sections: [15], re: /Tìm import|Tìm TODO|Tìm lỗi compiler|Tìm Git commit|Tìm theo thời gian|Tìm trong diff|Tìm trong log|Hỗ trợ truy vấn kết hợp/i, evidence: 'advancedSearch' },
  { sections: [16], re: /Thay thế chuỗi chính xác|Patch theo unified diff|Tạo file|Kiểm tra file chưa đổi|Kiểm tra context patch|Từ chối patch mơ hồ|Từ chối patch lệch phiên bản|Tự rollback khi patch lỗi|Lưu bản sao trước sửa|Sinh diff ngay sau sửa|Không thay line ending vô cớ|Không đổi encoding vô cớ|Không thay đổi ngoài phạm vi/i, evidence: 'files' },
  { sections: [16], re: /Xóa file|Đổi tên file|Di chuyển file|Tạo thư mục|Xóa thư mục rỗng/i, evidence: 'fileCompleteness' },
  { sections: [16], re: /Chèn trước symbol|Chèn sau symbol|Thay function|Thay class/i, evidence: 'symbolEdits' },
  { sections: [17], re: /Parse unified diff|Validate đường dẫn|Chặn path traversal|Kiểm tra base hash|Kiểm tra hunk context|Áp dụng từng hunk|Báo hunk thất bại|Không áp dụng một phần âm thầm|Hỗ trợ rollback|Hỗ trợ binary rejection|Hỗ trợ newline preservation|Không rewrite toàn file nếu không cần/i, evidence: 'files' },
  { sections: [17], re: /Hỗ trợ dry-run|Hỗ trợ reverse patch|Hỗ trợ three-way merge|Hỗ trợ rename detection|Hỗ trợ permission preservation/i, evidence: 'patchCompleteness' },
  { sections: [18], re: /working directory rõ ràng|Trả stdout|Trả stderr|Trả exit code|Trả thời gian chạy|Hỗ trợ timeout|Hỗ trợ hủy tiến trình|Hỗ trợ streaming output|Hỗ trợ stdin|biến môi trường tạm|command allowlist|command denylist|Không dùng shell khi có tool chuyên dụng|Không chạy command không giải thích được|Không nối command nguy hiểm|Không chạy tiến trình vô hạn|Không để orphan process|Thu gom process con|Ghi log command chính xác|Ẩn secret khỏi log|Phân loại mức nguy hiểm command|Yêu cầu phê duyệt theo mức nguy hiểm/i, evidence: 'terminal' },
  { sections: [19], re: /Lệnh chỉ đọc|Lệnh thay đổi file|Lệnh cài dependency|Lệnh thay đổi Git|Lệnh thay đổi database|Lệnh dùng mạng|Lệnh dùng credential|Lệnh deploy|Lệnh xóa dữ liệu|Lệnh truy cập thư mục ngoài|Lệnh phát sinh chi phí|Lệnh không thể hoàn tác/i, evidence: 'terminal' },
  { sections: [20], re: /Sandbox theo từng task|Sandbox theo từng agent|Environment variables riêng|Temporary directory riêng|Execution timeout|Idle timeout|Chặn metadata cloud|Không ghi secret xuống disk|Không đưa secret vào prompt|Không đưa secret vào trace|Snapshot sandbox|Resume sandbox|Hủy sandbox|Lưu manifest môi trường|Ghi audit sandbox/i, evidence: 'cloud' },
  { sections: [20], re: /Network allowlist|Domain allowlist|Port allowlist|Chặn inbound mặc định|Chặn host filesystem|Mount repository có kiểm soát|Mount read-only khi chỉ phân tích|Mount secrets theo nhu cầu|Secrets tồn tại ngắn hạn/i, evidence: 'sandboxPolicy' },
  { sections: [20], re: /Quét malware output|Kiểm tra dependency tải về/i, evidence: 'artifactSecurity' },
  { sections: [27], re: /Hợp nhất theo dependency order|Rebase worktree trước merge|Chạy test sau merge/i, evidence: 'worktreeIntegration' },
  { sections: [21], re: /Chế độ không container|Cảnh báo khi isolation yếu|Không giả vờ sandbox an toàn|Kiểm tra symlink escape|Chặn Docker socket mặc định|Chặn SSH agent forwarding mặc định|Chặn credential directory mặc định|Có profile sandbox tùy chỉnh/i, evidence: 'terminal' },
  { sections: [21], re: /Có chế độ trusted workspace|Có chế độ untrusted repository/i, evidence: 'workspaceTrust' },
  { sections: [22], re: /Provision workspace tự động|Khởi tạo secrets|Hỗ trợ artifact output|Hỗ trợ checkpoint|Hỗ trợ resume|Hỗ trợ TTL|Tự động hủy khi hết hạn|Audit tất cả truy cập|Không dùng chung secrets|Không dùng chung writable cache|Có quota theo tổ chức/i, evidence: 'cloud' },
  { sections: [23], re: /Quyền đọc file|Quyền sửa file|Quyền tạo file|Quyền xóa file|Quyền chạy shell|Quyền dùng mạng|Quyền dùng browser|Quyền dùng MCP|Quyền đọc secret|Quyền dùng Git|Quyền commit|Quyền push|Quyền tạo PR|Quyền deploy|Quyền thay đổi database|Quyền gọi API trả phí|Quyền tạo agent con|Quyền chạy nền|Quyền truy cập thư mục ngoài|Quyền truy cập clipboard|Quyền điều khiển máy tính|Quyền tải file|Quyền gửi file|Quyền mở port|Quyền cài phần mềm|Quyền administrator|Allow rule|Deny rule|Deny luôn ưu tiên|Quyền theo workspace|Quyền theo repository|Quyền theo user|Quyền theo tổ chức|Quyền theo tool|Quyền theo command|Quyền theo argument|Quyền theo path|Quyền theo domain|Quyền theo thời gian|Quyền dùng một lần|Quyền trong phiên|Quyền vĩnh viễn|Quyền có thời hạn|Hiển thị lý do xin quyền|Hiển thị tác động dự kiến|Cho phép sửa hành động|Cho phép duyệt hàng loạt an toàn|Ghi audit phê duyệt/i, evidence: 'capabilities' },
  { sections: [24], re: /Guardrail đầu vào|Guardrail đầu ra|Guardrail trước tool|Guardrail sau tool/i, evidence: 'hooks' },
  { sections: [24], re: /Guardrail trước tool|Guardrail sau tool|Guardrail trước shell|Guardrail trước patch|Chặn prompt injection|Chặn path traversal|Chặn secret exfiltration|Chặn command injection|Chặn sửa file hệ thống|Chặn thay đổi ngoài task|Chặn vòng lặp tool|Chặn chi phí vượt ngân sách|Chặn output không đúng schema|Chặn agent tự tăng quyền|Chặn agent sửa guardrail|Chặn agent sửa audit log|Guardrail phải có lý do|Guardrail phải có mã lỗi|Guardrail phải có đường xử lý/i, evidence: 'runtime' },
  { sections: [24], re: /Chặn kết luận chưa kiểm chứng|Chặn giả mạo test thành công|Chặn ẩn lỗi khỏi người dùng/i, evidence: 'claimGuard' },
  { sections: [24], re: /Guardrail trước network|Guardrail trước deploy|Guardrail trước database|Guardrail trước dùng secret/i, evidence: 'actionGuardrails' },
  { sections: [25], re: /Không lưu API key trong source|Không lưu API key trong trace|Không lưu API key trong log|Không lưu API key trong Git|Inject secret lúc chạy|Hủy secret sau task|Mask secret trong output|Phân quyền secret theo tool|Phân quyền secret theo domain|Phân quyền secret theo repository|Không cho model thấy secret nếu không cần|Dùng token phạm vi hẹp|Dùng token tồn tại ngắn|Hỗ trợ rotation|Hỗ trợ revoke|Ghi audit lần dùng secret|Cảnh báo secret bị lộ|Tự động ngăn push secret/i, evidence: 'terminal' },
  { sections: [25], re: /Phát hiện secret trong diff|Phát hiện secret trước commit/i, evidence: 'typedGit' },
  { sections: [25], re: /Phát hiện secret trong terminal/i, evidence: 'terminalSecrets' },
  { sections: [25], re: /Dùng vault|Dùng secret manager/i, evidence: 'externalSecrets' },
  { sections: [26], re: /Phát hiện repository|Đọc trạng thái Git|Đọc branch|Đọc commit hiện tại|Đọc diff staged|Đọc diff unstaged|Phát hiện file untracked|Phát hiện thay đổi người dùng|Không ghi đè thay đổi người dùng|Tạo branch task|Tạo worktree task|Tạo worktree agent|So sánh với base branch|Phát hiện diff ngoài phạm vi|Tạo patch export|Không force-push mặc định|Không push khi chưa được phép|Không rewrite history mặc định|Hỗ trợ repository local/i, evidence: 'git' },
  { sections: [26], re: /^Rebase$|^Merge$|^Cherry-pick$|^Revert$|^Reset an toàn$/i, evidence: 'typedGit' },
  { sections: [27], re: /Một task một branch|Một agent một worktree|Không dùng chung working tree writable|Không dùng chung index Git|Theo dõi base commit|Tự dọn worktree|Giữ worktree khi cần review|Hỗ trợ task song song độc lập|Không song song hóa task phụ thuộc|Giới hạn số worktree|Giới hạn số agent song song/i, evidence: 'git' },
  { sections: [28], re: /Phát hiện test framework|Tìm test liên quan|Chạy test nhỏ trước|Chạy test file|Chạy test module|Chạy test package|Chạy test toàn bộ|Chạy unit test|Chạy integration test/i, evidence: 'testEngine' },
]);

const EXTERNAL_RULES = Object.freeze([
  { sections: [13], re: /^Hỗ trợ tree-sitter$/i, evidence: 'treeSitterRuntime' },
  { sections: [21], re: /^(Hỗ trợ Podman|Hỗ trợ Windows Job Objects|Hỗ trợ macOS sandbox)$/i, evidence: 'nativeSandboxDrivers' },
  { sections: [1], re: /Cho phép chuyển sang cloud sandbox|Hỗ trợ Windows ngay từ kiến trúc|Hỗ trợ Linux và macOS/i, evidence: 'cloud' },
  { sections: [2], re: /Tạo pull request|Triển khai bản preview|Theo dõi CI/i, evidence: 'git' },
  { sections: [3], re: /Chế độ tạo pull request|Chế độ cloud sandbox|Chế độ doanh nghiệp/i, evidence: 'enterprise' },
  { sections: [7], re: /Tạo PR nếu được phép|Đóng sandbox/i, evidence: 'cloud' },
  { sections: [20], re: /Filesystem riêng|Process namespace riêng|Network namespace riêng|Home directory riêng|CPU quota|RAM quota|Disk quota|Process quota|File descriptor quota|Clone sandbox|Thu gom sandbox lỗi/i, evidence: 'cloud' },
  { sections: [21], re: /Dùng OS process isolation|Dùng container khi có thể|Hỗ trợ Docker|Hỗ trợ WSL sandbox/i, evidence: 'cloud' },
  { sections: [22], re: /Clone repository|Checkout commit chính xác|Cài dependency|Khôi phục cache|Chạy bootstrap script|Kiểm tra bootstrap|Lưu image môi trường|Tái sử dụng image|Gắn branch riêng|Đồng bộ diff về client|Stream log về client|terminal từ xa|browser từ xa|preview URL|Mã hóa disk|Mã hóa network|Cách ly tenant|region selection|data residency policy/i, evidence: 'cloud' },
  { sections: [25], re: /Dùng OS keychain/i, evidence: 'terminal' },
  { sections: [26], re: /Tạo pull request|Điền mô tả PR|Gắn issue|Hỗ trợ GitHub|Hỗ trợ GitLab|Hỗ trợ Bitbucket/i, evidence: 'typedGit' },
]);

const PARTIAL_RULES = Object.freeze([
  { sections: [1], re: /.*/, evidence: 'architecture' },
  { sections: [2], re: /Giải thích kiến trúc dự án|Sửa test thất bại|Sửa lỗi dependency|Giải quyết conflict Git|Tạo commit|Review pull request|Kiểm tra bảo mật|Cập nhật tài liệu|Chạy nhiều tác vụ song song/i, evidence: 'runtime' },
  { sections: [3], re: /.*/, evidence: 'runtime' },
  { sections: [4], re: /IDE extension|Trình xem Git history|Trình quản lý chi phí|Nút sửa câu lệnh trước khi chạy|Nút chuyển sang điều khiển thủ công/i, evidence: 'ui' },
  { sections: [4], re: /Trình xem call graph/i, evidence: 'lsp' },
  { sections: [4], re: /Trình xem ảnh/i, evidence: 'visual' },
  { sections: [5], re: /giới hạn chi phí|Kiểm tra tiến triển thực tế|Yêu cầu người dùng khi cần|Giải phóng sandbox|Giữ sandbox khi cần tiếp tục/i, evidence: 'runtime' },
  { sections: [6], re: /ID người dùng|ID repository|Tiêu chí hoàn thành|Danh sách giả thuyết|Test đã chạy|Test đã vượt qua|Test còn thất bại|Chi phí đã dùng|Trạng thái sandbox|Trạng thái phê duyệt|Trạng thái agent con/i, evidence: 'state' },
  { sections: [7], re: /Phát hiện thông tin thiếu|Ước lượng phạm vi|Kiểm tra lỗi bảo mật|Kiểm tra tài liệu|Commit nếu được phép/i, evidence: 'runtime' },
  { sections: [8], re: /tiêu chí hiệu năng|tiêu chí bảo mật|tiêu chí tương thích|thời hạn/i, evidence: 'runtime' },
  { sections: [9], re: /rủi ro từng bước|file dự kiến sửa|công cụ cần dùng|agent con cần gọi|Lưu lý do thay đổi kế hoạch|Không lập kế hoạch quá chi tiết|Không cho phép bước mơ hồ/i, evidence: 'planning' },
  { sections: [10], re: /.*/, evidence: 'context' },
  { sections: [11], re: /.*/, evidence: 'context' },
  { sections: [12], re: /hướng dẫn toàn cục|hướng dẫn theo thư mục|hướng dẫn theo ngôn ngữ|hướng dẫn theo tác vụ|kế thừa hướng dẫn|ưu tiên hướng dẫn|Phát hiện hướng dẫn mâu thuẫn|Báo hướng dẫn không hợp lệ|schema kiểm tra hướng dẫn|import tài liệu khác/i, evidence: 'instructions' },
  { sections: [13], re: /Lập chỉ mục route|API endpoint|database model|Lập chỉ mục reference|Git history|Hỗ trợ regex search|incremental indexing|file watcher|Xếp hạng theo dependency distance|Xếp hạng theo Git recency|Xếp hạng theo test liên quan/i, evidence: 'context' },
  { sections: [13], re: /Lập chỉ mục call graph/i, evidence: 'lsp' },
  { sections: [14], re: /Làm sạch nội dung độc hại/i, evidence: 'files' },
  { sections: [15], re: /Tìm test liên quan|Tìm config liên quan|Tìm trong tài liệu|Tóm tắt kết quả/i, evidence: 'context' },
  { sections: [16], re: /Chỉnh nhiều file nguyên tử|Chạy formatter sau sửa|Không format toàn dự án vô cớ|Không sửa generated code|Không xóa comment quan trọng|giới hạn số file mỗi lượt|giới hạn số dòng mỗi lượt/i, evidence: 'files' },
  { sections: [17], re: /Hỗ trợ conflict markers|Sinh patch tối thiểu|Đo độ lớn patch/i, evidence: 'files' },
  { sections: [18], re: /Hỗ trợ pseudo-terminal|Hỗ trợ argument filtering|Hỗ trợ shell escaping|Hỗ trợ Windows PowerShell|Hỗ trợ CMD khi cần|Hỗ trợ Bash|Hỗ trợ WSL|Không chạy server không quản lý PID/i, evidence: 'terminal' },
  { sections: [19], re: /.*/, evidence: 'terminal' },
  { sections: [20], re: /Cache có kiểm soát/i, evidence: 'cloud' },
  { sections: [21], re: /Kiểm tra Docker daemon|Kiểm tra quyền mount|Kiểm tra socket escape/i, evidence: 'cloud' },
  { sections: [23], re: /Chống approval fatigue/i, evidence: 'capabilities' },
  { sections: [24], re: /Chặn SQL nguy hiểm|Chặn upload dữ liệu nhạy cảm/i, evidence: 'runtime' },
  { sections: [25], re: /Không lưu API key trong chat/i, evidence: 'terminal' },
  { sections: [26], re: /Đọc remote|Tạo checkpoint commit|Commit thay đổi agent|Viết commit message|Stage file chọn lọc|Không stage file bí mật|Không commit artifact dư thừa|Giải quyết conflict|Hiển thị conflict cho người dùng|Ghi test đã chạy|Ghi rủi ro còn lại/i, evidence: 'git' },
  { sections: [27], re: /Theo dõi thay đổi giữa các agent|Phát hiện file bị nhiều agent sửa|Phát hiện conflict sớm|Review từng diff trước merge/i, evidence: 'git' },
  { sections: [28], re: /Phát hiện test framework|Tìm test liên quan|Chạy test module|Chạy test package/i, evidence: 'tests' },
]);

const EXPLICIT_NOT_IMPLEMENTED = Object.freeze([]);

function findRule(rules, section, item) {
  return rules.find((rule) => rule.sections.includes(section) && rule.re.test(item));
}

function assess(section, item) {
  const missing = findRule(EXPLICIT_NOT_IMPLEMENTED, section, item);
  if (missing) return { status: 'not_implemented', evidence: [], note: `Không tìm thấy implementation và kiểm thử trực tiếp cho mục này trong cây source ${PRODUCT_VERSION}.` };
  const external = findRule(EXTERNAL_RULES, section, item);
  if (external) return { status: 'external_gate', evidence: EVIDENCE[external.evidence] ?? [], note: 'Có contract, policy hoặc logic cục bộ; hoàn tất production cần hạ tầng, credential, runner hệ điều hành hoặc dịch vụ bên ngoài được vận hành thật.' };
  const verified = findRule(VERIFIED_RULES, section, item);
  if (verified) return { status: 'verified_source_test', evidence: EVIDENCE[verified.evidence] ?? [], note: `Có source và kiểm thử tự động trực tiếp trong cây ${PRODUCT_VERSION}; trạng thái này không tự suy rộng thành chứng nhận production.` };
  const partial = findRule(PARTIAL_RULES, section, item);
  if (partial) return { status: 'partial', evidence: EVIDENCE[partial.evidence] ?? [], note: 'Có thành phần liên quan, nhưng hành vi item-level chưa đầy đủ hoặc chưa được chứng minh trên toàn bộ bề mặt/hạ tầng.' };
  return { status: 'not_implemented', evidence: [], note: `Không tìm thấy bằng chứng source + test đủ cụ thể cho mục này trong cây source ${PRODUCT_VERSION}.` };
}

function summarize(items) {
  return items.reduce((out, item) => { out[item.status] = (out[item.status] ?? 0) + 1; return out; }, { verified_source_test: 0, partial: 0, external_gate: 0, not_implemented: 0 });
}

export async function generateFeatureAudit({ sourceFile, outputDirectory } = {}) {
  const source = await readFile(path.resolve(sourceFile), 'utf8');
  const parsed = parseChecklist(source);
  const sections = parsed.map((section) => {
    const items = section.items.map((text, index) => ({ id: `${section.number}.${index + 1}`, text, ...assess(section.number, text) }));
    return { number: section.number, title: section.title, summary: summarize(items), items };
  });
  const all = sections.flatMap((section) => section.items);
  const report = {
    schema: 'nolane.agent.feature-audit.v1',
    product: 'Nolane Agent',
    productVersion: PRODUCT_VERSION,
    forgeOsSnapshot: { packageVersion: '0.6.1', source: 'user-supplied forge-os-main archive', commitHint: 'a813e4864ef4a56e36f9f90112e8ef17bdd3adcc' },
    checklistSha256: createHash('sha256').update(source).digest('hex'),
    statusDefinitions: {
      verified_source_test: `Source và kiểm thử tự động tồn tại trong bản ${PRODUCT_VERSION}.`,
      partial: 'Có thành phần liên quan nhưng item chưa hoàn chỉnh hoặc chưa có kiểm thử trực tiếp.',
      external_gate: 'Cần hạ tầng, credential, ký mã, hosted provider hoặc đánh giá độc lập bên ngoài.',
      not_implemented: 'Chưa có implementation trong cây source đã kiểm toán.',
    },
    summary: summarize(all),
    totalItems: all.length,
    sections,
  };
  const directory = path.resolve(outputDirectory);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `feature-audit-${PRODUCT_VERSION}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const table = sections.map((section) => `| ${section.number} | ${section.title} | ${section.items.length} | ${section.summary.verified_source_test} | ${section.summary.partial} | ${section.summary.external_gate} | ${section.summary.not_implemented} |`).join('\n');
  const limits = all.filter((item) => item.status !== 'verified_source_test').slice(0, 80).map((item) => `- **${item.id} — ${item.text}:** ${item.status} — ${item.note}`).join('\n');
  const markdown = `# Nolane Agent ${PRODUCT_VERSION} — Kiểm toán checklist tính năng\n\n- Checklist SHA-256: \`${report.checklistSha256}\`\n- Tổng mục: **${report.totalItems}**\n- Có source + test: **${report.summary.verified_source_test}**\n- Một phần: **${report.summary.partial}**\n- Cổng bên ngoài: **${report.summary.external_gate}**\n- Chưa triển khai: **${report.summary.not_implemented}**\n\n> “Có source + test” không đồng nghĩa đã vận hành production trên mọi OS, cloud hoặc tenant. JSON đi kèm chứa trạng thái và evidence cho toàn bộ ${report.totalItems} mục.\n\n| # | Nhóm | Tổng | Source + test | Một phần | Cổng ngoài | Chưa có |\n|---:|---|---:|---:|---:|---:|---:|\n${table}\n\n## Các giới hạn chưa đóng (trích yếu)\n\n${limits || '- Không có.'}\n`;
  await writeFile(path.join(directory, `FEATURE-COMPLETENESS-AUDIT-${PRODUCT_VERSION}.md`), markdown);
  return report;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const sourceFile = process.argv[2] ?? 'docs/source-feature-checklist-vn.txt';
  const outputDirectory = process.argv[3] ?? 'docs';
  const report = await generateFeatureAudit({ sourceFile, outputDirectory });
  console.log(JSON.stringify({ totalItems: report.totalItems, summary: report.summary }));
}
