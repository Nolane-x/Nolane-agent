import { renderOptionPicker } from '../../components/option-picker.b29fc0d62aed.mjs';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
const CAPABILITY_LABELS = Object.freeze({ text: ['Text', 'Văn bản'], tools: ['Tools', 'Công cụ'], parallelTools: ['Parallel tools', 'Công cụ song song'], structuredOutput: ['Structured output', 'Đầu ra có cấu trúc'], streaming: ['Streaming', 'Phát trực tiếp'], vision: ['Vision', 'Hình ảnh'], audio: ['Audio', 'Âm thanh'], reasoning: ['Reasoning', 'Suy luận'], cancellation: ['Cancellation', 'Hủy'] });
const DISCOVERABLE_KINDS = new Set(['openai-responses', 'anthropic-messages', 'gemini-generate-content', 'openai-compatible', 'cli']);
const CLI_MODEL_KINDS = new Set(['cli', 'codex-app-server']);

function capabilityStatus(value) {
  if (value === true || value?.status === 'supported' || value?.supported === true) return ['Supported', 'supported'];
  if (value === false || value?.status === 'unsupported' || value?.supported === false) return ['Unsupported', 'unsupported'];
  if (value?.status === 'error') return ['Probe error', 'error'];
  return ['Unknown', 'unknown'];
}

function localizedUnknown(lang = 'en') { return lang === 'vi' ? 'Chưa biết' : 'Unknown'; }

function localizedCapabilityLabel(value, lang = 'en') {
  const [label] = capabilityStatus(value);
  return lang === 'vi' ? ({ Supported: 'Được hỗ trợ', Unsupported: 'Không hỗ trợ', 'Probe error': 'Lỗi kiểm tra', Unknown: 'Chưa biết' }[label] ?? label) : label;
}

function contextLabel(profile, lang = 'en') {
  const input = Number(profile?.context?.inputTokens ?? profile?.limits?.contextWindow ?? 0);
  const output = Number(profile?.context?.outputTokens ?? profile?.limits?.maxOutputTokens ?? 0);
  const format = (value) => value >= 1_000_000 ? `${Math.round(value / 100_000) / 10}M` : value >= 1000 ? `${Math.round(value / 100) / 10}K` : value || localizedUnknown(lang);
  return lang === 'vi' ? `${format(input)} đầu vào · ${format(output)} đầu ra` : `${format(input)} input · ${format(output)} output`;
}

function canonicalId(profile) { return profile?.truth?.canonicalId ?? profile?.metadata?.canonicalId ?? profile?.key ?? `${profile?.providerId}/${profile?.modelId}`; }

function truthBadges(profile, lang = 'en') {
  const vi = lang === 'vi';
  const truth = profile?.truth; if (!truth) return `<span class="model-truth-badge" data-truth-state="unknown">${vi ? 'Chưa xác định nguồn sự thật' : 'Truth unknown'}</span>`;
  const summary = truth.facts ?? {};
  const state = summary.conflicted ? 'conflicted' : summary.expired ? 'expired' : summary.stale ? 'stale' : summary.fresh ? 'fresh' : truth.resolution === 'exact' ? 'verified' : truth.resolution ?? 'unknown';
  const label = state === 'fresh' ? (vi ? `${summary.fresh} dữ kiện mới` : `${summary.fresh} fresh facts`) : state === 'conflicted' ? (vi ? `${summary.conflicted} xung đột` : `${summary.conflicted} conflicts`) : state === 'stale' ? (vi ? `${summary.stale} dữ kiện cũ` : `${summary.stale} stale facts`) : state === 'expired' ? (vi ? `${summary.expired} dữ kiện hết hạn` : `${summary.expired} expired facts`) : ({ verified: vi ? 'Đã xác minh' : 'verified', exact: vi ? 'Đã xác minh' : 'exact', inferred: vi ? 'Suy luận' : 'inferred', compatible: vi ? 'Tương thích' : 'compatible', unknown: vi ? 'Chưa biết' : 'unknown' }[state] ?? state);
  return `<span class="model-truth-badge" data-truth-state="${esc(state)}">${esc(label)}</span><span class="model-truth-badge" data-truth-state="evaluation">${Number(truth.evaluations ?? 0)} ${vi ? 'lượt đánh giá' : 'evals'}</span>`;
}

