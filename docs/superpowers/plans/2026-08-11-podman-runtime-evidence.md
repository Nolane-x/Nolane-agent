# Podman Runtime Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub Actions execute and retain evidence for one real, bounded Podman sandbox lifecycle on Linux without claiming any unrelated external gate.

**Architecture:** A runner-gated Node integration test imports the existing production driver, creates an isolated `busybox:1.36` container, inspects only its declared isolation contract, and removes it in `finally`. The existing `external-gates.yml` workflow installs Podman and invokes the test solely on Linux; the existing artifact collector remains the receipt publisher.

**Tech Stack:** Node.js 24 ESM, `node:test`, `node:child_process.execFile`, production `PodmanSandboxDriver`, GitHub Actions Ubuntu runners, Podman.

## Global Constraints

- Do not build, package, smoke, sign, or release Electron.
- Do not use cloud credentials, GitHub write permissions, browser credentials, or host secrets.
- The real test runs only when `NOLANE_RUNTIME_PODMAN_GATE=1`; all other environments skip it.
- Use argument vectors; never build a shell command string.
- Delete only the test's own `mkdtemp` directory and uniquely named temporary container.
- Do not change any external-gate status count from a mocked observation.

---

### Task 1: Declare the GitHub runner contract

**Files:**

- Modify: `tests/external-gate-workflow.test.mjs`
- Modify: `.github/workflows/external-gates.yml`

**Interfaces:**

- Consumes: the `runner-evidence` matrix with `matrix.slug == 'linux'`.
- Produces: one Linux-only step called `Run real Podman sandbox gate`.

- [x] **Step 1: Write the failing workflow assertion**

```js
assert.match(workflow, /name:\s*Run real Podman sandbox gate[\s\S]*if:\s*matrix\.slug == 'linux'[\s\S]*NOLANE_RUNTIME_PODMAN_GATE:\s*'1'[\s\S]*node --test tests\/podman-runtime-evidence\.test\.mjs/);
assert.doesNotMatch(workflow, /electron-builder|build:electron|smoke:packaged|release:matrix/);
```

- [x] **Step 2: Run RED**

Run: `node --test tests/external-gate-workflow.test.mjs`

Expected: FAIL because the real Podman step is absent.

- [x] **Step 3: Add the minimal Linux-only step**

```yaml
      - name: Run real Podman sandbox gate
        if: matrix.slug == 'linux'
        env:
          NOLANE_RUNTIME_PODMAN_GATE: '1'
        run: node --test tests/podman-runtime-evidence.test.mjs
```

- [x] **Step 4: Run GREEN**

Run: `node --test tests/external-gate-workflow.test.mjs`

Expected: PASS without invoking Podman locally.

- [x] **Step 5: Commit**

```bash
git add tests/external-gate-workflow.test.mjs .github/workflows/external-gates.yml
git commit -m "test: require real Podman gate workflow"
```

### Task 2: Exercise the production driver against real Podman

**Files:**

- Create: `tests/podman-runtime-evidence.test.mjs`
- Test: `tests/podman-runtime-evidence.test.mjs`

**Interfaces:**

- Consumes: `PodmanSandboxDriver#create`, `.start`, and `.remove`.
- Produces: runner-only evidence that lifecycle cleanup and container security settings are real.

- [x] **Step 1: Write the runner-gated test**

```js
test('real Podman executes the bounded sandbox contract', { skip: process.env.NOLANE_RUNTIME_PODMAN_GATE !== '1' }, async () => {
  const sandbox = await driver.create({ id, image: 'docker.io/library/busybox:1.36', workspaceRoot, limits: { cpuPercent: 100, memoryBytes: 134217728, processCount: 32 }, command: ['/bin/true'] });
  await driver.start(sandbox.containerId);
  const inspected = await inspect(sandbox.containerId);
  assert.equal(inspected.HostConfig.NetworkMode, 'none');
  assert.equal(inspected.HostConfig.ReadonlyRootfs, true);
});
```

- [x] **Step 2: Run locally**

Run: `node --test tests/podman-runtime-evidence.test.mjs`

Expected: SKIP with no image pull, container, or temporary directory.

- [x] **Step 3: Implement bounded inspection and cleanup**

```js
const run = (args) => execFileAsync('podman', args, { timeout: 30_000, maxBuffer: 256_000 });
const inspect = async (containerId) => JSON.parse((await run(['inspect', containerId, '--format', 'json'])).stdout)[0];
```

Use `mkdtemp`. In `finally`, call `driver.remove(containerId)` when assigned and `rm(workspaceRoot, { recursive: true, force: true })`. Retain the primary failure if cleanup also fails.

- [x] **Step 4: Run targeted checks**

Run: `node --test tests/podman-runtime-evidence.test.mjs tests/external-gate-workflow.test.mjs tests/native-sandbox-drivers.test.mjs`

Expected: PASS with the real-runtime test skipped locally.

- [x] **Step 5: Commit**

```bash
git add tests/podman-runtime-evidence.test.mjs tests/external-gate-workflow.test.mjs .github/workflows/external-gates.yml
git commit -m "test: add real Podman sandbox evidence"
```

### Task 3: Verify the evidence boundary

**Files:**

- Modify: none unless a test reveals a concrete production-driver defect.
- Test: `tests/native-sandbox-drivers.test.mjs`, `tests/external-gate-workflow.test.mjs`, `tests/podman-runtime-evidence.test.mjs`

**Interfaces:**

- Consumes: existing `npm run audit:external-gates` artifact step.
- Produces: a passing GitHub run that retains a runner observation without promoting cloud, OS, or Electron claims.

- [x] **Step 1: Push one verified commit**

Run: `git push https://github.com/Nolane-x/Nolane-agent.git HEAD:refs/heads/codex/external-gate-evidence`

Expected: GitHub starts the Linux real-Podman step.

- [x] **Step 2: Inspect the exact GitHub run**

Run: `gh run view <run-id> --repo Nolane-x/Nolane-agent --log-failed`

Expected: success, or a precise runner capability failure with no weakened assertion.

- [x] **Step 3: Preserve non-claims**

Verify final reporting names Kubernetes/cloud, Windows/macOS native enforcement, Electron packaging, and provider credentials as unresolved external conditions.
