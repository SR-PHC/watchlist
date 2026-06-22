// Unified decision view: regular focus pool + neckline retest watch pool.
// The strategy engines and source JSON files remain independent; this file only
// normalizes their presentation and writes the user's selection to watchlist.json.

function candidateSourceLabel(source) {
  return ({
    chips: '低基期',
    volume_signal: '量增',
    big_holder_trend: '趨勢',
    right_top: '突破',
    neckline_retest: '頸線回測',
  }[source] || source);
}

function buildUnifiedCandidateRows() {
  const merged = new Map();
  const stockRows = (DATA.momentum_candidates_data?.focus_results || [])
    .filter(row => row && row.pattern_state !== '太遠不追' && row.pattern_state !== '型態破壞');
  const necklineRows = DATA.neckline_candidates_data?.watch_pool || [];

  stockRows.forEach(row => {
    const id = String(row.stock_id);
    merged.set(id, {
      stock_id: id,
      name: row.name || '',
      industry: row.industry || '',
      market: row.market || '',
      stock_pool: row,
      neckline: null,
    });
  });

  necklineRows.forEach(row => {
    const id = String(row.stock_id);
    const item = merged.get(id) || {
      stock_id: id,
      name: row.name || '',
      industry: row.industry || '',
      market: row.market || '',
      stock_pool: null,
      neckline: null,
    };
    item.neckline = row;
    if (!item.name) item.name = row.name || '';
    if (!item.industry) item.industry = row.industry || '';
    merged.set(id, item);
  });

  return [...merged.values()].map(item => ({
    ...item,
    is_confluence: !!(item.stock_pool && item.neckline),
    current_price: item.neckline?.as_of_price ?? item.stock_pool?.close ?? null,
  }));
}

function unifiedCandidateSources(item) {
  return [
    ...(item.stock_pool?.sources || []),
    ...(item.neckline ? ['neckline_retest'] : []),
  ].filter((source, index, all) => all.indexOf(source) === index);
}

function unifiedCandidateBars(stockId) {
  return DATA.stock_kbars_data?.stocks?.[stockId]?.daily
    || DATA.neckline_kbars_data?.stocks?.[stockId]?.daily
    || [];
}

function unifiedCandidateGuideLevels(item) {
  if (!item?.neckline) return [];
  return [
    { value: item.neckline.neckline_price, color: '#176d91', dash: [5, 3] },
    { value: item.neckline.box_high, color: '#8b5cf6', dash: [3, 3] },
  ].filter(level => level.value != null && Number.isFinite(Number(level.value)));
}

function candidateWatchlistState(item) {
  const existing = (DATA.watchlist_data?.active || [])
    .find(row => String(row.stock_id) === String(item.stock_id));
  if (!existing) return { existing: null, complete: false };
  const existingSources = new Set(existing.sources || []);
  const expected = unifiedCandidateSources(item);
  return { existing, complete: expected.every(source => existingSources.has(source)) };
}