function dossierDetails(profile, dossier, lang = 'en') {
  const canonical = canonicalId(profile);
  if (!dossier) return `<details class="routing-diagnostics"><summary>${lang === 'vi' ? 'Hồ sơ chuẩn &amp; chẩn đoán định tuyến' : 'Canonical dossier &amp; Routing diagnostics'}</summary><p class="model-dossier-empty">${lang === 'vi' ? 'Mở hồ sơ để tải thực thể chuẩn, nguồn gốc, xung đột và quan sát.' : 'Open the dossier to load canonical entities, provenance, conflicts, and observations.'}</p></details>`;
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
  return `<details class="routing-diagnostics" open><summary>${lang === 'vi' ? 'Hồ sơ chuẩn &amp; chẩn đoán định tuyến' : 'Canonical dossier &amp; Routing diagnostics'}</summary><pre>${esc(JSON.stringify(payload, null, 2))}</pre></details>`;
}

function comparisonView(comparison = {}, lang = 'en') {
  const vi = lang === 'vi';
  const rows = comparison.result?.rows ?? [];
  if (!rows.length) return '';
  const label = (en, viText) => vi ? viText : en;
  return `<section class="model-comparison" aria-labelledby="model-comparison-title"><header><div><p class="eyebrow">${label('Deployment comparison', 'So sánh triển khai')}</p><h3 id="model-comparison-title">${label('Compared model deployments', 'Các triển khai model đã chọn')}</h3></div><span>${rows.length} ${label('selected', 'đã chọn')}</span></header><div class="model-comparison-table" role="table"><div role="row" class="model-comparison-row model-comparison-head"><strong role="columnheader">${label('Model', 'Model')}</strong><strong role="columnheader">${label('Context', 'Ngữ cảnh')}</strong><strong role="columnheader">${label('Tools', 'Công cụ')}</strong><strong role="columnheader">${label('Cost / 1M input', 'Chi phí / 1M đầu vào')}</strong><strong role="columnheader">${label('Freshness', 'Độ mới')}</strong><strong role="columnheader">${label('Policy', 'Chính sách')}</strong></div>${rows.map((row)=>`<div role="row" class="model-comparison-row"><span role="cell"><b>${esc(row.modelId)}</b><small>${esc(row.providerFamily)}</small></span><span role="cell">${esc(row.context?.contextWindow ?? label('Unknown', 'Chưa biết'))}</span><span role="cell">${esc(localizedCapabilityLabel(row.toolCalling?.supported, lang))}</span><span role="cell">${row.pricing?.inputPerMillion == null ? label('Unknown', 'Chưa biết') : `$${esc(row.pricing.inputPerMillion)}`}</span><span role="cell">${esc(row.freshness?.conflicted ? `${row.freshness.conflicted} ${label('conflicts', 'xung đột')}` : row.freshness?.fresh ? `${row.freshness.fresh} ${label('fresh', 'mới')}` : label('Unknown', 'Chưa biết'))}</span><span role="cell">${row.evaluation ? (row.evaluation.eligible ? label('Eligible', 'Đủ điều kiện') : `${row.evaluation.blockers?.length ?? 0} ${label('blockers', 'chặn')}`) : label('Not evaluated', 'Chưa đánh giá')}</span></div>`).join('')}</div><small class="model-comparison-receipt">${label('Receipt', 'Receipt')} ${esc(comparison.result.receiptSha256)}</small></section>`;
}

