import { InMemorySandboxDriver } from './in-memory-sandbox-driver.mjs';
import { KubectlClient } from './kubectl-client.mjs';
import { KubernetesSandboxDriver } from './kubernetes-sandbox-driver.mjs';

export function createCloudSandboxDriver({
  mode = 'reference',
  kubectlExecutable = 'kubectl',
  kubectlContext = null,
  kubeconfig = null,
  runtimeClassName = 'gvisor',
  storageClassName = null,
  snapshotClassName = null,
  namespacePrefix = 'forge',
  networkPolicyProvider = 'cilium',
  runner,
} = {}) {
  const selected = String(mode || 'reference').trim().toLowerCase();
  if (selected === 'reference') return new InMemorySandboxDriver();
  if (selected !== 'kubernetes') throw new TypeError('cloud sandbox driver must be reference or kubernetes');
  const client = new KubectlClient({ executable: kubectlExecutable, context: kubectlContext, kubeconfig, ...(runner ? { runner } : {}) });
  return new KubernetesSandboxDriver({ client, runtimeClassName, storageClassName, snapshotClassName, namespacePrefix, networkPolicyProvider });
}
