# ForgeOS v0.7 Trust-Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make durable storage portable, add a fail-closed external microVM execution boundary, and import external skills as rigorously-scanned candidates rather than trusted prompt text.

**Architecture:** A shared JSON replacement helper records whether directory durability was available after a file-synced atomic rename. \`RemoteMicroVmSandbox\` talks only to a configured HTTPS provider and verifies request-bound Ed25519 receipts. \`SkillIntake\` converts bounded immutable text bundles into federation candidates; the supplied kit's three MIT seed procedures are importable examples, not active/stable providers.

**Tech Stack:** Node.js 22 ESM, \`node:crypto\`, \`node:fs/promises\`, \`node:test\`, ForgeOS federation schemas and MCP tool registry.

## Global Constraints

- Node.js remains \`>=22\`; add no runtime dependency.
- A directory-sync result of \`EPERM\`, \`EINVAL\`, or \`EISDIR\` is a truthful unsupported capability, not a failed atomic replacement.
- A remote sandbox must use HTTPS, an operator-pinned Ed25519 public key, and \`microvm\` + deny-by-default network + no-default-secrets capability fields.
- No sandbox execution may fall back to \`BrokeredProcessRunner\`.
- Intake never executes, installs, fetches, or promotes a supplied skill; automatic intake can produce no state higher than \`candidate\`.
- The kit archive digest is \`38691BA5B2A29CDA3FD51AA6F829D262BFD3DEC1A9AEC20A82EB9E192794A4FD\`; its 72-source catalog remains discovery-only.

---

### Task 1: Portable atomic JSON writes

**Files:**

- Create: \`src/storage/durable-json.mjs\`
- Modify: \`src/server/a2a-task-store.mjs\`
- Modify: \`src/evals/eval-run-store.mjs\`
- Create: \`tests/durable-json.test.mjs\`
- Modify: \`tests/a2a-task-engine-v3.test.mjs\`
- Modify: \`tests/eval-runner-invariants.test.mjs\`

**Interfaces:**

- Produces \`atomicWriteJson(file, value, { serialize, syncDirectory }) -> Promise<{ file, sha256, durability }>\`.
- \`durability\` is \`{ fileSync: 'completed', directorySync: 'completed' | 'unsupported' }\`.
- \`A2aTaskStore.durability()\` and \`EvalRunStore.durability()\` return the latest immutable receipt or \`null\` before a write.

- [ ] **Step 1: Write the failing helper tests**

\`\`\`js
test('atomic JSON write preserves data when directory sync is unsupported', async () => {
  const receipt = await atomicWriteJson(file, { b: 2, a: 1 }, {
    syncDirectory: async () => { const error = new Error('unsupported'); error.code = 'EPERM'; throw error; },
  });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { a: 1, b: 2 });
  assert.deepEqual(receipt.durability, { fileSync: 'completed', directorySync: 'unsupported' });
});

test('atomic JSON write rejects unclassified directory sync errors', async () => {
  await assert.rejects(() => atomicWriteJson(file, { ok: true }, {
    syncDirectory: async () => { const error = new Error('disk failure'); error.code = 'EIO'; throw error; },
  }), /disk failure/);
});
\`\`\`

- [ ] **Step 2: Run test to verify it fails**

Run: \`node --test --test-reporter=spec tests/durable-json.test.mjs\`

Expected: FAIL because \`src/storage/durable-json.mjs\` does not exist.

- [ ] **Step 3: Write minimal implementation**

\`\`\`js
export async function atomicWriteJson(file, value, {
  serialize = canonicalStringify,
  syncDirectory = defaultDirectorySync,
} = {}) {
  // mkdir parent; write and sync a 0600 temporary file; close; rename.
  // Mark only EPERM, EINVAL, and EISDIR from syncDirectory as unsupported.
  // Remove the temporary file on any failure and return a frozen receipt.
}
\`\`\`

Use \`randomUUID\`, \`open(..., 'wx', 0o600)\`, \`handle.sync()\`, \`rename\`, \`rm\`, and \`canonicalSha256\`. Do not suppress a temporary-file sync or rename error.

- [ ] **Step 4: Replace duplicated writers and expose receipts**

Replace the local \`durableWrite\` functions in A2A and EvalRun stores with \`atomicWriteJson\`. Save the returned receipt in a private field only after a successful write; return a clone from \`durability()\` so callers cannot alter the store diagnostic.

- [ ] **Step 5: Add integration assertions**

\`\`\`js
assert.equal(store.durability().fileSync, 'completed');
assert.ok(['completed', 'unsupported'].includes(store.durability().directorySync));
\`\`\`

- [ ] **Step 6: Run focused regression tests**

Run: \`node --test --test-reporter=spec tests/durable-json.test.mjs tests/a2a-task-engine-v3.test.mjs tests/a2a-v1-invariants.test.mjs tests/eval-runner-invariants.test.mjs\`

Expected: PASS, including the A2A RPC tests that previously failed with \`EPERM: fsync\`.

- [ ] **Step 7: Commit**

\`\`\`bash
git add src/storage/durable-json.mjs src/server/a2a-task-store.mjs src/evals/eval-run-store.mjs tests/durable-json.test.mjs tests/a2a-task-engine-v3.test.mjs tests/eval-runner-invariants.test.mjs
git commit -m "fix: make durable JSON writes portable"
\`\`\`

### Task 2: Capability-honest remote microVM adapter

**Files:**

- Create: \`src/execution/remote-microvm-sandbox.mjs\`
- Create: \`tests/remote-microvm-sandbox.test.mjs\`
- Modify: \`src/cli/forge.mjs\`
- Modify: \`tests/release-cli-exit-v04.test.mjs\`

**Interfaces:**

- \`new RemoteMicroVmSandbox({ endpoint, publicKey, fetchImpl, maxOutputBytes, now })\`.
- \`probe() -> { state: 'ready' | 'unavailable' | 'misconfigured', profile?: object, reason?: string }\`.
- \`run({ command, args, cwd, timeoutMs, input }) -> signed receipt\`; throws for every unavailable, malformed, unsafe, or tampered state.
- \`createRemoteMicroVmSandboxFromEnv(env)\` reads \`FORGEOS_SANDBOX_ENDPOINT\` and \`FORGEOS_SANDBOX_PUBLIC_KEY\` without exposing either in receipts.

- [ ] **Step 1: Write failing sandbox tests with an in-process signed transport**

Generate an Ed25519 key pair with \`generateKeyPairSync('ed25519')\`. The fake transport returns a capability document for \`GET /.well-known/forgeos-sandbox.json\` and \`{ receipt, signature }\` for \`POST /v1/runs\`.

\`\`\`js
assert.equal((await sandbox.probe()).state, 'ready');
await assert.rejects(() => unavailable.run(request), /unavailable/i);
await assert.rejects(() => sandbox.run({ ...request, args: ['x'.repeat(4097)] }), /argument/i);
await assert.rejects(() => tamperedSandbox.run(request), /signature/i);
await assert.rejects(() => weakProfileSandbox.run(request), /deny-by-default/i);
\`\`\`

Also assert that the fixture never invokes \`BrokeredProcessRunner\`.

- [ ] **Step 2: Run test to verify it fails**

Run: \`node --test --test-reporter=spec tests/remote-microvm-sandbox.test.mjs\`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict configuration, probe, and receipt verification**

Use a canonical receipt containing \`schemaVersion\`, \`providerId\`, \`requestSha256\`, \`status\`, timestamps, \`stdout\`, \`stderr\`, hashes, and isolation profile. Verify with Node Ed25519 \`verify(null, Buffer.from(canonicalStringify(receipt)), publicKey, signature)\`. Require HTTPS, reject credentials/query/fragment in the endpoint, enforce string-only bounded args, and reject a receipt unless its request and output hashes match.

- [ ] **Step 4: Add status-only CLI access**

Add \`forge sandbox status\`. It prints the \`probe()\` result and exits \`0\` only for \`ready\`, \`2\` for \`unavailable\`, and \`1\` for \`misconfigured\`. Add its exact command string to the CLI help array and test all three exit states without a provider.

- [ ] **Step 5: Run focused tests**

Run: \`node --test --test-reporter=spec tests/remote-microvm-sandbox.test.mjs tests/release-cli-exit-v04.test.mjs\`

Expected: PASS; an unconfigured development machine reports \`unavailable\`, never \`ready\`.

- [ ] **Step 6: Commit**

\`\`\`bash
git add src/execution/remote-microvm-sandbox.mjs src/cli/forge.mjs tests/remote-microvm-sandbox.test.mjs tests/release-cli-exit-v04.test.mjs
git commit -m "feat: add fail-closed remote microvm boundary"
\`\`\`

### Task 3: Quarantine-first immutable skill intake

**Files:**

- Create: \`src/federation/skill-intake.mjs\`
- Modify: \`src/federation/security-scanner.mjs\`
- Modify: \`src/federation/service.mjs\`
- Modify: \`src/server/tool-registry.mjs\`
- Create: \`examples/skill-intake-kit-2026-07-28/source-manifest.json\`
- Create: \`examples/skill-intake-kit-2026-07-28/forgeos-skill-intake/SKILL.md\`
- Create: \`examples/skill-intake-kit-2026-07-28/forgeos-skill-promotion/SKILL.md\`
- Create: \`examples/skill-intake-kit-2026-07-28/forgeos-skill-security-review/SKILL.md\`
- Create: \`tests/skill-intake.test.mjs\`
- Modify: \`tests/federation-security.test.mjs\`
- Modify: \`tests/federation-mcp-tools.test.mjs\`

**Interfaces:**

- \`assessSkillIntake({ source, files, limits }) -> { status, packageSha256, contentDigest, license, estimatedTokens, findings, files }\`.
- \`FederationService.intakeSkillBundle(input, { principal, tenantId }) -> { provider, intake }\` imports the result in quarantined store state, then scans it; it never promotes it.
- MCP tool \`forge_skill_intake\` accepts one bounded immutable bundle and returns the provider plus the intake decision.

- [ ] **Step 1: Write failing intake tests**

Use the three example \`SKILL.md\` files as positive candidates. Assert their source manifest archive digest exactly matches the global constraint and each result is \`candidate\`, not \`stable\`. Add negative fixtures for \`../../escape.md\`, an instruction override, a remote pipe, a private-key marker, an unknown license, duplicate normalized body, over-limit files, and two \`SKILL.md\` roots.

\`\`\`js
assert.equal(assessment.status, 'candidate');
assert.notEqual(assessment.status, 'stable');
assert.equal(assessment.packageSha256.length, 64);
assert.equal(hostile.status, 'quarantined');
assert.equal(unknownLicense.status, 'review');
\`\`\`

- [ ] **Step 2: Run test to verify it fails**

Run: \`node --test --test-reporter=spec tests/skill-intake.test.mjs\`

Expected: FAIL because \`assessSkillIntake\` and the examples do not exist.

- [ ] **Step 3: Implement bounded pure-data assessment**

Validate POSIX-relative paths, at most 200 files, at most 1 MiB per text file, at most 5 MiB total, exactly one case-insensitive \`SKILL.md\`, an immutable \`source.coordinate\`, a SHA-256 source snapshot, and a declared license. Reuse \`scanSkillPackage\`; add scanner findings for shell deletion roots, explicit environment/SSH credential reads, and undeclared external write requests. Return \`quarantined\` for blockers, \`review\` for unknown license or incomplete provenance, and \`candidate\` only for a clean, bounded, non-duplicate package.

- [ ] **Step 4: Add verified examples without making them active providers**

Copy only the three MIT seed Markdown documents read from the archive. Create \`source-manifest.json\` with the archive SHA-256, \`sourceId: "forgeos-skill-intake-kit-2026-07-28"\`, license \`MIT\`, \`importPolicy: "candidate-only"\`, and original local-archive filename. Do not copy its Python fetcher, shell wrappers, external source catalog, or quarantined example content.

- [ ] **Step 5: Integrate federation and MCP access**

\`intakeSkillBundle\` preserves original files as provider material, attaches \`intake\` metadata, calls \`importProvider\`, calls \`scanProvider\`, and returns both records. Add \`forge_skill_intake\` as a destructive, non-idempotent tool whose schema limits the same file count and content size. Route it through the existing authenticated federation policy, not a new authorization bypass.

- [ ] **Step 6: Run focused tests**

Run: \`node --test --test-reporter=spec tests/skill-intake.test.mjs tests/federation-security.test.mjs tests/federation-mcp-tools.test.mjs\`

Expected: PASS; the tool can import a clean bundle into the quarantine/candidate workflow but cannot make it stable or materialize hostile content.

- [ ] **Step 7: Commit**

\`\`\`bash
git add src/federation/skill-intake.mjs src/federation/security-scanner.mjs src/federation/service.mjs src/server/tool-registry.mjs examples/skill-intake-kit-2026-07-28 tests/skill-intake.test.mjs tests/federation-security.test.mjs tests/federation-mcp-tools.test.mjs
git commit -m "feat: add quarantined skill intake"
\`\`\`

### Task 4: Operations documentation and release verification

**Files:**

- Modify: \`README.md\`
- Modify: \`docs/PRODUCTION.md\`
- Modify: \`docs/SECURITY-MODEL.md\`
- Modify: \`docs/CLAIMS-BOUNDARY-V0.6.md\`
- Modify: \`docs/SELF-AUDIT-V0.6.md\`
- Modify: \`tests/v06-current-docs.test.mjs\`

**Interfaces:**

- Operators configure the external boundary with \`FORGEOS_SANDBOX_ENDPOINT\` and \`FORGEOS_SANDBOX_PUBLIC_KEY\`.
- \`forge sandbox status --json\` is the only local readiness assertion; it is not a production microVM certification.

- [ ] **Step 1: Write documentation contract assertions**

Add checks requiring the two variable names, phrase \`candidate-only\`, and the continuing claim \`universalMicroVmSandbox: false\`. Assert no document says the local broker is a microVM.

- [ ] **Step 2: Run test to verify failure**

Run: \`node --test --test-reporter=spec tests/v06-current-docs.test.mjs\`

Expected: FAIL until the operator and claims documents describe the new boundary.

- [ ] **Step 3: Update operator and security documentation**

Document the capability profile, signature and request-binding checks, Linux/KVM provider prerequisite, no-local-fallback rule, two environment variables, candidate-only intake mapping, archive digest, and the production blocker. Keep the current claims boundary false for universal microVM and certified external skills.

- [ ] **Step 4: Run release-focused checks**

Run: \`npm test\`

Run: \`npm run validate\`

Run: \`npm run release:verify\`

Run: \`node src/cli/forge.mjs sandbox status --json\`

Expected: all repository gates pass; the final CLI command exits \`2\` with an unconfigured provider and prints \`"state": "unavailable"\`.

- [ ] **Step 5: Commit**

\`\`\`bash
git add README.md docs/PRODUCTION.md docs/SECURITY-MODEL.md docs/CLAIMS-BOUNDARY-V0.6.md docs/SELF-AUDIT-V0.6.md tests/v06-current-docs.test.mjs
git commit -m "docs: define external sandbox operations boundary"
\`\`\`

## Plan self-review

- Spec coverage: Task 1 implements portable storage; Task 2 implements the signed external boundary and no-local-fallback; Task 3 implements bounded intake and imports the three supplied seeds as candidate-only examples; Task 4 preserves truthful production claims and runs the complete gates.
- Placeholder scan: no unresolved-work markers or deferred implementation language appears in this plan.
- Type consistency: \`atomicWriteJson\`, \`RemoteMicroVmSandbox\`, \`assessSkillIntake\`, and \`FederationService.intakeSkillBundle\` are introduced once and used consistently.
