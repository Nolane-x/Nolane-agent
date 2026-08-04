import { spawn } from 'node:child_process';

function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}

function safeName(value, name = 'Kubernetes name') {
  const text = required(value, name);
  if (!/^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$/i.test(text) || text.length > 253) throw new TypeError(`${name} is invalid`);
  return text;
}

function selector(labels = {}) {
  const pairs = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  if (!pairs.length) throw new TypeError('at least one deletion label is required');
  return pairs.map(([key, value]) => {
    if (!/^[A-Za-z0-9./_-]+$/.test(key)) throw new TypeError('Kubernetes label key is invalid');
    const safeValue = String(value ?? '');
    if (!/^[A-Za-z0-9._-]+$/.test(safeValue)) throw new TypeError('Kubernetes label value is invalid');
    return `${key}=${safeValue}`;
  }).join(',');
}

function defaultRunner({ command, args, stdin = '', timeoutMs = 120_000, maxOutputBytes = 2_000_000, shell = false }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const append = (current, chunk) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') > maxOutputBytes) {
        child.kill('SIGKILL');
        throw new Error('kubectl output exceeded limit');
      }
      return next;
    };
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish({ exitCode: -1, stdout, stderr: `${stderr}kubectl timed out` }); }, timeoutMs);
    child.stdout.on('data', (chunk) => { try { stdout = append(stdout, chunk); } catch (error) { stderr = `${stderr}${error.message}`; } });
    child.stderr.on('data', (chunk) => { try { stderr = append(stderr, chunk); } catch (error) { stderr = `${stderr}${error.message}`; } });
    child.on('error', (error) => finish({ exitCode: -1, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (code) => finish({ exitCode: Number(code ?? -1), stdout, stderr }));
    child.stdin.end(stdin);
  });
}

const KIND_RESOURCES = Object.freeze({
  Pod: 'pods',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  SecretProviderClass: 'secretproviderclasses.secrets-store.csi.x-k8s.io',
  NetworkPolicy: 'networkpolicies.networking.k8s.io',
  CiliumNetworkPolicy: 'ciliumnetworkpolicies.cilium.io',
});

export class KubectlClient {
  constructor({ executable = 'kubectl', context = null, kubeconfig = null, runner = defaultRunner, timeoutMs = 120_000 } = {}) {
    this.executable = required(executable, 'kubectl executable');
    this.context = context ? required(context, 'Kubernetes context') : null;
    this.kubeconfig = kubeconfig ? required(kubeconfig, 'kubeconfig') : null;
    this.runner = runner;
    this.timeoutMs = Math.max(1_000, Number(timeoutMs) || 120_000);
  }

  #prefix() {
    return [
      ...(this.kubeconfig ? ['--kubeconfig', this.kubeconfig] : []),
      ...(this.context ? ['--context', this.context] : []),
    ];
  }

  async #run(args, { stdin = '', timeoutMs = this.timeoutMs } = {}) {
    const call = { command: this.executable, args: [...this.#prefix(), ...args], stdin, timeoutMs, shell: false };
    const result = await this.runner(call);
    if (Number(result?.exitCode) !== 0) {
      const error = new Error(`kubectl failed (${result?.exitCode}): ${String(result?.stderr ?? '').trim().slice(0, 2_000)}`);
      error.code = 'kubectl-failed';
      error.exitCode = Number(result?.exitCode ?? -1);
      throw error;
    }
    return result;
  }

  async apply(resources) {
    if (!Array.isArray(resources) || resources.length === 0) throw new TypeError('Kubernetes resources are required');
    const manifest = { apiVersion: 'v1', kind: 'List', items: resources };
    await this.#run(['apply', '-f', '-'], { stdin: JSON.stringify(manifest) });
  }

  async waitForPod({ namespace, name, timeoutMs = this.timeoutMs, expectedPhase = 'Running' } = {}) {
    const ns = safeName(namespace, 'namespace');
    const pod = safeName(name, 'pod name');
    const seconds = Math.max(1, Math.ceil(Number(timeoutMs) / 1_000));
    await this.#run(['-n', ns, 'wait', '--for=condition=Ready', `pod/${pod}`, `--timeout=${seconds}s`], { timeoutMs: Number(timeoutMs) + 5_000 });
    const result = await this.#run(['-n', ns, 'get', 'pod', pod, '-o', 'json']);
    const parsed = JSON.parse(result.stdout);
    if (expectedPhase && parsed?.status?.phase !== expectedPhase) throw new Error(`pod ${pod} phase is ${parsed?.status?.phase ?? 'unknown'}, expected ${expectedPhase}`);
    return Object.freeze({ phase: parsed.status.phase, nodeName: parsed.spec?.nodeName ?? null, podIP: parsed.status?.podIP ?? null });
  }

  async snapshotVolume({ namespace, pvcName, labels = {}, snapshotClassName = null } = {}) {
    const ns = safeName(namespace, 'namespace');
    const pvc = safeName(pvcName, 'PVC name');
    const suffix = Date.now().toString(36);
    const snapshotName = safeName(`${pvc}-snapshot-${suffix}`.slice(0, 63), 'snapshot name');
    const manifest = {
      apiVersion: 'snapshot.storage.k8s.io/v1',
      kind: 'VolumeSnapshot',
      metadata: { name: snapshotName, namespace: ns, labels },
      spec: { source: { persistentVolumeClaimName: pvc }, ...(snapshotClassName ? { volumeSnapshotClassName: required(snapshotClassName, 'snapshotClassName') } : {}) },
    };
    await this.apply([manifest]);
    const result = await this.#run(['-n', ns, 'get', 'volumesnapshot', snapshotName, '-o', 'json']);
    const parsed = JSON.parse(result.stdout);
    return Object.freeze({ name: parsed?.metadata?.name ?? snapshotName, readyToUse: parsed?.status?.readyToUse === true });
  }

  async deleteByLabels({ namespace, labels, kinds = [] } = {}) {
    const ns = safeName(namespace, 'namespace');
    const resources = [...new Set(kinds.map((kind) => KIND_RESOURCES[kind]).filter(Boolean))];
    if (!resources.length) throw new TypeError('at least one supported Kubernetes kind is required');
    await this.#run(['-n', ns, 'delete', resources.join(','), '-l', selector(labels), '--ignore-not-found=true', '--wait=true']);
  }
}