const API_PROVIDER_KINDS = Object.freeze([
  ['openai-responses', 'OpenAI API', 'https://api.openai.com/v1'],
  ['anthropic-messages', 'Anthropic API', 'https://api.anthropic.com/v1'],
  ['gemini-generate-content', 'Google Gemini API', 'https://generativelanguage.googleapis.com/v1beta'],
  ['openai-compatible', 'OpenAI-compatible API', 'http://127.0.0.1:11434/v1'],
]);

const API_PROVIDER_LABELS_VI = Object.freeze({
  'openai-responses': 'OpenAI API',
  'anthropic-messages': 'Anthropic API',
  'gemini-generate-content': 'Google Gemini API',
  'openai-compatible': 'API tương thích OpenAI',
});
const API_MODEL_KINDS = new Set(API_PROVIDER_KINDS.map(([kind]) => kind));

function providerSetup(lang = 'en') {
  const vi = lang === 'vi';
  return `<form class="model-provider-setup" data-model-provider-setup autocomplete="off" novalidate>
    <div class="model-provider-setup__intro"><div><p class="eyebrow">${vi ? 'Kết nối API' : 'API connection'}</p><h3>${vi ? 'Thêm provider API' : 'Add an API provider'}</h3><p>${vi ? 'Lưu credential trước để Nolane khám phá model thực của tài khoản, sau đó mới chọn model mặc định.' : 'Save credentials first so Nolane can discover the models your account can use, then choose a default.'}</p></div><span class="model-provider-setup__secure">${vi ? 'Khóa được lưu trong vault' : 'Keys stay in the vault'}</span></div>
    <div class="model-provider-setup__grid">
      <label><span>${vi ? 'Loại provider' : 'Provider type'}</span>${renderOptionPicker({ id: 'model-provider-kind', label: vi ? 'Loại provider' : 'Provider type', selected: API_PROVIDER_KINDS[0][0], options: API_PROVIDER_KINDS.map(([value, label]) => ({ value, label: vi ? API_PROVIDER_LABELS_VI[value] : label })), className: 'model-provider-kind-picker', valueDataAttribute: 'data-model-provider-kind', name: 'kind' })}</label>
      <label><span>${vi ? 'ID provider' : 'Provider ID'}</span><input name="id" value="openai-api" placeholder="openai-api" pattern="[A-Za-z0-9][A-Za-z0-9._:-]{0,127}" required></label>
      <label><span>${vi ? 'Model mặc định (không bắt buộc)' : 'Default model (optional)'}</span><input name="model" placeholder="gpt-5.2"></label>
      <label class="model-provider-setup__wide"><span>${vi ? 'Base URL (để trống để dùng mặc định)' : 'Base URL (leave blank for provider default)'}</span><input name="baseUrl" placeholder="https://api.openai.com/v1" inputmode="url" autocomplete="url"></label>
      <label class="model-provider-setup__wide"><span>${vi ? 'API key' : 'API key'}</span><input name="apiKey" type="password" placeholder="sk-…" autocomplete="new-password" data-model-api-key></label>
    </div>
    <div class="model-provider-setup__footer"><p id="model-provider-setup-help">${vi ? 'API key chỉ được gửi một lần qua kênh cục bộ và không xuất hiện trong hồ sơ, log hoặc receipt.' : 'The API key is sent once over the local control plane and is never returned in profiles, logs, or receipts.'}</p><button type="button" class="primary" data-model-action="configure">${vi ? 'Lưu credential & khám phá model' : 'Save credentials & discover models'}</button></div>
  </form>`;
}

