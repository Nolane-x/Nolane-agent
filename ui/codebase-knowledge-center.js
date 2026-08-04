const TABS = Object.freeze({
  graph: 'Graph',
  semantic: 'Semantic Search',
  dependencies: 'Dependencies',
  ast: 'AST Intelligence',
  inheritance: 'Inheritance',
  issues: 'Issue Links',
  routes: 'Routes & APIs',
  models: 'Data Models',
  references: 'References & Calls',
  history: 'Git History',
  regex: 'Regex Search',
  watch: 'Live Watch',
  ranking: 'Ranking',
});

function ensureStyles() {
  if (document.querySelector('link[data-codebase-knowledge-center]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/codebase-knowledge-center.css';
  link.dataset.codebaseKnowledgeCenter = 'true';
  document.head.append(link);
}

const markup = `<div class="knowledge-signal-grid" aria-hidden="true"></div>
<div class="knowledge-constellation" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
<header class="knowledge-header"><div><span class="eyebrow knowledge-live"><b></b> Evidence graph synchronized</span><h1>Codebase Knowledge Graph</h1><p>Local semantic retrieval, dependency topology, routes, data models, references, Git history và ranking signals được ràng buộc bằng file–line–hash.</p></div><div class="knowledge-actions"><button id="knowledge-index" type="button" class="primary-button">Index local intelligence</button><button id="knowledge-refresh" type="button" class="secondary-button">Refresh</button></div></header>
<section id="knowledge-stats" class="knowledge-stats"></section>
<nav id="knowledge-tabs" class="knowledge-tabs" aria-label="Codebase Knowledge tabs"></nav>
${Object.keys(TABS).map((id) => `<section id="knowledge-panel-${id}" class="knowledge-panel"${id === 'graph' ? '' : ' hidden'}></section>`).join('')}`;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = String(text);
  return node;
}
function badge(text, tone = '') { return el('span', `knowledge-badge ${tone}`, text); }
function card(title) { const node = el('article', 'knowledge-card'); node.append(el('span', 'eyebrow', title)); return node; }
function evidence(item) { return el('code', 'knowledge-evidence', `${item.path}:${item.line ?? 1}@${String(item.sourceSha256 ?? item.id ?? '').slice(0, 10)}`); }
function empty(text) { return el('div', 'knowledge-empty', text); }
function receipt(value) { return el('code', 'knowledge-receipt', `receipt ${String(value ?? '—').slice(0, 16)}`); }
function rows(items, render) {
  const box = el('div', 'knowledge-list');
  for (const item of items ?? []) box.append(render(item));
  return box.childElementCount ? box : empty('Chưa có bằng chứng.');
}

export function initCodebaseKnowledgeCenter({ api, state, toast, setView }) {
  ensureStyles();
  const root = document.getElementById('codebase-knowledge-center');
  root.className = 'codebase-knowledge-center view';
  root.innerHTML = markup;
  const get = (id) => root.querySelector(`#${id}`);
  let snapshot = null;
  let ranked = null;
  let watch = null;
  let semanticResult = null;
  let dependencyResult = null;
  let astResult = null;
  let astSelected = null;
  let astPatchResult = null;
  let inheritanceResult = null;
  let issueResult = null;
  let tab = 'graph';

  const setTab = (name) => {
    tab = name;
    for (const id of Object.keys(TABS)) {
      get(`knowledge-panel-${id}`).hidden = id !== name;
      root.querySelector(`[data-knowledge-tab="${id}"]`)?.classList.toggle('active', id === name);
    }
  };

  const renderStats = () => {
    const counts = snapshot?.counts ?? {};
    const values = [
      ['Entities', snapshot?.entities?.length ?? 0],
      ['Edges', snapshot?.edges?.length ?? 0],
      ['Semantic hits', semanticResult?.items?.length ?? 0],
      ['Dependency nodes', dependencyResult?.nodes?.length ?? 0],
      ['Inheritance edges', inheritanceResult?.edges?.length ?? 0],
      ['Issue keys', issueResult?.issues?.length ?? 0],
      ['Graph hash', String(snapshot?.graphSha256 ?? '—').slice(0, 12)],
    ];
    get('knowledge-stats').replaceChildren(...values.map(([label, value]) => {
      const node = el('article', 'knowledge-stat');
      node.append(el('small', '', label), el('strong', '', value));
      return node;
    }));
  };

  const renderGraph = () => {
    const panel = get('knowledge-panel-graph');
    const entities = card('Entity spectrum');
    const spectrum = el('div', 'knowledge-spectrum');
    for (const [kind, count] of Object.entries(snapshot?.counts ?? {})) spectrum.append(badge(`${kind} · ${count}`, 'signal'));
    entities.append(spectrum);
    const edges = card('Typed edges');
    edges.append(rows(snapshot?.edges?.slice(0, 80), (item) => {
      const node = el('div', 'knowledge-edge');
      node.append(badge(item.kind, item.kind === 'call' ? 'warn' : 'good'), el('strong', '', item.fromName ?? item.fromPath), el('span', 'knowledge-arrow', '→'), el('strong', '', item.toName ?? item.toPath), el('small', '', `${item.detector} · ${item.confidence}`));
      return node;
    }));
    const grid = el('div', 'knowledge-grid');
    grid.append(entities, edges);
    panel.replaceChildren(grid);
  };

  const renderSemantic = () => {
    const panel = get('knowledge-panel-semantic');
    panel.innerHTML = `<article class="knowledge-card knowledge-semantic-shell"><span class="eyebrow">Local hybrid retrieval</span><form id="knowledge-semantic-form" class="knowledge-form knowledge-semantic-form"><input id="knowledge-semantic-query" required placeholder="Where is authentication handled?" aria-label="Semantic query"><input id="knowledge-semantic-prefix" placeholder="src/" aria-label="Path prefix"><input id="knowledge-semantic-language" placeholder="javascript" aria-label="Language"><button class="primary-button">Search meaning</button></form><div id="knowledge-semantic-results" class="knowledge-list"></div></article>`;
    const draw = () => {
      const host = panel.querySelector('#knowledge-semantic-results');
      host.replaceChildren(...(semanticResult?.items ?? []).map((item) => {
        const node = el('article', 'knowledge-semantic-result');
        const header = el('header', 'knowledge-semantic-header');
        header.append(el('strong', '', item.path), badge(`L${item.startLine}–${item.endLine}`, 'signal'), badge(Number(item.score ?? 0).toFixed(3), 'good'));
        const sources = el('div', 'knowledge-semantic-sources');
        for (const source of item.sources ?? []) sources.append(badge(source, source === 'semantic' ? 'good' : 'signal'));
        const preview = el('pre', 'knowledge-semantic-preview', item.preview);
        const meters = el('div', 'knowledge-meters');
        for (const [name, value] of Object.entries(item.scoreBreakdown ?? {})) {
          const meter = el('span', 'knowledge-meter');
          meter.style.setProperty('--value', Math.min(100, Math.max(0, Number(value) * 100)));
          meter.title = `${name}: ${value}`;
          meter.append(el('small', '', name));
          meters.append(meter);
        }
        node.append(header, sources, preview, meters);
        return node;
      }));
      if (!semanticResult?.items?.length) host.append(empty('Nhập một câu hỏi để tìm theo nghĩa, lexical signal và dependency distance.'));
      if (semanticResult?.receiptSha256) host.append(receipt(semanticResult.receiptSha256));
    };
    panel.querySelector('#knowledge-semantic-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        semanticResult = await api('/api/semantic-dependency/search', {
          method: 'POST',
          body: JSON.stringify({
            projectId: state.projectId,
            query: panel.querySelector('#knowledge-semantic-query').value,
            pathPrefix: panel.querySelector('#knowledge-semantic-prefix').value || null,
            language: panel.querySelector('#knowledge-semantic-language').value || null,
            limit: 24,
          }),
        });
        renderStats();
        draw();
      } catch (error) { toast(error.message, true); }
    };
    draw();
  };

  const renderDependencies = () => {
    const panel = get('knowledge-panel-dependencies');
    panel.innerHTML = `<article class="knowledge-card knowledge-dependency-shell"><span class="eyebrow">File topology projection</span><form id="knowledge-dependency-form" class="knowledge-form knowledge-dependency-form"><input id="knowledge-dependency-root" placeholder="src/app.mjs" aria-label="Root file"><select id="knowledge-dependency-direction" aria-label="Direction"><option value="both">Both directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select><input id="knowledge-dependency-depth" type="number" min="0" max="8" value="3" aria-label="Depth"><button class="primary-button">Project graph</button></form><div id="knowledge-dependency-output"></div></article>`;
    const draw = () => {
      const host = panel.querySelector('#knowledge-dependency-output');
      host.replaceChildren();
      if (!dependencyResult) { host.append(empty('Chọn một file gốc hoặc xem toàn bộ topology đã index.')); return; }
      const focusPath = dependencyResult.focus?.path ?? null;
      const incomingPaths = new Set((dependencyResult.edges ?? []).filter((edge) => !focusPath || edge.toPath === focusPath).map((edge) => edge.fromPath));
      const outgoingPaths = new Set((dependencyResult.edges ?? []).filter((edge) => !focusPath || edge.fromPath === focusPath).map((edge) => edge.toPath));
      const lane = (title, nodes, tone) => {
        const column = el('section', `knowledge-dependency-lane ${tone}`);
        column.append(el('span', 'eyebrow', title));
        column.append(rows(nodes, (item) => {
          const node = el('div', 'knowledge-dependency-node');
          node.append(el('strong', '', item.path), el('small', '', `in ${item.incoming} · out ${item.outgoing}`));
          if (item.testRelated) node.append(badge('test-linked', 'warn'));
          return node;
        }));
        return column;
      };
      const nodes = dependencyResult.nodes ?? [];
      const focusNodes = focusPath ? nodes.filter((item) => item.path === focusPath) : nodes.slice().sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing)).slice(0, 8);
      const incomingNodes = focusPath ? nodes.filter((item) => incomingPaths.has(item.path)) : nodes.filter((item) => item.incoming === 0).slice(0, 12);
      const outgoingNodes = focusPath ? nodes.filter((item) => outgoingPaths.has(item.path)) : nodes.filter((item) => item.outgoing === 0).slice(0, 12);
      const lanes = el('div', 'knowledge-dependency-lanes');
      lanes.append(lane('Incoming / roots', incomingNodes, 'incoming'), lane(focusPath ? 'Focused file' : 'High-connectivity core', focusNodes, 'focus'), lane('Outgoing / leaves', outgoingNodes, 'outgoing'));

      const detailGrid = el('div', 'knowledge-grid knowledge-dependency-details');
      const cycles = card('Cycles');
      cycles.append(rows(dependencyResult.cycles, (cycle) => {
        const node = el('div', 'knowledge-row');
        node.append(badge('cycle', 'warn'), el('strong', '', cycle.paths.join(' ↔ ')));
        return node;
      }));
      const edges = card('Import evidence');
      edges.append(rows((dependencyResult.edges ?? []).slice(0, 80), (item) => {
        const node = el('div', 'knowledge-edge');
        node.append(badge(item.kind, 'good'), el('strong', '', item.fromPath), el('span', 'knowledge-arrow', '→'), el('strong', '', item.toPath), el('code', 'knowledge-evidence', `L${item.line}`));
        return node;
      }));
      detailGrid.append(cycles, edges);
      host.append(lanes, detailGrid, receipt(dependencyResult.receiptSha256));
    };
    panel.querySelector('#knowledge-dependency-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const rootPath = panel.querySelector('#knowledge-dependency-root').value;
        const direction = panel.querySelector('#knowledge-dependency-direction').value;
        const depth = panel.querySelector('#knowledge-dependency-depth').value;
        dependencyResult = await api(`/api/semantic-dependency/graph?projectId=${encodeURIComponent(state.projectId)}${rootPath ? `&rootPath=${encodeURIComponent(rootPath)}` : ''}&direction=${encodeURIComponent(direction)}&depth=${encodeURIComponent(depth)}&limit=500`);
        renderStats();
        draw();
      } catch (error) { toast(error.message, true); }
    };
    draw();
  };

  const renderAst = () => {
    const panel = get('knowledge-panel-ast');
    panel.innerHTML = `<article class="knowledge-card knowledge-ast-shell"><div class="knowledge-ast-heading"><div><span class="eyebrow">Compiler-backed local AST</span><h2>Query exact syntax nodes, then patch one guarded node</h2></div><span class="knowledge-ast-warning">JS / TS / JSX / TSX only · Tree-sitter is not claimed</span></div><form id="knowledge-ast-form" class="knowledge-form knowledge-ast-form"><input id="knowledge-ast-path" required placeholder="src/app.mjs" aria-label="Source path"><input id="knowledge-ast-node-type" required placeholder="FunctionDeclaration" aria-label="AST node type"><input id="knowledge-ast-name" placeholder="run" aria-label="Exact node name"><input id="knowledge-ast-ancestor" placeholder="ClassDeclaration" aria-label="Ancestor node type"><input id="knowledge-ast-text" placeholder="optional text signal" aria-label="Text contains"><button class="primary-button">Query AST</button></form><div class="knowledge-ast-layout"><div id="knowledge-ast-results" class="knowledge-list"></div><section class="knowledge-ast-editor"><span class="eyebrow">Guarded replacement</span><div id="knowledge-ast-selection" class="knowledge-ast-selection"></div><textarea id="knowledge-ast-replacement" class="knowledge-ast-replacement" spellcheck="false" aria-label="AST replacement" placeholder="Select exactly one node, then edit its replacement here."></textarea><div class="knowledge-actions"><button id="knowledge-ast-dry-run" type="button" class="secondary-button">Dry run</button><button id="knowledge-ast-apply" type="button" class="primary-button">Apply guarded patch</button></div><div id="knowledge-ast-patch-result"></div></section></div></article>`;

    const selectionHost = panel.querySelector('#knowledge-ast-selection');
    const replacement = panel.querySelector('#knowledge-ast-replacement');
    const drawSelection = () => {
      selectionHost.replaceChildren();
      if (!astSelected) {
        selectionHost.append(empty('Select one query result. File and node hashes will be bound to the patch.'));
        return;
      }
      const node = el('div', 'knowledge-ast-selected');
      node.append(badge(astSelected.nodeType, 'signal'), el('strong', '', astSelected.name ?? 'anonymous'), el('code', 'knowledge-evidence', `L${astSelected.startLine}:${astSelected.startColumn}–L${astSelected.endLine}:${astSelected.endColumn}`));
      node.append(el('small', '', `file ${String(astResult?.sourceSha256).slice(0, 12)} · node ${String(astSelected.nodeSha256).slice(0, 12)}`));
      selectionHost.append(node);
    };
    const drawPatch = () => {
      const host = panel.querySelector('#knowledge-ast-patch-result');
      host.replaceChildren();
      if (!astPatchResult) return;
      const node = el('article', 'knowledge-ast-patch-proof');
      node.append(badge(astPatchResult.dryRun ? 'dry-run' : 'applied', astPatchResult.dryRun ? 'warn' : 'good'), el('strong', '', `${astPatchResult.nodeType}${astPatchResult.name ? ` · ${astPatchResult.name}` : ''}`));
      node.append(el('small', '', `${astPatchResult.changedLines} changed lines · ${String(astPatchResult.beforeSha256).slice(0, 12)} → ${String(astPatchResult.afterSha256).slice(0, 12)}`));
      node.append(receipt(astPatchResult.receiptSha256));
      host.append(node);
    };
    const drawResults = () => {
      const host = panel.querySelector('#knowledge-ast-results');
      host.replaceChildren();
      for (const item of astResult?.items ?? []) {
        const node = el('article', `knowledge-ast-result${astSelected?.nodeSha256 === item.nodeSha256 ? ' selected' : ''}`);
        const header = el('header', 'knowledge-semantic-header');
        header.append(badge(item.nodeType, 'signal'), el('strong', '', item.name ?? 'anonymous'), badge(`L${item.startLine}–${item.endLine}`, 'good'));
        const preview = el('pre', 'knowledge-semantic-preview', item.preview);
        const choose = el('button', 'secondary-button', 'Select node');
        choose.type = 'button';
        choose.onclick = () => {
          astSelected = item;
          astPatchResult = null;
          replacement.value = item.preview;
          drawResults();
          drawSelection();
          drawPatch();
        };
        node.append(header, preview, choose);
        host.append(node);
      }
      if (!astResult?.items?.length) host.append(empty('Query an exact compiler node type to receive bounded, hash-addressed matches.'));
      if (astResult?.receiptSha256) host.append(receipt(astResult.receiptSha256));
    };
    const queryAst = async () => {
      astResult = await api('/api/code/ast-query', {
        method: 'POST',
        body: JSON.stringify({
          projectId: state.projectId,
          path: panel.querySelector('#knowledge-ast-path').value,
          nodeType: panel.querySelector('#knowledge-ast-node-type').value,
          name: panel.querySelector('#knowledge-ast-name').value || null,
          ancestorType: panel.querySelector('#knowledge-ast-ancestor').value || null,
          textContains: panel.querySelector('#knowledge-ast-text').value || null,
          limit: 50,
        }),
      });
      astSelected = null;
      astPatchResult = null;
      replacement.value = '';
      drawResults();
      drawSelection();
      drawPatch();
    };
    panel.querySelector('#knowledge-ast-form').onsubmit = async (event) => {
      event.preventDefault();
      try { await queryAst(); } catch (error) { toast(error.message, true); }
    };
    const patchAst = async (dryRun) => {
      if (!astSelected || !astResult?.sourceSha256) throw new Error('Select exactly one AST node before patching.');
      astPatchResult = await api('/api/code/ast-patch', {
        method: 'POST',
        body: JSON.stringify({
          projectId: state.projectId,
          path: astResult.path,
          nodeType: astSelected.nodeType,
          name: astSelected.name,
          replacement: replacement.value,
          expectedSha256: astResult.sourceSha256,
          expectedNodeSha256: astSelected.nodeSha256,
          dryRun,
        }),
      });
      drawPatch();
      if (!dryRun) {
        toast('AST patch applied atomically. Query evidence has been refreshed.');
        await queryAst();
      }
    };
    panel.querySelector('#knowledge-ast-dry-run').onclick = () => patchAst(true).catch((error) => toast(error.message, true));
    panel.querySelector('#knowledge-ast-apply').onclick = () => patchAst(false).catch((error) => toast(error.message, true));
    drawResults();
    drawSelection();
    drawPatch();
  };

  const renderInheritance = () => {
    const panel = get('knowledge-panel-inheritance');
    panel.innerHTML = `<article class="knowledge-card knowledge-inheritance-shell"><div class="knowledge-relationship-heading"><div><span class="eyebrow">Compiler-backed type relationships</span><h2>Local extends and implements topology</h2></div><span class="knowledge-ast-warning">JS / TS / JSX / TSX · unresolved bases stay explicit</span></div><form id="knowledge-inheritance-form" class="knowledge-form knowledge-inheritance-form"><input id="knowledge-inheritance-root" placeholder="FeatureService" aria-label="Inheritance root"><input id="knowledge-inheritance-path" placeholder="src/feature.ts" aria-label="Exact source path"><select id="knowledge-inheritance-direction" aria-label="Inheritance direction"><option value="both">Both directions</option><option value="ancestors">Ancestors</option><option value="descendants">Descendants</option></select><input id="knowledge-inheritance-depth" type="number" min="0" max="12" value="4" aria-label="Inheritance depth"><button class="primary-button">Trace hierarchy</button></form><div id="knowledge-inheritance-map" class="knowledge-inheritance-map"></div></article>`;
    const draw = () => {
      const host = panel.querySelector('#knowledge-inheritance-map');
      host.replaceChildren();
      const nodes = card('Type nodes');
      nodes.append(rows(inheritanceResult?.nodes, (item) => {
        const node = el('div', 'knowledge-inheritance-node');
        node.append(badge(item.kind, 'signal'), el('strong', '', item.name), el('code', 'knowledge-evidence', `${item.path}:L${item.line}`), el('small', '', item.confidence));
        return node;
      }));
      const edges = card('Resolved heritage edges');
      edges.append(rows(inheritanceResult?.edges, (item) => {
        const node = el('div', 'knowledge-inheritance-edge');
        node.append(badge(item.relation, item.relation === 'implements' ? 'good' : 'signal'), el('strong', '', item.childName), el('span', 'knowledge-arrow', '→'), el('strong', '', item.parentName), badge(item.resolution, 'good'), el('code', 'knowledge-evidence', `${item.childPath}:L${item.line}`));
        return node;
      }));
      const unresolved = card('Unresolved evidence');
      unresolved.classList.add('knowledge-inheritance-unresolved');
      unresolved.append(rows(inheritanceResult?.unresolved, (item) => {
        const node = el('div', 'knowledge-inheritance-edge unresolved');
        node.append(badge(item.relation, 'warn'), el('strong', '', item.childName), el('span', 'knowledge-arrow', '⇢'), el('strong', '', item.parentName), badge(item.reason, 'warn'), el('code', 'knowledge-evidence', `${item.childPath}:L${item.line}`));
        return node;
      }));
      host.append(nodes, edges, unresolved);
      if (inheritanceResult?.receiptSha256) host.append(receipt(inheritanceResult.receiptSha256));
    };
    panel.querySelector('#knowledge-inheritance-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const rootName = panel.querySelector('#knowledge-inheritance-root').value;
        const sourcePath = panel.querySelector('#knowledge-inheritance-path').value;
        const direction = panel.querySelector('#knowledge-inheritance-direction').value;
        const depth = panel.querySelector('#knowledge-inheritance-depth').value;
        inheritanceResult = await api(`/api/code-relationships/inheritance?projectId=${encodeURIComponent(state.projectId)}${rootName ? `&root=${encodeURIComponent(rootName)}` : ''}${sourcePath ? `&path=${encodeURIComponent(sourcePath)}` : ''}&direction=${encodeURIComponent(direction)}&depth=${encodeURIComponent(depth)}&limit=300`);
        renderStats();
        draw();
      } catch (error) { toast(error.message, true); }
    };
    draw();
  };

  const renderIssues = () => {
    const panel = get('knowledge-panel-issues');
    panel.innerHTML = `<article class="knowledge-card knowledge-issue-shell"><div class="knowledge-relationship-heading"><div><span class="eyebrow">Local evidence only</span><h2>Issue-to-code links from source context and Git commits</h2></div><span class="knowledge-ast-warning">No remote issue status or provider synchronization is claimed</span></div><form id="knowledge-issue-form" class="knowledge-form knowledge-issue-form"><input id="knowledge-issue-key" placeholder="GH-42 or #123" aria-label="Issue key"><input id="knowledge-issue-prefix" placeholder="src/" aria-label="Path prefix"><button class="primary-button">Filter links</button></form><div id="knowledge-issue-results" class="knowledge-issue-results"></div></article>`;
    const draw = () => {
      const host = panel.querySelector('#knowledge-issue-results');
      host.replaceChildren();
      const summary = el('div', 'knowledge-issue-grid');
      for (const issue of issueResult?.issues ?? []) {
        const node = el('article', 'knowledge-issue-card');
        node.append(badge(issue.key, 'signal'), el('strong', '', `${issue.linkCount} evidence links`), el('small', '', `${issue.sourceLinks} source · ${issue.commitLinks} commit`));
        const paths = el('div', 'knowledge-semantic-sources');
        for (const filePath of issue.paths ?? []) paths.append(badge(filePath, 'good'));
        node.append(paths);
        summary.append(node);
      }
      if (!summary.childElementCount) summary.append(empty('No contextual issue references are indexed for this filter.'));
      const links = card('Evidence links');
      links.append(rows(issueResult?.links, (item) => {
        const node = el('div', 'knowledge-issue-link');
        node.append(badge(item.issueKey, 'signal'), el('strong', '', item.path), item.line ? el('code', 'knowledge-evidence', `L${item.line}`) : el('code', 'knowledge-evidence', String(item.commitHash ?? '').slice(0, 12)), badge(item.detector, item.commitHash ? 'good' : 'signal'), el('small', '', item.evidence));
        if (item.commitHash) node.dataset.commitHash = item.commitHash;
        return node;
      }));
      host.append(summary, links);
      if (issueResult?.receiptSha256) host.append(receipt(issueResult.receiptSha256));
    };
    panel.querySelector('#knowledge-issue-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const key = panel.querySelector('#knowledge-issue-key').value;
        const prefix = panel.querySelector('#knowledge-issue-prefix').value;
        issueResult = await api(`/api/code-relationships/issues?projectId=${encodeURIComponent(state.projectId)}${key ? `&issueKey=${encodeURIComponent(key)}` : ''}${prefix ? `&pathPrefix=${encodeURIComponent(prefix)}` : ''}&limit=300`);
        renderStats();
        draw();
      } catch (error) { toast(error.message, true); }
    };
    draw();
  };

  const renderEntities = (kind, title) => {
    const panel = get(kind === 'database_model' ? 'knowledge-panel-models' : 'knowledge-panel-routes');
    const kinds = kind === 'database_model' ? ['database_model'] : ['route', 'api_endpoint'];
    const items = (snapshot?.entities ?? []).filter((item) => kinds.includes(item.kind));
    const node = card(title);
    node.append(rows(items, (item) => {
      const row = el('div', 'knowledge-row');
      row.append(badge(item.kind, 'signal'), el('strong', '', item.name), evidence(item), el('small', '', `${item.detector} · ${item.confidence}`));
      return row;
    }));
    panel.replaceChildren(node);
  };

  const renderReferences = () => {
    const panel = get('knowledge-panel-references');
    const node = card('Reference and conservative call index');
    node.append(rows((snapshot?.edges ?? []).filter((item) => ['reference', 'call', 'import', 'test_relation'].includes(item.kind)), (item) => {
      const row = el('div', 'knowledge-row');
      row.append(badge(item.kind, item.kind === 'call' ? 'warn' : 'good'), el('strong', '', `${item.fromName ?? item.fromPath} → ${item.toName ?? item.toPath}`), el('code', 'knowledge-evidence', `${item.fromPath}:${item.line}`), el('small', '', item.confidence));
      return row;
    }));
    panel.replaceChildren(node);
  };

  const renderHistory = () => {
    const panel = get('knowledge-panel-history');
    const node = card('Git-indexed file history');
    node.append(rows(snapshot?.history, (item) => {
      const row = el('div', 'knowledge-row');
      row.append(el('strong', '', item.path), badge(`${item.commitCount} commits`, 'signal'), el('code', 'knowledge-evidence', String(item.lastCommitHash ?? '').slice(0, 12)), el('small', '', item.lastCommitAt ?? 'unknown'));
      return row;
    }));
    panel.replaceChildren(node);
  };

  const renderRegex = () => {
    const panel = get('knowledge-panel-regex');
    panel.innerHTML = '<article class="knowledge-card"><span class="eyebrow">Bounded regex</span><form id="knowledge-regex-form" class="knowledge-form"><input id="knowledge-regex-pattern" placeholder="app\\.(get|post)" aria-label="Regex pattern"><button class="primary-button">Search</button></form><div id="knowledge-regex-results" class="knowledge-list"></div></article>';
    panel.querySelector('#knowledge-regex-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const pattern = panel.querySelector('#knowledge-regex-pattern').value;
        const result = await api(`/api/codebase-knowledge/regex?projectId=${encodeURIComponent(state.projectId)}&pattern=${encodeURIComponent(pattern)}`);
        const host = panel.querySelector('#knowledge-regex-results');
        host.replaceChildren(...result.map((item) => {
          const row = el('div', 'knowledge-row');
          row.append(el('strong', '', item.path), el('code', 'knowledge-evidence', `L${item.line}:${item.column}`), el('span', '', item.preview));
          return row;
        }));
        if (!result.length) host.append(empty('Không có kết quả.'));
      } catch (error) { toast(error.message, true); }
    };
  };

  const renderWatch = () => {
    const panel = get('knowledge-panel-watch');
    const node = card('Portable incremental watcher');
    const status = el('div', 'knowledge-watch-status');
    status.append(badge(watch?.state ?? 'stopped', watch?.state === 'watching' ? 'good' : 'warn'), el('strong', '', watch?.mode ?? 'portable-polling'), el('small', '', watch?.lastIndexedAt ? `Last indexed ${watch.lastIndexedAt}` : 'No refresh yet'));
    const actions = el('div', 'knowledge-actions');
    const start = el('button', 'primary-button', 'Start watch');
    const stop = el('button', 'secondary-button', 'Stop watch');
    start.onclick = () => watchAction('start');
    stop.onclick = () => watchAction('stop');
    actions.append(start, stop);
    node.append(status, actions);
    panel.replaceChildren(node);
  };

  const renderRanking = () => {
    const panel = get('knowledge-panel-ranking');
    panel.innerHTML = '<article class="knowledge-card"><span class="eyebrow">Explainable ranking</span><form id="knowledge-rank-form" class="knowledge-form"><input id="knowledge-rank-query" placeholder="authentication flow" aria-label="Ranking query"><input id="knowledge-rank-seed" placeholder="src/api.mjs" aria-label="Seed path"><button class="primary-button">Rank</button></form><div id="knowledge-rank-results" class="knowledge-list"></div></article>';
    const draw = () => {
      const host = panel.querySelector('#knowledge-rank-results');
      host.replaceChildren(...(ranked?.items ?? []).map((item) => {
        const row = el('div', 'knowledge-rank-row');
        row.append(el('strong', '', item.path), badge(item.score.toFixed(2), 'signal'));
        const meters = el('div', 'knowledge-meters');
        for (const [name, value] of Object.entries(item.scoreBreakdown)) {
          const meter = el('span', 'knowledge-meter');
          meter.style.setProperty('--value', Math.min(100, Number(value) * 5));
          meter.title = `${name}: ${value}`;
          meter.append(el('small', '', name));
          meters.append(meter);
        }
        row.append(meters);
        return row;
      }));
      if (!ranked?.items?.length) host.append(empty('Chạy ranking để xem dependency, recency và test signals.'));
    };
    panel.querySelector('#knowledge-rank-form').onsubmit = async (event) => {
      event.preventDefault();
      try {
        const query = panel.querySelector('#knowledge-rank-query').value;
        const seed = panel.querySelector('#knowledge-rank-seed').value;
        ranked = await api(`/api/codebase-knowledge/rank?projectId=${encodeURIComponent(state.projectId)}&q=${encodeURIComponent(query)}${seed ? `&seed=${encodeURIComponent(seed)}` : ''}`);
        draw();
      } catch (error) { toast(error.message, true); }
    };
    draw();
  };

  const render = () => {
    renderStats();
    renderGraph();
    renderSemantic();
    renderDependencies();
    renderAst();
    renderInheritance();
    renderIssues();
    renderEntities('route', 'Routes & APIs');
    renderEntities('database_model', 'Data Models');
    renderReferences();
    renderHistory();
    renderRegex();
    renderWatch();
    renderRanking();
    setTab(tab);
  };

  const load = async () => {
    if (!state.projectId) {
      snapshot = null;
      watch = null;
      dependencyResult = null;
      astResult = null;
      astSelected = null;
      astPatchResult = null;
      inheritanceResult = null;
      issueResult = null;
      render();
      return;
    }
    const project = encodeURIComponent(state.projectId);
    [snapshot, watch, dependencyResult, inheritanceResult, issueResult] = await Promise.all([
      api(`/api/codebase-knowledge?projectId=${project}&limit=1000`),
      api(`/api/codebase-knowledge/watch?projectId=${project}`),
      api(`/api/semantic-dependency/graph?projectId=${project}&direction=both&depth=3&limit=500`),
      api(`/api/code-relationships/inheritance?projectId=${project}&direction=both&depth=4&limit=300`),
      api(`/api/code-relationships/issues?projectId=${project}&limit=300`),
    ]);
    render();
  };

  const watchAction = async (operation) => {
    try {
      watch = await api(`/api/codebase-knowledge/watch/${operation}`, { method: 'POST', body: JSON.stringify({ projectId: state.projectId }) });
      renderWatch();
      toast(operation === 'start' ? 'Đã bật live knowledge watch.' : 'Đã dừng live knowledge watch.');
    } catch (error) { toast(error.message, true); }
  };

  for (const [id, label] of Object.entries(TABS)) {
    const button = el('button', id === tab ? 'active' : '', label);
    button.type = 'button';
    button.dataset.knowledgeTab = id;
    button.onclick = () => setTab(id);
    get('knowledge-tabs').append(button);
  }
  get('knowledge-refresh').onclick = () => load().catch((error) => toast(error.message, true));
  get('knowledge-index').onclick = async () => {
    try {
      await api('/api/semantic-dependency/index', { method: 'POST', body: JSON.stringify({ projectId: state.projectId }) });
      await api('/api/code-relationships/index', { method: 'POST', body: JSON.stringify({ projectId: state.projectId }) });
      await load();
      toast('Semantic, dependency, inheritance và issue indexes đã được cập nhật.');
    } catch (error) { toast(error.message, true); }
  };

  return Object.freeze({
    async open() { setView('codebaseKnowledge'); await load(); },
    async setProject() { if (!root.hidden) await load(); },
    load,
  });
}