async function addUnifiedCandidateToWatchlist(stockId) {
  const item = buildUnifiedCandidateRows().find(row => String(row.stock_id) === String(stockId));
  if (!item) return;

  const wl = _watchlistData();
  const state = candidateWatchlistState(item);
  const sourceCodes = unifiedCandidateSources(item);
  const sourceLabels = sourceCodes.map(candidateSourceLabel);
  const regular = item.stock_pool || {};
  const neckline = item.neckline || null;
  const metrics = regular.metrics || {};
  const sourceDetails = {
    ...(state.existing?.source_details || {}),
    ...(item.stock_pool ? {
      stock_pool: {
        captured_date: (DATA.momentum_candidates_data?.updated || dateTW()).slice(0, 10),
        pattern_score: regular.pattern_score ?? null,
        pattern_state: regular.pattern_state || '',
        key_level: regular.key_level ?? regular.breakout_key_level ?? null,
        invalidation: regular.invalidation ?? null,
      },
    } : {}),
    ...(neckline ? {
      neckline_retest: {
        captured_date: dateTW(),
        neckline_price: neckline.neckline_price ?? null,
        distance_pct: neckline.dist_to_neckline_pct ?? null,
        entry_type: neckline.entry_type_label || '',
        dip_date: neckline.dip_date || '',
        box_high: neckline.box_high ?? null,
      },
    } : {}),
  };

  if (state.existing) {
    state.existing.sources = [...new Set([...(state.existing.sources || []), ...sourceCodes])];
    state.existing.source_strategy = state.existing.sources.map(candidateSourceLabel).join(' / ');
    state.existing.source_details = sourceDetails;
    state.existing.pattern_tags = [...new Set([
      ...(state.existing.pattern_tags || []),
      ...(regular.pattern_tags || []),
      ...(neckline ? ['頸線回測', neckline.entry_type_label].filter(Boolean) : []),
    ])];
    if (state.existing.key_level == null && neckline) state.existing.key_level = neckline.neckline_price ?? null;
    wl.last_updated = dateTW();
    const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: merge sources ${stockId}`);
    if (ok) { alert(`${stockId} 已合併候選來源`); renderNav(); renderStrategy(); }
    return;
  }

  const addedDate = dateTW();
  const entryPrice = neckline?.as_of_price
    ?? _watchlistEntryClose(stockId, addedDate)
    ?? regular.close
    ?? null;
  const currentPrice = item.current_price ?? entryPrice;
  wl.active.push({
    id: `${stockId}-${Date.now()}`,
    stock_id: stockId,
    name: item.name,
    industry: item.industry,
    market: item.market,
    source_strategy: sourceLabels.join(' / ') || '候選標的',
    sources: sourceCodes,
    source_details: sourceDetails,
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice,
    current_price: currentPrice,
    pnl_pct: entryPrice ? Number(((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)) : 0,
    pattern_score: regular.pattern_score ?? null,
    pattern_state: regular.pattern_state || neckline?.signal_label || '觀察中',
    pattern_tags: [...new Set([
      ...(regular.pattern_tags || []),
      ...(neckline ? ['頸線回測', neckline.entry_type_label].filter(Boolean) : []),
    ])],
    patterns: regular.patterns || [],
    key_level: regular.key_level ?? regular.breakout_key_level ?? neckline?.neckline_price ?? null,
    invalidation: regular.invalidation ?? null,
    vol_20d_avg: metrics.vol_20d_avg ?? neckline?.avg_vol_20d ?? null,
    pinned: false,
    status: '觀察中',
    note: item.is_confluence ? '標的池＋頸線回測雙重符合' : '',
  });
  wl.last_updated = addedDate;
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add unified candidate ${stockId}`);
  if (ok) { alert(`${stockId} 已加入自選`); renderNav(); renderStrategy(); }
  else wl.active.pop();
}

function setUnifiedCandidatePeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-unified-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const item = buildUnifiedCandidateRows().find(row => row.stock_id === String(stockId));
  drawPoolKChart(
    card.querySelector('canvas'),
    aggregatePoolBars(unifiedCandidateBars(String(stockId)), period),
    `unified-${stockId}`,
    getWatchlistMarkerDate(stockId),
    unifiedCandidateGuideLevels(item),
  );
}

