# Remote MicroVM Sandbox Boundary

ForgeOS can submit a high-risk command to a separately operated sandbox provider, but it does not ship, provision, or silently emulate a microVM host. The local process broker is not a substitute.

## Required configuration

Set both variables in the ForgeOS process environment:

```text
FORGEOS_SANDBOX_ENDPOINT=https://sandbox-control.example
FORGEOS_SANDBOX_PUBLIC_KEY=<PEM-or-JWK-Ed25519-public-key>
```

The endpoint must be HTTPS, without credentials, query parameters, or fragments. The public key must be an Ed25519 verification key. ForgeOS never prints the key when configuration is invalid.

Check the boundary before allowing high-risk execution:

```bash
node src/cli/forge.mjs sandbox status --json
```

The command exits `0` only when the provider publishes a compatible profile. It exits `2` when no provider is configured or reachable, and `1` for unsafe or malformed configuration. An unavailable or misconfigured provider is a failed boundary: ForgeOS does not fall back to its local broker.

## Provider contract

`GET /.well-known/forgeos-sandbox.json` must return this compatibility profile:

```json
{
  "schemaVersion": 1,
  "providerId": "microvm-provider",
  "executionKind": "microvm",
  "network": "deny-by-default",
  "secrets": "none-by-default",
  "maxTimeoutMs": 5000
}
```

`POST /v1/runs` receives canonical JSON containing `request` and `requestSha256`. The command, arguments, working directory, timeout, and input are bounded before submission; caller-supplied environment variables are refused.

The response must contain a base64url Ed25519 `signature` over canonical JSON `receipt`. A receipt is accepted only when its provider ID, request digest, status, timestamps, complete isolation evidence, output digests, and output size are valid. In particular, it must explicitly declare all three isolation facts: `executionKind: microvm`, `network: deny-by-default`, and `secrets: none-by-default`.

## Production operating requirements

Run the provider on a separately administered Linux/KVM or equivalent microVM-capable trust domain. Enforce egress deny-by-default at the provider, use per-run ephemeral filesystem state, inject no ForgeOS secrets into the guest, rotate signing keys, retain provider-side audit logs, and independently test a network-escape and secret-access denial path. TLS, provider availability, guest integrity, and host attestation remain provider responsibilities; a signed receipt proves that the configured signing key made a statement, not that a host is invulnerable.

This repository has no configured live provider or KVM/Firecracker deployment evidence. Therefore `sandbox status` is expected to report `unavailable` in an unconfigured checkout, and ForgeOS must not be described as providing a universal microVM sandbox. See [Production](PRODUCTION.md), [Security Model](SECURITY-MODEL.md), and [Claims Boundary](CLAIMS-BOUNDARY-V0.6.md).
