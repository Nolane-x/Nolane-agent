const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const CAPABILITY_LABELS = Object.freeze({ text: 'Text', tools: 'Tools', parallelTools: 'Parallel tools', structuredOutput: 'Structured output', streaming: 'Streaming', vision: 'Vision', audio: 'Audio', reasoning: 'Reasoning', cancellation: 'Cancellation' });

function capabilityStatus(value) {
  if (value === true || value?.status === 'supported' || value?.supported === true) return ['Supported', 'supported'];
  if (value === false || value?.status === 'unsupported' || value?.supported === false) return ['Unsupported', 'unsupported'];
  if (value?.status === 'error') return ['Probe error', 'error'];
  return ['Unknown', 'unknown'];
}

function contextLabel(profile) {
  const input = Number(profile?.context?.inputTokens ?? profile?.limits?.contextWindow ?? 0);
  const output = Number(profile?.context?.outputTokens ?? profile?.limits?.maxOutputTokens ?? 0);
  const format = (value) => value >= 1_000_000 ? `${Math.round(value / 100_000) / 10}M` : value >= 1000 ? `${Math.round(value / 100) / 10}K` : value || 'Unknown';
  return `${format(input)} input · ${format(output)} output`;
}

function canonicalId(profile) { return profile?.truth?.canonicalId ?? profile?.metadata?.canonicalId ?? profile?.key ?? `${profile?.providerId}/${profile?.modelId}`; }

function truthBadges(profile) {
  const truth = profile?.truth; if (!truth) return '<span class="model-truth-badge" data-truth-state="unknown">Truth unknown</span>';
  const summary = truth.facts ?? {};
  const state = summary.conflicted ? 'conflicted' : summary.expired ? 'expired' : summary.stale ? 'stale' : summary.fresh ? 'fresh' : truth.resolution === 'exact' ? 'verified' : truth.resolution ?? 'unknown';
  const label = state === 'fresh' ? `${summary.fresh} fresh facts` : state === 'conflicted' ? `${summary.conflicted} conflicts` : state === 'stale' ? `${summary.stale} stale facts` : state === 'expired' ? `${summary.expired} expired facts` : state;
  return `<span class="model-truth-badge" data-truth-state="${esc(state)}">${esc(label)}</span><span class="model-truth-badge" data-truth-state="evaluation">${Number(truth.evaluations ?? 0)} evals</span>`;
}

function dossierDetails(profile, dossier) {
  const canonical = canonicalId(profile);
  if (!dossier) return `<details class="routing-diagnostics"><summary>Canonical dossier &amp; Routing diagnostics</summary><p class="model-dossier-empty">Open the dossier to load canonical entities, provenance, conflicts, and observations.</p></details>`;
  const truth = dossier.truth ?? {};
  const facts = truth.facts?.summary ?? {};
  const bundle = truth.bundle ?? {};
  const payload = {
    canonicalId: canonical,
    baseModelId: bundle.baseModel?.id ?? null,
    snapshotId: bundle.snapshot?.id ?? null,
    deploymentIds: bundle.deployments?.map((item) => item.id) ?? [],
    localArtifactIds: bundle.localArtifacts?.map((item) => item.id) ?? [],
    factSummary: facts,
    evaluations: truth.evaluations?.length ?? 0,
    runtimeObservations: truth.runtimeObservations?.length ?? 0,
    warnings: dossier.uncertainty?.warnings ?? [],
    receiptSha256: dossier.receiptSha256,
  };
  return `<details class="routing-diagnostics" open><summary>Canonical dossier &amp; Routing diagnostics</summary><pre>${esc(JSON.stringify(payload, null, 2))}</pre></details>`;
}

function comparisonView(comparison = {}) {
  const rows = comparison.result?.rows ?? [];
  if (!rows.length) return '';
  return `<section class="model-comparison" aria-labelledby="model-comparison-title"><header><div><p class="eyebrow">Deployment comparison</p><h3 id="model-comparison-title">Compared model deployments</h3></div><span>${rows.length} selected</span></header><div class="model-comparison-table" role="table"><div role="row" class="model-comparison-row model-comparison-head"><strong role="columnheader">Model</strong><strong role="columnheader">Context</strong><strong role="columnheader">Tools</strong><strong role="columnheader">Cost / 1M input</strong><strong role="columnheader">Freshness</strong><strong role="columnheader">Policy</strong></div>${rows.map((row)=>`<div role="row" class="model-comparison-row"><span role="cell"><b>${esc(row.modelId)}</b><small>${esc(row.providerFamily)}</small></span><span role="cell">${esc(row.context?.contextWindow ?? 'Unknown')}</span><span role="cell">${esc(capabilityStatus(row.toolCalling?.supported)[0])}</span><span role="cell">${row.pricing?.inputPerMillion == null ? 'Unknown' : `$${esc(row.pricing.inputPerMillion)}`}</span><span role="cell">${esc(row.freshness?.conflicted ? `${row.freshness.conflicted} conflicts` : row.freshness?.fresh ? `${row.freshness.fresh} fresh` : 'Unknown')}</span><span role="cell">${row.evaluation ? (row.evaluation.eligible ? 'Eligible' : `${row.evaluation.blockers?.length ?? 0} blockers`) : 'Not evaluated'}</span></div>`).join('')}</div><small class="model-comparison-receipt">Receipt ${esc(comparison.result.receiptSha256)}</small></section>`;
}

