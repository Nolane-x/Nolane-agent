# Podman Runtime Evidence Design

## Goal

Prove, on a disposable GitHub-hosted Linux runner, that `PodmanSandboxDriver` can create, start, inspect, and remove one bounded container. The result is runner evidence only; it must not promote cloud, macOS, Windows, or Electron claims.

## Scope and boundaries

The existing external-gate workflow installs Podman, but its driver test injects a fake command runner. The new proof uses the real `podman` executable only when `NOLANE_RUNTIME_PODMAN_GATE=1`. Normal developer test runs skip the proof rather than pulling an image or modifying a workstation.

The proof creates one uniquely named `busybox:1.36` container with the production driver's defaults: `--network=none`, `--read-only`, `--cap-drop=all`, `--security-opt=no-new-privileges`, explicit PID/memory/CPU limits, and a temporary workspace bind mount. It starts `/bin/true`, inspects the actual container configuration, removes the container in `finally`, and deletes only the temporary directory it created. No credential, cloud control plane, host secret, shell string, browser, or Electron package is used.

## Architecture

`tests/podman-runtime-evidence.test.mjs` is a runner-gated integration test. It imports the production `PodmanSandboxDriver`, uses Node's argument-vector `execFile` API only for `podman inspect`, and asserts driver output plus inspected container configuration. The workflow runs it only on the Linux matrix entry; its existing artifact collector continues to publish platform and runtime probe metadata.

Failure fails the workflow while its existing `if: always()` artifact upload retains evidence. Success proves exactly one GitHub Linux runner executed this bounded Podman contract; it is not a claim of Kubernetes, managed cloud, cross-platform native enforcement, or general production readiness.

## Verification

- A static workflow test proves the gated Linux runtime step exists and never adds Electron packaging.
- The real integration test checks lifecycle cleanup and actual security options visible in Podman inspection output.
- Local targeted tests run without a Podman side effect because the integration test skips without the explicit environment variable.
- Existing external-gate evidence, CI, and UI runtime visual workflows remain required.
