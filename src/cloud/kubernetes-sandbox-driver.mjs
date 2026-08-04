import { createHash } from 'node:crypto';

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}

function dnsLabel(value, max = 63) {
  const source = required(value, 'label').toLowerCase();
  const normalized = source.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'tenant';
  if (normalized.length <= max) return normalized;
  const suffix = createHash('sha256').update(source).digest('hex').slice(0, 10);
  return `${normalized.slice(0, max - suffix.length - 1).replace(/-+$/g, '')}-${suffix}`;
}

function cpuQuantity(value) {
  const cpu = Number(value);
  if (!Number.isFinite(cpu) || cpu <= 0) throw new TypeError('sandbox CPU must be positive');
  return Number.isInteger(cpu) ? String(cpu) : `${Math.ceil(cpu * 1000)}m`;
}

function memoryQuantity(value, name) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new TypeError(`${name} must be positive`);
  return `${Math.ceil(amount)}Mi`;
}

function labels(spec) {
  return {
    'app.kubernetes.io/name': 'forge-sandbox',
    'app.kubernetes.io/managed-by': 'forge-studio',
    'forge.studio/organization': dnsLabel(spec.organizationId),
    'forge.studio/workspace': dnsLabel(spec.workspaceId),
    'forge.studio/sandbox-id': dnsLabel(spec.id),
  };
}

function tenantNamespace(prefix, organizationId) {
  return dnsLabel(`${dnsLabel(prefix)}-${dnsLabel(organizationId)}`);
}

function sandboxName(id) {
  return dnsLabel(`sandbox-${id}`);
}

function sandboxContainer(spec, volumeMounts) {
  return {
    name: 'workspace',
    image: `sandbox@${required(spec.imageDigest, 'imageDigest')}`,
    imagePullPolicy: 'IfNotPresent',
    command: ['/forge/worker-entrypoint'],
    args: ['--sandbox-id', spec.id],
    env: [
      { name: 'FORGE_SANDBOX_ID', value: spec.id },
      { name: 'FORGE_WORKSPACE_ID', value: spec.workspaceId },
      { name: 'FORGE_NETWORK_MODE', value: spec.network?.mode ?? 'deny' },
    ],
    resources: {
      requests: { cpu: cpuQuantity(spec.resources?.cpu), memory: memoryQuantity(spec.resources?.ramMb, 'sandbox RAM') },
      limits: { cpu: cpuQuantity(spec.resources?.cpu), memory: memoryQuantity(spec.resources?.ramMb, 'sandbox RAM') },
    },
    securityContext: {
      allowPrivilegeEscalation: false,
      readOnlyRootFilesystem: true,
      runAsNonRoot: true,
      runAsUser: 65532,
      runAsGroup: 65532,
      capabilities: { drop: ['ALL'] },
      seccompProfile: { type: 'RuntimeDefault' },
    },
    volumeMounts,
  };
}

function buildNetworkResources({ namespace, name, resourceLabels, network, networkPolicyProvider }) {
  const denyAll = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: { name: `${name}-deny-all`, namespace, labels: resourceLabels },
    spec: { podSelector: { matchLabels: { 'forge.studio/sandbox-id': resourceLabels['forge.studio/sandbox-id'] } }, policyTypes: ['Ingress', 'Egress'], ingress: [], egress: [] },
  };
  if (network?.mode !== 'allowlist') return [denyAll];
  const domains = [...new Set((network.domains ?? []).map((domain) => required(domain, 'network domain').toLowerCase()))];
  const ports = [...new Set((network.ports ?? []).map((value) => {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('network port must be between 1 and 65535');
    return port;
  }))];
  if (!domains.length && !ports.length) throw new TypeError('allowlist network mode requires at least one domain or port');
  if (networkPolicyProvider !== 'cilium') throw new Error('Network allowlists require the Cilium policy provider');
  const portRules = ports.length ? [{ ports: ports.map((port) => ({ port: String(port), protocol: 'TCP' })) }] : undefined;
  const egress = [
    { toEndpoints: [{ matchLabels: { 'k8s:io.kubernetes.pod.namespace': 'kube-system', 'k8s:k8s-app': 'kube-dns' } }], toPorts: [{ ports: [{ port: '53', protocol: 'UDP' }, { port: '53', protocol: 'TCP' }], rules: { dns: [{ matchPattern: '*' }] } }] },
  ];
  if (domains.length) egress.push({ toFQDNs: domains.map((matchName) => ({ matchName })), ...(portRules ? { toPorts: portRules } : {}) });
  else egress.push({ toEntities: ['world'], toPorts: portRules });
  return [denyAll, {
    apiVersion: 'cilium.io/v2',
    kind: 'CiliumNetworkPolicy',
    metadata: { name: `${name}-allowlisted-egress`, namespace, labels: resourceLabels },
    spec: {
      endpointSelector: { matchLabels: { 'forge.studio/sandbox-id': resourceLabels['forge.studio/sandbox-id'] } },
      egress,
    },
  }];
}

