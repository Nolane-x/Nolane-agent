import test from 'node:test';
import assert from 'node:assert/strict';

import { KubernetesSandboxDriver } from '../src/cloud/kubernetes-sandbox-driver.mjs';

function driver() {
  return new KubernetesSandboxDriver({
    client: { async apply() {}, async waitForPod() { return { phase: 'Running' }; }, async deleteByLabels() {}, async snapshotVolume() {} },
    runtimeClassName: 'gvisor',
    networkPolicyProvider: 'cilium',
  });
}

function spec(overrides = {}) {
  return {
    id: 'box-1', organizationId: 'org-a', workspaceId: 'workspace-a', region: 'ap-southeast-1',
    imageDigest: `sha256:${'a'.repeat(64)}`,
    resources: { cpu: 2, ramMb: 2048, diskMb: 4096 },
    expiresAt: Date.parse('2027-01-01T00:00:00.000Z'), cacheNamespace: 'org-a/box-1',
    network: { mode: 'allowlist', domains: ['registry.npmjs.org'], ports: [443] },
    secretRefs: ['vault://org-a/npm'], workspaceReadOnly: true,
    ...overrides,
  };
}

test('Kubernetes sandbox denies inbound, blocks host namespaces, mounts workspace/secrets read-only, and enforces domain plus port egress', () => {
  const built = driver().buildResources(spec());
  const pod = built.resources.find((item) => item.kind === 'Pod');
  const denyAll = built.resources.find((item) => item.kind === 'NetworkPolicy');
  const cilium = built.resources.find((item) => item.kind === 'CiliumNetworkPolicy');
  const secretClass = built.resources.find((item) => item.kind === 'SecretProviderClass');
  assert.deepEqual(denyAll.spec.policyTypes, ['Ingress', 'Egress']);
  assert.deepEqual(denyAll.spec.ingress, []);
  assert.deepEqual(denyAll.spec.egress, []);
  assert.equal(pod.spec.hostNetwork, false);
  assert.equal(pod.spec.hostPID, false);
  assert.equal(pod.spec.hostIPC, false);
  assert.equal(pod.spec.automountServiceAccountToken, false);
  assert.equal(pod.spec.containers[0].securityContext.readOnlyRootFilesystem, true);
  assert.equal(pod.spec.volumes.some((volume) => Object.hasOwn(volume, 'hostPath')), false);
  assert.equal(pod.spec.volumes.find((volume) => volume.name === 'workspace').persistentVolumeClaim.readOnly, true);
  assert.equal(pod.spec.containers[0].volumeMounts.find((mount) => mount.name === 'workspace').readOnly, true);
  assert.equal(pod.spec.containers[0].volumeMounts.find((mount) => mount.name === 'secrets').readOnly, true);
  assert.equal(secretClass.spec.parameters.organizationId, 'org-a');
  const fqdnRule = cilium.spec.egress.find((rule) => rule.toFQDNs);
  assert.deepEqual(fqdnRule.toFQDNs, [{ matchName: 'registry.npmjs.org' }]);
  assert.deepEqual(fqdnRule.toPorts[0].ports, [{ port: '443', protocol: 'TCP' }]);
  assert.equal(pod.metadata.annotations['forge.studio/expires-at'], '2027-01-01T00:00:00.000Z');
});

test('Kubernetes sandbox supports port-only egress and rejects invalid network allowlists', () => {
  const built = driver().buildResources(spec({ network: { mode: 'allowlist', ports: [443, 8443] }, secretRefs: [], workspaceReadOnly: false }));
  const cilium = built.resources.find((item) => item.kind === 'CiliumNetworkPolicy');
  const worldRule = cilium.spec.egress.find((rule) => rule.toEntities);
  assert.deepEqual(worldRule.toEntities, ['world']);
  assert.deepEqual(worldRule.toPorts[0].ports, [{ port: '443', protocol: 'TCP' }, { port: '8443', protocol: 'TCP' }]);
  assert.throws(() => driver().buildResources(spec({ network: { mode: 'allowlist', domains: [], ports: [] } })), /requires at least one domain or port/i);
  assert.throws(() => driver().buildResources(spec({ network: { mode: 'allowlist', ports: [70000] } })), /network port/i);
});
