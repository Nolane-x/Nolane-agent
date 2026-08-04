import { createHash } from 'node:crypto';
import { createNativeWebBrowserTools } from './web-browser-tools.mjs';
import { NativeNotebookService } from './code-notebook-tools.mjs';
import { CrossSessionMemory } from './cross-session-memory.mjs';
import { TerminalUiState } from './terminal-ui.mjs';
import { MediaProviderRegistry } from './media-provider-registry.mjs';
import { AudioProviderRegistry } from './audio-provider-registry.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function createNolaneNativeCapabilityPack({ memoryFile, allowHosts = [], fetchImpl = globalThis.fetch, browserDriver = null, mediaProviders = [], audioProviders = [] } = {}) {
  const webBrowser = createNativeWebBrowserTools({ allowHosts, fetchImpl, browserDriver });
  const notebook = new NativeNotebookService();
  const memory = new CrossSessionMemory({ file: memoryFile }); await memory.init();
  const terminalUi = new TerminalUiState();
  const media = new MediaProviderRegistry(); mediaProviders.forEach((provider) => media.register(provider));
  const audio = new AudioProviderRegistry(); audioProviders.forEach((provider) => audio.register(provider));
  const capabilities = ['web', 'browser', 'code-notebook', 'cross-session-memory', 'terminal-ui', 'media', 'audio'];
  return Object.freeze({
    webBrowser, notebook, memory, terminalUi, media, audio,
    snapshot() { const base = { schema: 'nolane.native.capability-pack.v1', runtimeOwner: 'nolane-native', capabilities: [...capabilities], web: webBrowser.snapshot(), notebook: notebook.snapshot(), memory: memory.snapshot(), terminalUi: terminalUi.snapshot(), mediaProviders: media.describe(), audioProviders: audio.describe() }; return Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }); },
    async close() { await notebook.closeAll(); },
  });
}