export class KubernetesSandboxDriver {
  constructor({ client, namespacePrefix = 'forge', runtimeClassName = 'gvisor', storageClassName = null, snapshotClassName = null, networkPolicyProvider = 'cilium', quotaFor = null, readinessTimeoutMs = 120_000 } = {}) {
    if (!client?.apply || !client?.waitForPod || !client?.deleteByLabels || !client?.snapshotVolume) throw new TypeError('Kubernetes client with apply, waitForPod, deleteByLabels and snapshotVolume is required');
    this.client = client;
    this.namespacePrefix = dnsLabel(namespacePrefix);
    this.runtimeClassName = runtimeClassName ? dnsLabel(runtimeClassName) : null;
    this.storageClassName = storageClassName ? required(storageClassName, 'storageClassName') : null;
    this.snapshotClassName = snapshotClassName ? required(snapshotClassName, 'snapshotClassName') : null;
    this.networkPolicyProvider = networkPolicyProvider;
    this.quotaFor = typeof quotaFor === 'function' ? quotaFor : null;
    this.readinessTimeoutMs = Math.max(1_000, Number(readinessTimeoutMs) || 120_000);
    this.records = new Map();
  }

  restore(records = []) { for (const record of records) if (record?.id) this.records.set(record.id, structuredClone(record)); }

