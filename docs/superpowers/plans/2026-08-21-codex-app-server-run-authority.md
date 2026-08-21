# Codex App Server Run Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Full-access Nolane Agent run reach Codex App Server with full
authority while every other App Server session remains fail-closed.

**Architecture:** A pure resolver translates persisted task mode metadata into
an immutable Codex policy. AgentLoop passes it only to Codex App Server,
ProviderRegistry persists it in a logical session scope, and the adapter binds
it to the server thread for sandbox and approval decisions.

**Tech Stack:** Node.js ESM, `node:test`, JSON-RPC fixture.

**Spec:** `docs/superpowers/specs/2026-08-21-codex-app-server-run-authority-design.md`

## Global Constraints

- Missing, malformed, and resumed policy must be read-only and declined.
- Only a validated persisted `deep` mode can receive automatic approval.
- Do not alter non-Codex providers, Electron packaging, or release signing.
- Follow RED–GREEN before every production code change.

---

### Task 1: Derive bounded authority

**Files:**
- Create: `src/providers/codex-app-server-execution-policy.mjs`
- Test: `tests/codex-app-server-execution-policy.test.mjs`

**Interfaces:**
- Produces `resolveCodexAppServerExecutionPolicy(task)`.
- Consumes `task.metadata.modeId` and `task.metadata.modePolicy`.

- [ ] **Step 1: Write the failing test**

```js
assert.deepEqual(resolveCodexAppServerExecutionPolicy(deepTask), {
  modeId: 'deep', sandboxPolicy: { type: 'dangerFullAccess' }, automaticApproval: true,
});
assert.equal(resolveCodexAppServerExecutionPolicy({ metadata: {} }).automaticApproval, false);
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node --test tests/codex-app-server-execution-policy.test.mjs`
Expected: module-not-found failure.

- [ ] **Step 3: Add the minimal resolver**

```js
export function resolveCodexAppServerExecutionPolicy(task) {
  const metadata = task?.metadata ?? {};
  const mode = metadata.modePolicy;
  if (metadata.modeId === 'deep' && mode?.id === 'deep' && mode.writesAllowed === true && mode.commitPolicy === 'allow') {
    return Object.freeze({ modeId: 'deep', sandboxPolicy: Object.freeze({ type: 'dangerFullAccess' }), automaticApproval: true });
  }
  return Object.freeze({ modeId: null, sandboxPolicy: Object.freeze({ type: 'readOnly' }), automaticApproval: false });
}
```

- [ ] **Step 4: Run the test and observe GREEN**

Run: `node --test tests/codex-app-server-execution-policy.test.mjs`
Expected: PASS.

### Task 2: Propagate only to Codex App Server

**Files:**
- Modify: `src/agent/agent-loop.mjs`
- Modify: `src/providers/provider-registry.mjs`
- Test: `tests/agent-loop.test.mjs`
- Test: `tests/provider-registry.test.mjs`

**Interfaces:**
- Consumes `resolveCodexAppServerExecutionPolicy(task)`.
- Produces `request.codexAppServerExecutionPolicy` and matching session scope.

- [ ] **Step 1: Write failing boundary tests**

```js
assert.deepEqual(request.codexAppServerExecutionPolicy.sandboxPolicy, { type: 'dangerFullAccess' });
assert.equal(openScope.codexAppServerExecutionPolicy.automaticApproval, true);
```

- [ ] **Step 2: Run the tests and observe RED**

Run: `node --test tests/agent-loop.test.mjs tests/provider-registry.test.mjs`
Expected: missing policy assertions fail.

- [ ] **Step 3: Add minimal propagation**

```js
const policy = provider.kind === 'codex-app-server'
  ? resolveCodexAppServerExecutionPolicy(task) : null;
response = await provider.complete({ /* existing fields */, ...(policy ? { codexAppServerExecutionPolicy: policy } : {}) });
```

```js
scope: { projectId, missionId, taskId, repositoryId, workspaceHash,
  ...(request.codexAppServerExecutionPolicy ? { codexAppServerExecutionPolicy: request.codexAppServerExecutionPolicy } : {}) }
```

- [ ] **Step 4: Run the tests and observe GREEN**

Run: `node --test tests/agent-loop.test.mjs tests/provider-registry.test.mjs`
Expected: PASS.

### Task 3: Bind policy to Codex threads

**Files:**
- Modify: `src/providers/codex-app-server.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/fixtures/codex-app-server.mjs`
- Test: `tests/codex-app-server.test.mjs`

**Interfaces:**
- Consumes `scope.codexAppServerExecutionPolicy`.
- Produces a session `executionPolicy`; the approval handler receives it.

- [ ] **Step 1: Write the failing adapter test**

```js
const session = await codex.openSession({ scope: { codexAppServerExecutionPolicy: fullPolicy } });
await codex.completeInSession(session, { messages: [{ role: 'user', content: 'write' }] });
assert.equal(approvals[0].automaticApproval, true);
assert.deepEqual(calls.map((call) => call.sandbox), ['danger-full-access']);
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node --test tests/codex-app-server.test.mjs`
Expected: adapter has forced read-only policy and handler lacks authority.

- [ ] **Step 3: Add minimal thread-bound policy handling**

```js
const executionPolicy = normalizeExecutionPolicy(scope.codexAppServerExecutionPolicy);
const thread = await this.startThread({ sandboxPolicy: executionPolicy.sandboxPolicy, approvalPolicy: 'untrusted', executionPolicy });
return Object.freeze({ id: thread.id, threadId: thread.id, cwd, executionPolicy });
```

```js
approvalHandler: async (request) => ({ decision: request.executionPolicy?.automaticApproval === true ? 'accept' : 'decline' })
```

- [ ] **Step 4: Run the test and observe GREEN**

Run: `node --test tests/codex-app-server.test.mjs`
Expected: PASS, including current read-only and effort tests.

### Task 4: Verify and publish

**Files:**
- Modify: none unless a direct test failure requires a narrow correction.

**Interfaces:**
- Consumes the three authority boundaries.
- Produces one verified GitHub PR.

- [ ] **Step 1: Run focused verification**

Run: `node --test tests/codex-app-server-execution-policy.test.mjs tests/agent-loop.test.mjs tests/provider-registry.test.mjs tests/codex-app-server.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run full verification**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Check patch quality**

Run: `git diff --check github/main...HEAD`
Expected: no output.

- [ ] **Step 4: Publish and verify the PR**

Run: `git push origin HEAD` then create one PR for
`fix/codex-app-server-authority`; merge only after every required GitHub check
succeeds.
