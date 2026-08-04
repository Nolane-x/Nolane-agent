const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f\u001b]/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (value, width) => clean(value).slice(0, width).padEnd(width, ' ');

export class TerminalUiState {
  #width; #height; #state = { missions: [], selectedMissionId: null, message: '' };
  constructor({ width = 80, height = 24 } = {}) { this.#width = Math.max(40, Number(width) || 80); this.#height = Math.max(8, Number(height) || 24); }
  update({ missions = [], selectedMissionId = null, message = '' } = {}) {
    this.#state = { missions: missions.slice(0, this.#height - 5).map((item) => ({ id: clean(item.id), title: clean(item.title), status: clean(item.status) })), selectedMissionId: selectedMissionId === null ? null : clean(selectedMissionId), message: clean(message) };
    if (!this.#state.missions.some((item) => item.id === this.#state.selectedMissionId)) this.#state.selectedMissionId = this.#state.missions[0]?.id ?? null;
    return this.snapshot();
  }
  render() {
    const inner = this.#width - 4; const lines = [`+${'-'.repeat(this.#width - 2)}+`, `| ${pad('Nolane Agent · Terminal Workspace', inner)} |`, `| ${pad(this.#state.message, inner)} |`, `+${'-'.repeat(this.#width - 2)}+`];
    for (const mission of this.#state.missions) lines.push(`| ${pad(`${mission.id === this.#state.selectedMissionId ? '>' : ' '} [${mission.status}] ${mission.title}`, inner)} |`);
    while (lines.length < this.#height - 1) lines.push(`| ${' '.repeat(inner)} |`);
    lines.push(`+${'-'.repeat(this.#width - 2)}+`); return lines.slice(0, this.#height).join('\n');
  }
  handleCommand(command) {
    const action = clean(command).toLowerCase(); const missions = this.#state.missions;
    if (!['up', 'down', 'home', 'end'].includes(action)) throw new Error(`Unsupported terminal UI command: ${action}`);
    if (missions.length === 0) return this.snapshot();
    let index = Math.max(0, missions.findIndex((item) => item.id === this.#state.selectedMissionId));
    if (action === 'up') index = Math.max(0, index - 1); if (action === 'down') index = Math.min(missions.length - 1, index + 1); if (action === 'home') index = 0; if (action === 'end') index = missions.length - 1;
    this.#state.selectedMissionId = missions[index].id; return this.snapshot();
  }
  snapshot() { return Object.freeze({ schema: 'nolane.native.terminal-ui-state.v1', width: this.#width, height: this.#height, missions: this.#state.missions.map((item) => ({ ...item })), selectedMissionId: this.#state.selectedMissionId, message: this.#state.message, ansiFree: true }); }
}