  buildResources(spec) {
    const namespace = tenantNamespace(this.namespacePrefix, spec.organizationId);
    const name = sandboxName(spec.id);
    const resourceLabels = labels(spec);
    const cpu = cpuQuantity(spec.resources?.cpu);
    const memory = memoryQuantity(spec.resources?.ramMb, 'sandbox RAM');
    const storage = memoryQuantity(spec.resources?.diskMb, 'sandbox disk');
    const requestedQuota = this.quotaFor?.(spec.organizationId, structuredClone(spec)) ?? { cpu, memory, storage, pods: '100' };
    const pvcName = `${name}-workspace`;
    const volumeMounts = [
      { name: 'workspace', mountPath: '/workspace', readOnly: spec.workspaceReadOnly === true },
      { name: 'tmp', mountPath: '/tmp' },
    ];
    const volumes = [
      { name: 'workspace', persistentVolumeClaim: { claimName: pvcName, readOnly: spec.workspaceReadOnly === true } },
      { name: 'tmp', emptyDir: { sizeLimit: '512Mi' } },
    ];
    const resources = [
      {
        apiVersion: 'v1', kind: 'Namespace', metadata: {
          name: namespace,
          labels: {
            'app.kubernetes.io/managed-by': 'forge-studio',
            'forge.studio/organization': dnsLabel(spec.organizationId),
            'pod-security.kubernetes.io/enforce': 'restricted',
            'pod-security.kubernetes.io/audit': 'restricted',
            'pod-security.kubernetes.io/warn': 'restricted',
          },
        },
      },
      {
        apiVersion: 'v1', kind: 'ResourceQuota', metadata: { name: 'forge-tenant-quota', namespace, labels: resourceLabels },
        spec: { hard: { 'requests.cpu': String(requestedQuota.cpu), 'limits.cpu': String(requestedQuota.cpu), 'requests.memory': String(requestedQuota.memory), 'limits.memory': String(requestedQuota.memory), 'requests.storage': String(requestedQuota.storage), pods: String(requestedQuota.pods ?? '100') } },
      },
      {
        apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: { name: pvcName, namespace, labels: resourceLabels },
        spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage } }, ...(this.storageClassName ? { storageClassName: this.storageClassName } : {}) },
      },
    ];
    if ((spec.secretRefs ?? []).length) {
      const secretClassName = `${name}-vault`;
      resources.push({
        apiVersion: 'secrets-store.csi.x-k8s.io/v1', kind: 'SecretProviderClass', metadata: { name: secretClassName, namespace, labels: resourceLabels },
        spec: { provider: 'forge-vault', parameters: { organizationId: spec.organizationId, references: JSON.stringify(spec.secretRefs) } },
      });
      volumes.push({ name: 'secrets', csi: { driver: 'secrets-store.csi.k8s.io', readOnly: true, volumeAttributes: { secretProviderClass: secretClassName } } });
      volumeMounts.push({ name: 'secrets', mountPath: '/run/forge-secrets', readOnly: true });
    }
    resources.push({
      apiVersion: 'v1', kind: 'Pod', metadata: { name, namespace, labels: resourceLabels, annotations: { 'forge.studio/expires-at': new Date(spec.expiresAt).toISOString(), 'forge.studio/cache-namespace': spec.cacheNamespace } },
      spec: {
        restartPolicy: 'Never',
        automountServiceAccountToken: false,
        enableServiceLinks: false,
        hostNetwork: false,
        hostPID: false,
        hostIPC: false,
        ...(this.runtimeClassName ? { runtimeClassName: this.runtimeClassName } : {}),
        securityContext: { runAsNonRoot: true, fsGroup: 65532, seccompProfile: { type: 'RuntimeDefault' } },
        terminationGracePeriodSeconds: 15,
        containers: [sandboxContainer(spec, volumeMounts)],
        volumes,
        nodeSelector: { 'forge.studio/region': dnsLabel(spec.region) },
      },
    });
    resources.push(...buildNetworkResources({ namespace, name, resourceLabels, network: spec.network, networkPolicyProvider: this.networkPolicyProvider }));
    return Object.freeze({ namespace, podName: name, pvcName, labels: Object.freeze({ ...resourceLabels }), resources: Object.freeze(resources.map((resource) => Object.freeze(resource))) });
  }

  async provision(spec) {
    if (this.records.has(spec.id)) throw new Error(`Sandbox already provisioned: ${spec.id}`);
    const deployment = this.buildResources(spec);
    await this.client.apply(deployment.resources);
    const pod = await this.client.waitForPod({ namespace: deployment.namespace, name: deployment.podName, timeoutMs: this.readinessTimeoutMs, expectedPhase: 'Running' });
    const record = { id: spec.id, organizationId: spec.organizationId, namespace: deployment.namespace, podName: deployment.podName, pvcName: deployment.pvcName, labels: deployment.labels, state: pod.phase === 'Running' ? 'running' : 'failed', nodeName: pod.nodeName ?? null, isolationLevel: this.runtimeClassName ? `kubernetes-runtimeclass:${this.runtimeClassName}` : 'kubernetes-restricted-pod', spec: structuredClone(spec) };
    this.records.set(spec.id, record);
    return structuredClone(record);
  }

  async inspect(id) {
    const record = this.records.get(required(id, 'sandbox id'));
    return record ? structuredClone(record) : null;
  }

  async snapshot(id) {
    const record = this.records.get(required(id, 'sandbox id'));
    if (!record) throw new Error('Sandbox not found');
    const snapshot = await this.client.snapshotVolume({ namespace: record.namespace, pvcName: record.pvcName, labels: record.labels, ...(this.snapshotClassName ? { snapshotClassName: this.snapshotClassName } : {}) });
    return Object.freeze({ snapshotId: `${record.namespace}/${snapshot.name}`, sandboxId: record.id, readyToUse: snapshot.readyToUse === true, createdAt: Date.now() });
  }

  async resume(snapshot, spec) {
    if (!snapshot?.snapshotId) throw new TypeError('snapshotId is required');
    return this.provision({ ...spec, resumeSnapshotId: snapshot.snapshotId });
  }

  async terminate(id) {
    const record = this.records.get(required(id, 'sandbox id'));
    if (!record) return null;
    await this.client.deleteByLabels({ namespace: record.namespace, labels: record.labels, kinds: ['Pod', 'PersistentVolumeClaim', 'SecretProviderClass', 'NetworkPolicy', 'CiliumNetworkPolicy'] });
    record.state = 'terminated';
    record.terminatedAt = Date.now();
    return structuredClone(record);
  }
}