function providerCard(provider, models, experience, comparison, dossiers) {
  const selected = new Set(comparison?.selected ?? []);
  const rows = models.length ? models.map((profile) => {
    const canonical = canonicalId(profile);
    const capabilityEntries = Object.entries({ text: profile.capabilities?.text, tools: profile.capabilities?.tools, structuredOutput: profile.capabilities?.structuredOutput, streaming: profile.capabilities?.streaming, vision: profile.capabilities?.vision }).map(([name, value]) => {
      const [label, status] = capabilityStatus(value);
      return `<li data-capability-status="${status}"><span>${esc(CAPABILITY_LABELS[name] ?? name)}</span><strong>${esc(label)}</strong></li>`;
    }).join('');
    const lifecycle = profile.lifecycle ?? 'unknown';
    const lastProbe = profile.probed?.updatedAt ?? profile.probe?.updatedAt ?? null;
    return `<article class="model-profile-card" data-model-key="${esc(profile.key ?? `${profile.providerId}/${profile.modelId}`)}" data-canonical-model-id="${esc(canonical)}"><header><div><p class="model-provider">${esc(provider?.label ?? profile.providerId)}</p><h4>${esc(profile.displayName ?? profile.modelId)}</h4><p class="model-id">${esc(profile.modelId)}</p></div><div class="model-card-badges"><span class="model-lifecycle" data-lifecycle="${esc(lifecycle)}">${esc(lifecycle)}</span>${truthBadges(profile)}</div></header><dl><div><dt>Context</dt><dd>${esc(contextLabel(profile))}</dd></div><div><dt>Tokenizer</dt><dd>${esc(profile.tokenizerId ?? 'Unknown')}</dd></div><div><dt>Last probe</dt><dd>${esc(lastProbe ?? 'Never')}</dd></div></dl><ul class="capability-matrix" aria-label="Model capabilities">${capabilityEntries}</ul><div class="model-card-actions"><button type="button" data-model-action="probe" data-provider-id="${esc(profile.providerId)}" data-model-id="${esc(profile.modelId)}">Probe</button>${experience === 'expert' || experience === 'research' ? `<button type="button" data-model-action="inspect" data-model-id="${esc(canonical)}">Dossier</button><label class="model-compare-choice" data-model-action="toggle-compare" data-model-id="${esc(canonical)}"><input type="checkbox"${selected.has(canonical) ? ' checked' : ''}> Compare</label>` : ''}</div>${experience === 'expert' || experience === 'research' ? dossierDetails(profile, dossiers?.[canonical]) : ''}</article>`;
  }).join('') : '<p class="model-empty">No discovered models for this provider yet.</p>';
  const id = provider?.id ?? models[0]?.providerId ?? 'unassigned';
  return `<section class="provider-model-group" data-provider-id="${esc(id)}"><header class="provider-model-heading"><div><h3>${esc(provider?.label ?? id)}</h3><p>${provider?.configured === false ? 'Not configured' : 'Connected or available'}</p></div><button type="button" data-model-action="discover" data-provider-id="${esc(id)}">Discover models</button></header><div class="model-profile-grid">${rows}</div></section>`;
}

export function renderModelProfilesPanel(snapshot = {}, { experience = 'standard', comparison = {}, dossiers = {} } = {}) {
  const models = snapshot.models ?? [];
  const providers = snapshot.providers ?? [];
  const providerMap = new Map(providers.map((provider) => [String(provider.id), provider]));
  const grouped = new Map();
  for (const profile of models) {
    const providerId = String(profile.providerId ?? 'unassigned');
    if (!grouped.has(providerId)) grouped.set(providerId, []);
    grouped.get(providerId).push(profile);
  }
  for (const provider of providers) if (!grouped.has(String(provider.id))) grouped.set(String(provider.id), []);
  const content = [...grouped.entries()].map(([providerId, entries]) => providerCard(providerMap.get(providerId) ?? { id: providerId, label: providerId }, entries, experience, comparison, dossiers)).join('');
  const compareActions = (experience === 'expert' || experience === 'research') ? `<div class="model-comparison-actions"><span>${comparison.selected?.length ?? 0}/5 selected</span><button type="button" data-model-action="compare"${(comparison.selected?.length ?? 0) < 2 ? ' disabled' : ''}>Compare deployments</button><button type="button" data-model-action="clear-compare"${(comparison.selected?.length ?? 0) === 0 ? ' disabled' : ''}>Clear</button></div>` : '';
  return `<section class="model-profiles-panel" aria-labelledby="model-profiles-title"><header class="model-profiles-intro"><div><p class="eyebrow">Model intelligence</p><h2 id="model-profiles-title">Model Profiles</h2><p>Discover provider models, verify selected capabilities, and inspect canonical base, snapshot, deployment, artifact, provenance, freshness, and conflict records.</p></div><span class="model-profile-count">${models.length} model${models.length === 1 ? '' : 's'}</span></header>${compareActions}${comparisonView(comparison)}${content || '<p class="model-empty">Configure a provider to discover and profile models.</p>'}${experience === 'expert' || experience === 'research' ? '<aside class="model-profile-note" role="note"><strong>Expert view:</strong> compatibility records remain available, while canonical truth, field provenance, conflict states, evaluation receipts, and runtime observations are shown without exposing credentials.</aside>' : ''}</section>`;
}