function renderUnifiedCandidates(strat, main) {
  const allRows = buildUnifiedCandidateRows();
  const filter = window._unifiedCandidateFilter || 'all';
  const matches = (item, key) => key === 'stock_pool' ? !!item.stock_pool
    : key === 'neckline' ? !!item.neckline
      : key === 'confluence' ? item.is_confluence
        : true;
  const counts = key => allRows.filter(item => matches(item, key)).length;
  const filters = [
    ['all', '全部'],
    ['stock_pool', '標的池'],
    ['neckline', '頸線回測'],
    ['confluence', '雙重符合'],
  ];
  window.setUnifiedCandidateFilter = key => {
    window._unifiedCandidateFilter = key;
    renderStrategy();
  };

  const rows = allRows.filter(item => matches(item, filter)).sort((a, b) => {
    if (a.is_confluence !== b.is_confluence) return Number(b.is_confluence) - Number(a.is_confluence);
    if (a.stock_pool && b.stock_pool) return Number(b.stock_pool.pattern_score || 0) - Number(a.stock_pool.pattern_score || 0);
    if (a.neckline && b.neckline) return Number(a.neckline.dist_to_neckline_pct ?? 99) - Number(b.neckline.dist_to_neckline_pct ?? 99);
    return Number(!!b.stock_pool) - Number(!!a.stock_pool);
  });

  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);
  const buttons = filters.map(([key, label]) => `<button class="view-btn ${filter === key ? 'active' : ''}" onclick="setUnifiedCandidateFilter('${key}')">${label} ${counts(key)}</button>`).join('');
  const cards = rows.map(item => {
    const regular = item.stock_pool || {};
    const neckline = item.neckline;
    const state = candidateWatchlistState(item);
    const sourceLabels = unifiedCandidateSources(item).map(candidateSourceLabel);
    const tags = [
      ...(item.is_confluence ? ['雙重符合'] : []),
      regular.pattern_state || '',
      neckline?.entry_type_label || '',
      neckline?.is_new ? '頸線今日新增' : '',
      ...sourceLabels,
    ].filter(Boolean).slice(0, 7);
    const buttonText = !state.existing ? '加入自選' : state.complete ? '已在自選' : '合併來源';
    const disabled = state.existing && state.complete;
    return `<article class="pool-kcard" data-unified-id="${item.stock_id}">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${item.stock_id}</span><span class="stock-name">${item.name || '-'}</span></div>
          <div class="stock-industry">${item.industry || '-'}</div>
        </div>
        <div class="pool-kcard-score"><span>現價</span><strong>${fmt(item.current_price)}</strong><em>${regular.pattern_score != null ? `型態 ${fmt(regular.pattern_score, 1)}` : `距頸線 ${fmt(neckline?.dist_to_neckline_pct)}%`}</em></div>
      </div>
      <div class="pool-kcard-tags">
        ${tags.map((tag, index) => `<span class="tag-badge" style="color:${item.is_confluence && index === 0 ? 'var(--amber)' : 'var(--text3)'};border-color:var(--border)">${tag}</span>`).join('')}
      </div>
      <div class="pool-kchart-wrap">
        <canvas></canvas><div class="pool-kchart-empty" data-empty="unified-${item.stock_id}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setUnifiedCandidatePeriod('${item.stock_id}','day')">日</button>
          <button onclick="setUnifiedCandidatePeriod('${item.stock_id}','week')">週</button>
          <button onclick="setUnifiedCandidatePeriod('${item.stock_id}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>型態分</span><strong>${fmt(regular.pattern_score, 1)}</strong></div>
        <div><span>頸線距離</span><strong>${neckline ? `${fmt(neckline.dist_to_neckline_pct)}%` : '-'}</strong></div>
        <div><span>關鍵／頸線</span><strong>${fmt(regular.key_level ?? regular.breakout_key_level ?? neckline?.neckline_price)}</strong></div>
        <div><span>失效／箱頂</span><strong class="neg">${fmt(regular.invalidation ?? neckline?.box_high)}</strong></div>
        <div><span>來源</span><strong>${sourceLabels.join(' / ') || '-'}</strong></div>
      </div>
      <div class="pool-kcard-actions"><button class="perf-btn perf-btn-add" onclick="addUnifiedCandidateToWatchlist('${item.stock_id}')" ${disabled ? 'disabled' : ''}>${buttonText}</button></div>
    </article>`;
  }).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header"><div class="strat-title">${strat.icon} ${strat.name}</div><div class="strat-desc">${strat.description}</div></div>
    <div class="summary-row">
      <div class="summary-card"><div class="summary-label">全部候選</div><div class="summary-value">${counts('all')}</div><div class="summary-sub">已排除太遠／破壞</div></div>
      <div class="summary-card"><div class="summary-label">標的池</div><div class="summary-value blue">${counts('stock_pool')}</div><div class="summary-sub">型態與籌碼彙整</div></div>
      <div class="summary-card"><div class="summary-label">頸線回測</div><div class="summary-value green">${counts('neckline')}</div><div class="summary-sub">距精確頸線 ±5%</div></div>
      <div class="summary-card"><div class="summary-label">雙重符合</div><div class="summary-value amber">${counts('confluence')}</div><div class="summary-sub">優先人工看圖</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar"><span class="table-title">候選標的</span><div class="toolbar-right"><span class="updated-tag">標的池 ${(DATA.momentum_candidates_data?.updated || '-').slice(0, 10)}</span><span class="updated-tag">頸線 ${(DATA.neckline_candidates_data?.updated || '-').slice(0, 10)}</span><button class="btn-csv" onclick="triggerShioajiPriceUpdate(this)">更新資料</button></div></div>
      <div style="display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">${buttons}</div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有符合條件的候選標的</div>'}</div>
    </div>
  </div>`;
  setTimeout(() => rows.forEach(item => setUnifiedCandidatePeriod(item.stock_id, 'day')), 40);
}