function titleCase(value) { return String(value ?? '').replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function loginModeLabel(providerId, mode, lang = 'en') {
  const vi = lang === 'vi';
  if (mode === 'chatgpt') return vi ? 'Đăng nhập ChatGPT' : 'Sign in with ChatGPT';
  if (mode === 'chatgptDeviceCode') return vi ? 'Dùng mã thiết bị' : 'Use device code';
  if (mode === 'claudeai') return vi ? 'Đăng nhập Claude Pro/Max' : 'Sign in with Claude Pro/Max';
  if (mode === 'console') return 'Anthropic Console';
  return vi ? `Đăng nhập ${titleCase(providerId)}` : `Sign in to ${titleCase(providerId)}`;
}

function safeHttps(value) {
  try { const url = new URL(String(value ?? '')); return url.protocol === 'https:' ? url.toString() : null; }
  catch { return null; }
}

function providerAuthControls(provider, receipt, lang = 'en') {
  const vi = lang === 'vi';
  const id = String(provider?.id ?? '');
  const modes = Array.isArray(provider?.loginModes) ? provider.loginModes.map(String) : [];
  const identity = [];
  if (provider?.email) identity.push(`<span>${esc(provider.email)}</span>`);
  if (provider?.planType) {
    const family = id === 'claude' ? 'Claude' : (id === 'codex' || id === 'codex-app-server') ? 'ChatGPT' : (provider?.label ?? id);
    identity.push(`<span>${esc(`${family} ${titleCase(provider.planType)}`)}</span>`);
  }
  if (provider?.authMode && !provider?.planType) identity.push(`<span>${esc(titleCase(provider.authMode))}</span>`);
  const account = identity.length ? `<div class="provider-account-meta" aria-label="${vi ? 'Tài khoản đã phát hiện' : 'Detected account'}">${identity.join('')}</div>` : '';
  const buttons = provider?.authenticated === true
    ? (provider?.logoutSupported ? `<button type="button" data-provider-auth-action="logout" data-provider-id="${esc(id)}">${vi ? 'Đăng xuất' : 'Sign out'}</button>` : '')
    : (provider?.available === false ? '' : modes.map((mode) => `<button type="button" data-provider-auth-action="login" data-provider-id="${esc(id)}" data-provider-login-mode="${esc(mode)}">${esc(loginModeLabel(id, mode, lang))}</button>`).join(''));
  const authUrl = receipt?.providerId === id ? safeHttps(receipt.authUrl) : null;
  const loginReceipt = receipt?.providerId === id ? `<div class="provider-login-receipt" role="status" aria-live="polite"><strong>${vi ? 'Hoàn tất đăng nhập' : 'Finish signing in'}</strong>${receipt.userCode ? `<span>${vi ? 'Mã thiết bị' : 'Device code'} <code>${esc(receipt.userCode)}</code></span>` : ''}${authUrl ? `<a href="${esc(authUrl)}" target="_blank" rel="noopener noreferrer">${vi ? 'Mở trang đăng nhập' : 'Open sign-in page'}</a>` : receipt.launched ? `<span>${vi ? 'Cửa sổ đăng nhập chính thức đã được mở.' : 'The official sign-in window was opened.'}</span>` : ''}</div>` : '';
  return `${account}${buttons ? `<div class="provider-auth-actions">${buttons}</div>` : ''}${loginReceipt}`;
}

function providerFacts(provider, lang = 'en') {
  const vi = lang === 'vi';
  const kind = String(provider?.kind ?? '');
  const externalPlan = provider?.executionSafety === 'external-plan-config-required';
  const guardedCli = kind === 'cli' || kind === 'codex-app-server';
  const modelSelection = provider?.modelSelection?.mode ?? 'forwarded';
  const liveCatalog = provider?.modelDiscovery?.live === true;
  const compatibilityCatalog = provider?.modelDiscovery?.mode === 'compatibility-catalog';
  const execution = externalPlan
    ? (vi ? 'Cần cấu hình plan an toàn' : 'Safe plan configuration required')
    : guardedCli
      ? (vi ? 'Được bảo vệ, chỉ đọc' : 'Guarded, read-only')
      : (vi ? 'Được kiểm soát bằng credential' : 'Credential-controlled');
  const models = liveCatalog
    ? (vi ? 'Danh mục model trực tiếp' : 'Live model catalog')
    : compatibilityCatalog
      ? (vi ? 'Danh mục model tương thích' : 'Compatibility model catalog')
    : modelSelection === 'cli-config'
      ? (vi ? 'Cấu hình trong CLI' : 'CLI configuration')
      : modelSelection === 'forwarded' && guardedCli
        ? (vi ? 'Thêm model thủ công' : 'Add models manually')
        : (vi ? 'Chưa có danh mục model' : 'No model catalog');
  const state = provider?.available === false || provider?.error === 'not-found'
    ? (vi ? 'Chưa cài đặt' : 'Not installed')
    : provider?.healthy === true
      ? (vi ? 'Sẵn sàng' : 'Ready')
      : provider?.authenticated === true
        ? (vi ? 'Cần kiểm tra kết nối' : 'Sign in or verify')
        : (vi ? 'Cần đăng nhập hoặc kiểm tra' : 'Needs login or test');
  const facts = [['execution', execution], ['models', models], ['state', state]];
  return `<ul class="provider-facts" aria-label="${vi ? 'Thông tin provider' : 'Provider facts'}">${facts.map(([type, label]) => `<li data-provider-fact="${type}">${esc(label)}</li>`).join('')}</ul>`;
}

function providerCatalogState(provider, lang = 'en') {
  const vi = lang === 'vi';
  if (provider?.configured === false) return { id: 'not-configured', label: vi ? 'Chưa thiết lập' : 'Not configured' };
  if (provider?.available === false || provider?.error === 'not-found') return { id: 'not-installed', label: vi ? 'Chưa cài đặt' : 'Not installed' };
  if (provider?.executionSafety === 'external-plan-config-required') return { id: 'setup-required', label: vi ? 'Cần cấu hình an toàn' : 'Safe setup required' };
  if (provider?.healthy === true) return { id: 'ready', label: vi ? 'Sẵn sàng' : 'Ready' };
  return { id: 'needs-verification', label: vi ? 'Cần đăng nhập hoặc kiểm tra' : 'Needs sign-in or verification' };
}

function providerCatalog(providers, lang = 'en') {
  const vi = lang === 'vi';
  const entries = providers.filter((provider) => String(provider?.id ?? '').trim());
  if (!entries.length) return '';
  const cliCount = entries.filter((provider) => provider?.kind === 'cli' || provider?.kind === 'codex-app-server').length;
  const apiCount = entries.length - cliCount;
  const cliLabel = vi ? 'tác nhân CLI' : 'CLI agent';
  const apiLabel = vi ? 'provider API' : 'API provider';
  const title = vi ? 'Tác nhân & provider' : 'Agents & providers';
  const description = vi
    ? 'Mỗi kết nối hiển thị đúng trạng thái cài đặt, an toàn và khả năng chọn model. Mở một kết nối để thiết lập tài khoản hoặc model.'
    : 'Each connection shows its real installation, safety, and model-selection state. Open one to set up its account or models.';
  return `<section class="provider-catalog" aria-labelledby="provider-catalog-title"><header class="provider-catalog__header"><div><h3 id="provider-catalog-title">${esc(title)}</h3><p>${esc(description)}</p></div><ul class="provider-catalog__counts" aria-label="${vi ? 'Số lượng kết nối' : 'Connection counts'}"><li data-provider-catalog-count="cli">${cliCount} ${esc(cliLabel)}${cliCount === 1 || vi ? '' : 's'}</li><li data-provider-catalog-count="api">${apiCount} ${esc(apiLabel)}${apiCount === 1 || vi ? '' : 's'}</li></ul></header><ul class="provider-catalog__list">${entries.map((provider) => {
    const id = String(provider.id);
    const state = providerCatalogState(provider, lang);
    const type = provider?.kind === 'cli' ? cliLabel : provider?.kind === 'codex-app-server' ? (vi ? 'App server' : 'App server') : apiLabel;
    return `<li><a href="#provider-${esc(id)}" data-provider-catalog-kind="${provider?.kind === 'cli' || provider?.kind === 'codex-app-server' ? 'cli' : 'api'}"><span class="provider-catalog__name">${esc(provider?.label ?? id)}</span><span class="provider-catalog__meta"><span>${esc(type)}</span><strong data-provider-catalog-state="${state.id}">${esc(state.label)}</strong></span></a></li>`;
  }).join('')}</ul></section>`;
}

function providerCard(provider, models, experience, comparison, dossiers, providerLogin, lang = 'en') {
  const vi = lang === 'vi';
  const selected = new Set(comparison?.selected ?? []);
  const providerKind = String(provider?.kind ?? '');
  const apiProvider = API_MODEL_KINDS.has(providerKind);
  const modelSelectionMode = provider?.modelSelection?.mode ?? 'forwarded';
  const rows = models.length ? models.map((profile) => {
    const canonical = canonicalId(profile);
    const capabilityEntries = Object.entries({ text: profile.capabilities?.text, tools: profile.capabilities?.tools, structuredOutput: profile.capabilities?.structuredOutput, streaming: profile.capabilities?.streaming, vision: profile.capabilities?.vision }).map(([name, value]) => {
      const [label, status] = capabilityStatus(value);
      return `<li data-capability-status="${status}"><span>${esc(CAPABILITY_LABELS[name]?.[vi ? 1 : 0] ?? name)}</span><strong>${esc(vi ? ({Supported:'Được hỗ trợ',Unsupported:'Không hỗ trợ','Probe error':'Lỗi kiểm tra',Unknown:'Chưa biết'}[label] ?? label) : label)}</strong></li>`;
    }).join('');
    const lifecycle = profile.lifecycle ?? 'unknown';
    const lifecycleLabel = ({ unknown: vi ? 'Chưa xác định' : 'unknown', inferred: vi ? 'Suy luận' : 'inferred', verified: vi ? 'Đã xác minh' : 'verified', canonical: vi ? 'Chuẩn hóa' : 'canonical' })[lifecycle] ?? lifecycle;
    const lastProbe = profile.probed?.updatedAt ?? profile.probe?.updatedAt ?? null;
    const tokenizer = profile.tokenizerId && !/^unknown$/i.test(String(profile.tokenizerId)) ? profile.tokenizerId : localizedUnknown(lang);
    const routingDefault = CLI_MODEL_KINDS.has(providerKind) && modelSelectionMode === 'forwarded' ? `<button type="button" data-model-action="set-routing-default" data-model-key="${esc(profile.key ?? `${profile.providerId}/${profile.modelId}`)}">${vi ? 'Dùng để định tuyến' : 'Use for routing'}</button>` : '';
    return `<article class="model-profile-card" data-model-key="${esc(profile.key ?? `${profile.providerId}/${profile.modelId}`)}" data-canonical-model-id="${esc(canonical)}"><header><div><p class="model-provider">${esc(provider?.label ?? profile.providerId)}</p><h4>${esc(profile.displayName ?? profile.modelId)}</h4><p class="model-id">${esc(profile.modelId)}</p></div><div class="model-card-badges"><span class="model-lifecycle" data-lifecycle="${esc(lifecycle)}">${esc(lifecycleLabel)}</span>${truthBadges(profile, lang)}</div></header><dl><div><dt>${vi ? 'Ngữ cảnh' : 'Context'}</dt><dd>${esc(contextLabel(profile, lang))}</dd></div><div><dt>Tokenizer</dt><dd>${esc(tokenizer)}</dd></div><div><dt>${vi ? 'Kiểm tra gần nhất' : 'Last probe'}</dt><dd>${esc(lastProbe ?? (vi ? 'Chưa có' : 'Never'))}</dd></div></dl><ul class="capability-matrix" aria-label="${vi ? 'Khả năng của model' : 'Model capabilities'}">${capabilityEntries}</ul><div class="model-card-actions">${apiProvider ? `<button type="button" data-model-action="select" data-provider-id="${esc(profile.providerId)}" data-model-id="${esc(profile.modelId)}">${vi ? 'Dùng làm mặc định' : 'Use as default'}</button>` : ''}${routingDefault}<button type="button" data-model-action="probe" data-provider-id="${esc(profile.providerId)}" data-model-id="${esc(profile.modelId)}">${vi ? 'Kiểm tra' : 'Probe'}</button>${experience === 'expert' || experience === 'research' ? `<button type="button" data-model-action="inspect" data-model-id="${esc(canonical)}">${vi ? 'Hồ sơ' : 'Dossier'}</button><label class="model-compare-choice" data-model-action="toggle-compare" data-model-id="${esc(canonical)}"><input type="checkbox"${selected.has(canonical) ? ' checked' : ''}> ${vi ? 'So sánh' : 'Compare'}</label>` : ''}</div>${experience === 'expert' || experience === 'research' ? dossierDetails(profile, dossiers?.[canonical], lang) : ''}</article>`;
  }).join('') : '<p class="model-empty">No discovered models for this provider yet.</p>';
  const id = provider?.id ?? models[0]?.providerId ?? 'unassigned';
  const status = provider?.configured === false ? (vi ? 'Chưa thiết lập' : 'Not configured') : provider?.error === 'not-found' ? (vi ? 'Chưa cài đặt' : 'Not installed') : provider?.error === 'configuration-error' ? (vi ? 'Lỗi cấu hình CLI' : 'CLI configuration error') : provider?.executionSafety === 'external-plan-config-required' ? (vi ? 'Cần cấu hình plan an toàn' : 'Safe plan configuration required') : provider?.error === 'connection-test-required' ? (vi ? 'Cần xác minh kết nối' : 'Connection verification required') : provider?.healthy === true ? (vi ? 'Đã kết nối' : 'Connected') : provider?.authenticated === true ? (vi ? 'Đã đăng nhập' : 'Authenticated') : (vi ? 'Cần đăng nhập hoặc kiểm tra' : 'Needs login or test');
  const canDiscover = (!providerKind || DISCOVERABLE_KINDS.has(providerKind)) && (providerKind !== 'cli' || provider?.modelDiscovery?.supported !== false);
  const discover = canDiscover ? `<button type="button" data-model-action="discover" data-provider-id="${esc(id)}">${vi ? 'Khám phá model' : 'Discover models'}</button>` : '';
  const verify = providerKind === 'cli' && provider?.executionSafety !== 'external-plan-config-required' && provider?.available !== false && provider?.healthy !== true ? `<button type="button" data-model-action="verify-provider" data-provider-id="${esc(id)}">${vi ? 'Xác minh kết nối CLI' : 'Verify CLI connection'}</button>` : '';
  const manual = CLI_MODEL_KINDS.has(String(provider?.kind)) && modelSelectionMode === 'forwarded' ? `<form class="model-manual-form" data-model-manual-form autocomplete="off"><label><span>${vi ? 'Thêm model CLI' : 'Add CLI model'}</span><input name="modelId" required maxlength="256" placeholder="${vi ? 'Ví dụ: gpt-5.2-codex' : 'e.g. gpt-5.2-codex'}"></label><button type="button" data-model-action="add" data-provider-id="${esc(id)}">${vi ? 'Thêm model' : 'Add model'}</button></form>` : '';
  const modelSelectionNote = provider?.executionSafety === 'external-plan-config-required' ? `<p class="provider-model-note">${vi ? `Hãy cấu hình phê duyệt plan trong ${provider?.label ?? id} trước khi bật thực thi có kiểm soát.` : `Configure ${provider?.label ?? id} plan approval before enabling governed execution.`}</p>` : providerKind === 'cli' && modelSelectionMode === 'cli-config' ? `<p class="provider-model-note">${vi ? `Model được chọn trong cấu hình CLI của ${provider?.label ?? id}; Nolane sẽ không gửi một giá trị model mà CLI không hỗ trợ.` : `Model is selected in the ${provider?.label ?? id} configuration; Nolane will not forward a model value this CLI does not support.`}</p>` : '';
  return `<section id="provider-${esc(id)}" class="provider-model-group" data-provider-id="${esc(id)}"><header class="provider-model-heading"><div><h3>${esc(provider?.label ?? id)}</h3><p>${status}</p>${providerFacts(provider, lang)}${providerAuthControls(provider, providerLogin, lang)}${modelSelectionNote}</div><div class="provider-model-actions">${discover}${verify}${manual}</div></header><div class="model-profile-grid">${rows.replace('<p class="model-empty">No discovered models for this provider yet.</p>', `<p class="model-empty">${vi ? 'Chưa có model được thêm hoặc khám phá cho provider này.' : 'No discovered models for this provider yet.'}</p>`)}</div></section>`;
}

export function renderModelProfilesPanel(snapshot = {}, { experience = 'standard', comparison = {}, dossiers = {}, lang = 'en' } = {}) {
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
  const vi = lang === 'vi';
  const content = [...grouped.entries()].map(([providerId, entries]) => providerCard(providerMap.get(providerId) ?? { id: providerId, label: providerId }, entries, experience, comparison, dossiers, snapshot.providerLogin, lang)).join('');
  const compareActions = (experience === 'expert' || experience === 'research') ? `<div class="model-comparison-actions"><span>${comparison.selected?.length ?? 0}/5 ${vi ? 'đã chọn' : 'selected'}</span><button type="button" data-model-action="compare"${(comparison.selected?.length ?? 0) < 2 ? ' disabled' : ''}>${vi ? 'So sánh triển khai' : 'Compare deployments'}</button><button type="button" data-model-action="clear-compare"${(comparison.selected?.length ?? 0) === 0 ? ' disabled' : ''}>${vi ? 'Xóa' : 'Clear'}</button></div>` : '';
  return `<section class="model-profiles-panel" aria-labelledby="model-profiles-title"><header class="model-profiles-intro"><div><p class="eyebrow">${vi ? 'Trí tuệ model' : 'Model intelligence'}</p><h2 id="model-profiles-title">${vi ? 'Hồ sơ model' : 'Model Profiles'}</h2><p>${vi ? 'Khám phá model của provider, kiểm tra khả năng và xem nguồn gốc, độ mới, xung đột cùng bằng chứng định tuyến.' : 'Discover provider models, verify selected capabilities, and inspect canonical base, snapshot, deployment, artifact, provenance, freshness, and conflict records.'}</p></div><span class="model-profile-count">${models.length} ${vi ? 'model' : `model${models.length === 1 ? '' : 's'}`}</span></header>${providerCatalog(providers, lang)}${providerSetup(lang)}${compareActions}${comparisonView(comparison, lang)}${content || `<p class="model-empty">${vi ? 'Hãy thiết lập provider hoặc thêm model CLI để bắt đầu.' : 'Configure a provider to discover and profile models.'}</p>`}${experience === 'expert' || experience === 'research' ? `<aside class="model-profile-note" role="note"><strong>${vi ? 'Chế độ chuyên gia:' : 'Expert view:'}</strong> ${vi ? 'hồ sơ tương thích vẫn có sẵn; nguồn sự thật chuẩn, nguồn gốc trường dữ liệu, xung đột, receipt đánh giá và quan sát runtime không làm lộ thông tin xác thực.' : 'compatibility records remain available, while canonical truth, field provenance, conflict states, evaluation receipts, and runtime observations are shown without exposing credentials.'}</aside>` : ''}</section>`;
}
