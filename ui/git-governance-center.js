function ensureStyles() {
  if (document.querySelector('link[data-git-governance-center]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/git-governance-center.css';
  link.dataset.gitGovernanceCenter = 'true';
  document.head.append(link);
}

function node(tag, className = '', text = null) {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text != null) value.textContent = String(text);
  return value;
}

function shortHash(value) { return String(value ?? '—').slice(0, 16); }
function list(items, render, emptyText) {
  const host = node('div', 'git-governance-list');
  for (const item of items ?? []) host.append(render(item));
  if (!host.childElementCount) host.append(node('div', 'git-governance-empty', emptyText));
  return host;
}

const markup = `<header class="git-governance-header"><div><span class="eyebrow">Evidence-bound Git completion</span><h1>Git Governance Center</h1><p>Commit receipts, agent change maps, merge-tree conflicts and diff review readiness are projected from durable local evidence.</p></div><button id="git-governance-refresh" class="secondary-button" type="button">Refresh</button></header>
<section class="git-governance-controls"><label>Mission ID<input id="git-governance-mission" autocomplete="off" placeholder="mission-id"></label><label>Task ID<input id="git-governance-task" autocomplete="off" placeholder="task-id"></label><label>Target ref<input id="git-governance-target" autocomplete="off" value="HEAD"></label><button id="git-governance-map" class="primary-button" type="button">Build collision map</button></section>
<div class="git-governance-layout"><section class="git-governance-column"><article class="git-governance-card"><span class="eyebrow">Commits & checkpoints</span><h2>Completion ledger</h2><div id="git-governance-completions"></div></article></section><section class="git-governance-column"><article class="git-governance-card"><span class="eyebrow">Agent collision map</span><h2>Integration preflight</h2><div id="git-governance-collisions"></div></article></section></div>`;

export function initGitGovernanceCenter({ api, state, toast, setView }) {
  ensureStyles();
  const root = document.getElementById('git-governance-center');
  root.className = 'git-governance-center view';
  root.innerHTML = markup;
  const get = (id) => root.querySelector(`#${id}`);
  let completionRecords = [];
  let collisionMap = null;

  const currentMissionId = () => state.currentRun?.mission?.id ?? state.currentRun?.missionId ?? '';
  const currentTaskId = () => state.currentRun?.tasks?.find((task) => task.status === 'running')?.id ?? state.currentRun?.task?.id ?? '';

  function renderCompletion(record) {
    const card = node('article', 'git-governance-record');
    const header = node('header', 'git-governance-record-header');
    header.append(node('strong', '', record.message || `${record.kind} commit`), node('span', `git-governance-status state-${record.status}`, record.status));
    const identity = node('div', 'git-governance-identity');
    identity.append(node('code', '', `${shortHash(record.beforeHead)} → ${shortHash(record.afterHead)}`), node('code', '', `receipt ${shortHash(record.receiptSha256)}`));
    const remotes = node('section', 'git-governance-evidence'); remotes.append(node('h3', '', 'Remotes'));
    remotes.append(list(record.remotes, (remote) => node('code', '', `${remote.name ?? 'remote'} · ${remote.url ?? remote.fetchUrl ?? 'metadata only'}`), 'No configured remotes were recorded.'));
    const tests = node('section', 'git-governance-evidence'); tests.append(node('h3', '', 'Test evidence'));
    tests.append(list(record.testReceipts, (receipt) => node('div', `git-governance-test state-${receipt.status}`, `${receipt.status} · ${receipt.command ?? 'verified command'} · ${shortHash(receipt.receiptSha256)}`), 'Verification is pending for this checkpoint.'));
    const risks = node('section', 'git-governance-evidence'); risks.append(node('h3', '', 'Residual risks'));
    risks.append(list(record.residualRisks, (risk) => node('div', 'git-governance-risk', risk), 'No residual risks were recorded.'));
    card.append(header, identity, remotes, tests, risks);
    return card;
  }

  function renderCollision(value) {
    if (!value) return node('div', 'git-governance-empty', 'No collision map is available for this mission.');
    const host = node('div', 'git-governance-collision-map');
    const summary = node('div', `git-governance-summary ${value.ready ? 'ready' : 'blocked'}`);
    summary.append(node('strong', '', value.ready ? 'Integration ready' : 'Integration blocked'), node('code', '', `receipt ${shortHash(value.receiptSha256)}`));

    const changed = node('section', 'git-governance-evidence'); changed.append(node('h3', '', 'Changed files'));
    changed.append(list(value.tasks, (task) => {
      const item = node('article', 'git-governance-task');
      item.append(node('strong', '', task.taskId), node('small', '', task.branch ?? task.head));
      item.append(list(task.changedPaths, (file) => node('code', '', file), 'No committed changes.'));
      return item;
    }, 'No managed agent worktrees.'));

    const overlaps = node('section', 'git-governance-evidence'); overlaps.append(node('h3', '', 'File overlaps'));
    overlaps.append(list(value.overlaps, (entry) => node('div', 'git-governance-overlap', `${entry.path} · ${entry.taskIds.join(' ↔ ')}`), 'No two agents changed the same file.'));

    const conflicts = node('section', 'git-governance-evidence'); conflicts.append(node('h3', '', 'Merge-tree conflicts'));
    conflicts.append(list(value.pairs, (pair) => {
      const item = node('article', pair.status === 'conflict' ? 'git-governance-conflict' : 'git-governance-clean');
      item.append(node('strong', '', `${pair.leftTaskId} ↔ ${pair.rightTaskId}`), node('span', '', pair.status));
      for (const file of pair.conflictPaths ?? []) item.append(node('code', '', file));
      return item;
    }, 'No agent pairs require merge-tree analysis.'));

    const review = node('section', 'git-governance-evidence'); review.append(node('h3', '', 'Diff review readiness'));
    review.append(list(value.reviewCoverage, (entry) => node('div', `git-governance-review state-${entry.status}`, `${entry.taskId} · ${entry.path} · ${entry.status}`), 'No changed paths require review.'));
    host.append(summary, changed, overlaps, conflicts, review);
    return host;
  }

  function render() {
    get('git-governance-completions').replaceChildren(list(completionRecords, renderCompletion, 'Enter a task ID to inspect commit and checkpoint receipts.'));
    get('git-governance-collisions').replaceChildren(renderCollision(collisionMap));
  }

  async function load() {
    const missionId = get('git-governance-mission').value.trim();
    const taskId = get('git-governance-task').value.trim();
    const [missionResult, taskResult] = await Promise.all([
      missionId ? api(`/api/git-governance/missions/${encodeURIComponent(missionId)}`) : Promise.resolve(null),
      taskId ? api(`/api/git-governance/tasks/${encodeURIComponent(taskId)}/completions`) : Promise.resolve([]),
    ]);
    collisionMap = missionResult;
    completionRecords = taskResult ?? [];
    render();
    return { collisionMap, completionRecords };
  }

  get('git-governance-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  get('git-governance-map').onclick = async () => {
    const missionId = get('git-governance-mission').value.trim();
    if (!missionId) { toast('Mission ID is required.', true); return; }
    try {
      collisionMap = await api('/api/git-governance/collisions', {
        method: 'POST',
        body: JSON.stringify({ missionId, targetRef: get('git-governance-target').value.trim() || 'HEAD', idempotencyKey: `ui-${missionId}-${Date.now()}` }),
      });
      render();
    } catch (error) { toast(error.message, true); }
  };

  return Object.freeze({
    async open() {
      setView('gitGovernance');
      if (!get('git-governance-mission').value) get('git-governance-mission').value = currentMissionId();
      if (!get('git-governance-task').value) get('git-governance-task').value = currentTaskId();
      try { return await load(); } catch (error) { toast(`Unable to load Git Governance Center: ${error.message}`, true); render(); return null; }
    },
    load,
  });
}
