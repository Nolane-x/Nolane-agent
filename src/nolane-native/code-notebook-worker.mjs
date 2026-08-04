import { parentPort } from 'node:worker_threads';
import vm from 'node:vm';

const sandbox = Object.create(null);
const context = vm.createContext(sandbox, { name: 'nolane-native-notebook', codeGeneration: { strings: false, wasm: false } });

function render(value) {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

parentPort.on('message', ({ id, source, input, timeoutMs, maxOutputBytes }) => {
  const logs = [];
  context.input = structuredClone(input ?? {});
  context.console = Object.freeze({ log: (...args) => logs.push(args.map(render).join(' ')), error: (...args) => logs.push(args.map(render).join(' ')), warn: (...args) => logs.push(args.map(render).join(' ')) });
  try {
    const script = new vm.Script(String(source), { filename: `notebook-cell-${id}.mjs`, displayErrors: true });
    const result = script.runInContext(context, { timeout: timeoutMs, displayErrors: true, breakOnSigint: true });
    const bytes = Buffer.byteLength(logs.join('\n')) + Buffer.byteLength(render(result));
    if (bytes > maxOutputBytes) throw new Error(`Notebook output limit exceeded: ${bytes} > ${maxOutputBytes}`);
    parentPort.postMessage({ id, ok: true, result, logs, outputBytes: bytes });
  } catch (error) {
    parentPort.postMessage({ id, ok: false, error: String(error?.message ?? error), code: error?.code ?? null });
  } finally {
    delete context.input;
    delete context.console;
  }
});
