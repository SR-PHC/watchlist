// Daily workbench: a quiet view over confirmed or maintenance-worthy signals.
// Strategy engines remain independent; this file only normalizes presentation
// and writes the user's manual selections to watchlist.json.

function candidateSourceLabel(source) {
  return ({
    chips: '低基期',
    volume_signal: '量增',
    big_holder_trend: '趨勢',
    right_top: '突破',
    neckline_retest: '頸線回測',
    pool_resonance: '三池共振',
  }[source] || source);
}

const CANDIDATE_RESONANCE_SOURCE_CODES = { 趨勢: 'big_holder_trend', 突破: 'right_top', 頸線: 'neckline_retest' };

function candidateStockThemeEntry(stockId) {
  const id = String(stockId || '').trim();
  if (!id) return null;
  return DATA.theme_tags_data?.by_stock?.[id]
    || DATA.theme_tags_data?.by_stock?.[id.padStart(4, '0')]
    || null;
}

function candidateStockThemes(stockId) {
  return candidateStockThemeEntry(stockId)?.themes || [];
}

function candidateThemeStrengthClass(strength) {
  if (strength === 'strong' || strength === 'core') return 'strong';
  if (strength === 'medium' || strength === 'related') return 'medium';
  return 'weak';
}

function candidateThemeStrengthLabel(strength) {
  return ({
    strong: '核心',
    medium: '相關',
    weak: '觀察',
    core: '核心',
    related: '相關',
    watch: '觀察',
  }[strength] || '觀察');
}

function candidateThemeLabels(stockId, limit = 4) {
  return candidateStockThemes(stockId)
    .slice(0, limit)
    .map(theme => theme.label || theme.id)
    .filter(Boolean);
}

function candidateThemeRoleLabels(stockId, limit = 5) {
  const labels = [];
  candidateStockThemes(stockId).forEach(theme => {
    (theme.roles || []).forEach(role => labels.push(role));
    (theme.subthemes || []).forEach(subtheme => labels.push(subtheme));
  });
  return [...new Set(labels.filter(Boolean))].slice(0, limit);
}

function renderCandidateThemeBadges(stockId, limit = 3) {
  const themes = candidateStockThemes(stockId).slice(0, limit);
  if (!themes.length) return '';
  return `<div class="stock-theme-row">${themes.map(theme => {
    const klass = candidateThemeStrengthClass(theme.strength);
    const label = theme.label || theme.id || '題材';
    const role = [...(theme.roles || []), ...(theme.subthemes || [])].filter(Boolean).join(' / ');
    const title = role ? `${label}｜${role}` : label;
    return `<span class="theme-badge ${klass}" title="${title}">${label}<em>${candidateThemeStrengthLabel(theme.strength)}</em></span>`;
  }).join('')}</div>`;
}

function candidateHighMomentum(stockId) {
  const id = String(stockId || '').trim();
  if (!id) return null;
  return DATA.neckline_high_momentum_data?.by_stock?.[id]
    || DATA.neckline_high_momentum_data?.by_stock?.[id.padStart(4, '0')]
    || null;
}

function candidateHighMomentumScore(high) {
  if (!high) return 0;
  if (high.a_plus_retest) return 300;
  if (high.close_new_high_10y) return 220;
  if (high.high_new_high_10y) return 180;
  if (high.strict_60d_momentum) return 120;
  return 0;
}

function renderHighMomentumBadges(high, compact = false) {
  if (!high) return '';
  const tags = [];
  if (high.a_plus_retest) tags.push(['A+回測', 'rank-strength-priority', high.momentum_reasons || '近10年高 + 放量突破回測']);
  else if (high.close_new_high_10y) tags.push(['10年收高', 'rank-strength-priority', high.momentum_reasons || '收盤創近10年高']);
  else if (high.high_new_high_10y) tags.push(['10年盤中', 'rank-strength-watch', high.momentum_reasons || '盤中創近10年高']);
  if (high.strict_60d_momentum && !high.a_plus_retest) tags.push(['60D強回測', 'rank-strength-watch', high.momentum_reasons || '放量突破後回測']);
  if (!tags.length) return '';
  return tags.slice(0, compact ? 1 : 3)
    .map(([label, klass, title]) => `<span class="rank-grade-pill ${klass}" title="${title}">${label}</span>`)
    .join('');
}

function candidateHollowPattern(stockId, signalDate = '') {
  const id = String(stockId || '').trim();
  if (!id) return null;
  const rows = DATA.neckline_daily_rank_data?.rows || [];
  const item = rows.find(row => String(row.stock_id) === id || String(row.stock_id).padStart(4, '0') === id.padStart(4, '0'));
  if (!item?.is_hollow_pattern) return null;
  if (signalDate && item.entry_date && item.entry_date !== signalDate) return null;
  return item;
}

function renderHollowPatternBadge(row) {
  if (!(row.reasons || []).includes('neckline_confirmed')) return '';
  const hollow = candidateHollowPattern(row.stock_id, row.signal_date);
  if (!hollow) return '';
  const title = hollow.hollow_pattern_reason || 'KD低檔、量縮回測、確認未追高';
  return `<span class="tag-badge" style="color:#10221f;background:#57d4c6;border-color:#57d4c6;font-weight:800" title="${escapeHtml(title)}">凹洞型態</span>`;
}

function candidateResonanceText(row) {
  if (!row) return '';
  const level = Number(row.level || Object.keys(row.pools || {}).length || 0);
  if (level >= 3) return '三池共振';
  if (level === 2) return '雙池共振';
  return '';
}

function buildUnifiedCandidateRows() {
  const pool = DATA.decision_pool_data || {};
  if (Array.isArray(pool.rows)) {
    return pool.rows.map(row => ({
      ...row,
      is_strategy_resonance: (row.reasons || []).includes('resonance'),
      is_confirmed_today: (row.reasons || []).includes('neckline_confirmed'),
      high_momentum: candidateHighMomentum(row.stock_id),
      current_price: row.current_price ?? null,
    }));
  }

  const merged = new Map();
  const stockRows = (DATA.momentum_candidates_data?.focus_results || [])
    .filter(row => row && row.pattern_state !== '太遠不追' && row.pattern_state !== '型態破壞');
  const necklineRows = DATA.neckline_candidates_data?.watch_pool || [];
  const resonanceRows = DATA.pool_resonance_data?.rows || [];

  stockRows.forEach(row => {
    const id = String(row.stock_id);
    merged.set(id, {
      stock_id: id,
      name: row.name || '',
      industry: row.industry || '',
      market: row.market || '',
      stock_pool: row,
      neckline: null,
      resonance: null,
      high_momentum: candidateHighMomentum(id),
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
      resonance: null,
      high_momentum: candidateHighMomentum(id),
    };
    item.neckline = row;
    if (!item.name) item.name = row.name || '';
    if (!item.industry) item.industry = row.industry || '';
    merged.set(id, item);
  });

  resonanceRows.forEach(row => {
    const id = String(row.stock_id);
    const item = merged.get(id) || {
      stock_id: id,
      name: row.name || '',
      industry: row.industry || '',
      market: row.market || '',
      stock_pool: null,
      neckline: null,
      resonance: null,
      high_momentum: candidateHighMomentum(id),
    };
    item.resonance = row;
    if (!item.name) item.name = row.name || '';
    if (!item.industry) item.industry = row.industry || '';
    merged.set(id, item);
  });

  return [...merged.values()].map(item => ({
    ...item,
    is_confluence: !!(item.stock_pool && item.neckline),
    is_strategy_resonance: !!item.resonance,
    current_price: item.neckline?.as_of_price ?? item.stock_pool?.close ?? item.resonance?.current_price ?? null,
  }));
}

function unifiedCandidateSources(item) {
  const directSources = [
    ...(item.stock_pool?.sources || []),
    ...(item.neckline ? ['neckline_retest'] : []),
    ...(item.resonance ? [
      'pool_resonance',
      ...Object.keys(item.resonance.pools || {}).map(pool => CANDIDATE_RESONANCE_SOURCE_CODES[pool]).filter(Boolean),
    ] : []),
  ];
  const reasonSources = (item.reasons || []).map(reason => ({
    neckline_confirmed: 'neckline_retest',
    resonance: 'pool_resonance',
    trend_45_65: 'big_holder_trend',
  }[reason])).filter(Boolean);
  return [...directSources, ...reasonSources]
    .filter((source, index, all) => source && all.indexOf(source) === index);
}

function unifiedCandidateBars(stockId) {
  return DATA.decision_pool_kbars_data?.stocks?.[stockId]?.daily
    || DATA.stock_kbars_data?.stocks?.[stockId]?.daily
    || DATA.neckline_kbars_data?.stocks?.[stockId]?.daily
    || DATA.resonance_kbars_data?.stocks?.[stockId]?.daily
    || DATA.confirmed_entry_kbars_data?.stocks?.[stockId]?.daily
    || [];
}

function candidateWatchlistState(item) {
  const existing = (DATA.watchlist_data?.active || [])
    .find(row => String(row.stock_id) === String(item.stock_id));
  if (!existing) return { existing: null, complete: false };
  const existingSources = new Set(existing.sources || []);
  const expected = unifiedCandidateSources(item);
  return { existing, complete: expected.every(source => existingSources.has(source)) };
}

function _necklineData() {
  const data = DATA.neckline_candidates_data || {};
  if (!data.watch_pool) data.watch_pool = [];
  if (!data.deleted) data.deleted = {};
  if (!data.summary) data.summary = {};
  return data;
}

function syncNecklineSummary(data) {
  if (!data.summary) data.summary = {};
  data.summary.watch_pool_total = (data.watch_pool || []).length;
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
    ...((item.reasons || []).length ? {
      workbench: {
        captured_date: (DATA.decision_pool_data?.data_date || dateTW()).slice(0, 10),
        reasons: item.reason_labels || item.reasons || [],
        signal_date: item.signal_date || '',
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
      ...(item.reason_labels || []),
      ...(neckline ? ['頸線回測', neckline.entry_type_label].filter(Boolean) : []),
    ])];
    if (state.existing.key_level == null && neckline) state.existing.key_level = neckline.neckline_price ?? null;
    wl.last_updated = dateTW();
    const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: merge sources ${stockId}`);
    if (ok) { alert(`${stockId} 已合併來源`); renderNav(); renderStrategy(); }
    return;
  }

  const addedDate = dateTW();
  const entryPrice = neckline?.as_of_price
    ?? _watchlistEntryClose(stockId, addedDate)
    ?? regular.close
    ?? item.current_price
    ?? null;
  const currentPrice = item.current_price ?? entryPrice;
  wl.active.push({
    id: `${stockId}-${Date.now()}`,
    stock_id: stockId,
    name: item.name,
    industry: item.industry,
    market: item.market,
    source_strategy: sourceLabels.join(' / ') || '工作檯',
    sources: sourceCodes,
    source_details: sourceDetails,
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice,
    current_price: currentPrice,
    pnl_pct: entryPrice ? Number(((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)) : 0,
    pattern_score: regular.pattern_score ?? null,
    pattern_state: regular.pattern_state || item.status || neckline?.signal_label || '觀察中',
    pattern_tags: [...new Set([
      ...(regular.pattern_tags || []),
      ...(item.reason_labels || []),
      ...(neckline ? ['頸線回測', neckline.entry_type_label].filter(Boolean) : []),
    ])],
    patterns: regular.patterns || [],
    key_level: regular.key_level ?? regular.breakout_key_level ?? neckline?.neckline_price ?? null,
    invalidation: regular.invalidation ?? null,
    vol_20d_avg: metrics.vol_20d_avg ?? neckline?.avg_vol_20d ?? item.vol_20d_avg ?? null,
    pinned: false,
    status: '觀察中',
    note: (item.reason_labels || []).join(' / ') || '',
  });
  wl.last_updated = addedDate;
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add workbench ${stockId}`);
  if (ok) { alert(`${stockId} 已加入自選`); renderNav(); renderStrategy(); }
  else wl.active.pop();
}

async function deleteUnifiedNecklineCandidate(stockId) {
  const d = _necklineData();
  const idx = d.watch_pool.findIndex(item => String(item.stock_id) === String(stockId));
  if (idx === -1) return;
  const row = d.watch_pool[idx];
  if (!confirm(`將 ${row.stock_id} ${row.name || ''} 移出頸線觀察池？30個交易日內不會再自動跳出。`)) return;

  const prevDeleted = { ...d.deleted };
  d.watch_pool.splice(idx, 1);
  d.deleted[stockId] = { deleted_date: dateTW() };
  syncNecklineSummary(d);

  const ok = await miniWriteJson('data/neckline_candidates.json', d, `neckline: delete ${stockId}`);
  if (ok) { renderNav(); renderStrategy(); }
  else { d.watch_pool.splice(idx, 0, row); d.deleted = prevDeleted; syncNecklineSummary(d); }
}

function setUnifiedCandidatePeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-unified-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  drawPoolKChart(
    card.querySelector('canvas'),
    aggregatePoolBars(unifiedCandidateBars(String(stockId)), period),
    `unified-${stockId}`,
    null,
    [],
  );
}

function renderUnifiedCandidates(strat, main) {
  const pool = DATA.decision_pool_data || {};
  const allDecisionRows = Array.isArray(pool.rows) ? pool.rows : buildUnifiedCandidateRows();
  const summary = pool.summary || {};
  const strongLatestRows = DATA.strong_stock_monitor_data?.latest_rows || [];
  const activeFilter = window._decisionPoolFilter || 'all';
  const filterOptions = [
    ['all', '全部', allDecisionRows.length],
    ['neckline_confirmed', '頸線當日進場', summary.neckline_confirmed ?? 0],
    ['resonance', '三池共振', summary.resonance ?? 0],
    ['trend_45_65', '趨勢45-65', summary.trend_45_65 ?? 0],
    ['strong_latest', '強勢Latest', strongLatestRows.length],
  ];
  window.setDecisionPoolFilter = key => {
    window._decisionPoolFilter = key;
    renderStrategy();
  };
  const rows = activeFilter === 'strong_latest'
    ? strongLatestRows
    : activeFilter === 'all'
    ? allDecisionRows
    : allDecisionRows.filter(row => (row.reasons || []).includes(activeFilter));

  const poolDataDate = pool.data_date || String(pool.updated || '').slice(0, 10) || '-';
  const kbarDate = (() => {
    const stocks = DATA.decision_pool_kbars_data?.stocks || {};
    let latest = '';
    for (const entry of Object.values(stocks)) {
      const last = (entry?.daily || []).at(-1);
      if (last?.date && last.date > latest) latest = last.date;
    }
    return latest;
  })();
  const kbarStale = kbarDate && poolDataDate !== '-' && kbarDate < poolDataDate;
  const kbarTag = kbarDate
    ? `<span class="updated-tag" ${kbarStale ? 'style="color:var(--red,#e05252);border-color:var(--red,#e05252)" title="K棒資料比工作檯日期舊，圖是舊的"' : ''}>K棒 ${kbarDate}${kbarStale ? ' ⚠' : ''}</span>`
    : '';
  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);
  const fmtLots = value => value == null || Number.isNaN(Number(value)) ? '-' : Math.round(Number(value)).toLocaleString();
  const reason = row => (row.reason_labels || []).join(' / ') || '工作檯來源';
  const strongReason = row => row.tier === 'leader' ? '強勢Latest / Leader' : '強勢Latest / Watch';
  const cards = rows.map(row => {
    const isStrongLatest = activeFilter === 'strong_latest';
    const latest = (isStrongLatest ? strongStockBars(String(row.stock_id)) : unifiedCandidateBars(String(row.stock_id))).at(-1) || {};
    const volume = row.volume ?? latest.volume ?? latest.vol ?? null;
    const current = row.current_price ?? latest.close ?? null;
    const rowLabel = isStrongLatest ? strongReason(row) : reason(row);
    const rowStatus = isStrongLatest ? `新進 ${row.first_seen_date || row.date || ''}` : (row.status || '待看K');
    const dataAttr = isStrongLatest ? `data-strong-id="${row.stock_id}"` : `data-unified-id="${row.stock_id}"`;
    const periodFn = isStrongLatest ? 'setStrongStockPeriod' : 'setUnifiedCandidatePeriod';
    const emptyPrefix = isStrongLatest ? 'strong' : 'unified';
    return `<article class="pool-kcard" ${dataAttr} data-period="day">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${row.stock_id}</span><span class="stock-name">${row.name || '-'}</span></div>
          <div class="stock-industry">${row.industry || '-'}</div>
        </div>
        <div class="pool-kcard-score"><span>現價</span><strong>${fmt(current)}</strong><em>${row.signal_date || ''}</em></div>
      </div>
      <div class="pool-kcard-tags">
        <span class="tag-badge" style="color:var(--green);border-color:var(--border)">${rowLabel}</span>
        ${!isStrongLatest ? renderHollowPatternBadge(row) : ''}
        <span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${rowStatus}</span>
      </div>
      <div class="pool-kchart-wrap">
        <canvas></canvas>
        <div class="pool-kchart-empty" data-empty="${emptyPrefix}-${row.stock_id}">無 K 棒資料</div>
        <div class="pool-period-switch">
          <button class="active" onclick="${periodFn}('${row.stock_id}','day')">日</button>
          <button onclick="${periodFn}('${row.stock_id}','week')">週</button>
          <button onclick="${periodFn}('${row.stock_id}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>成交量</span><strong>${fmtLots(volume)}</strong></div>
        <div><span>20日均量</span><strong>${fmtLots(row.vol_20d_avg ?? row.vol20)}</strong></div>
        ${isStrongLatest ? `<div><span>20日</span><strong>${fmt(row.ret_20d_pct, 1)}%</strong></div><div><span>相對20日</span><strong>${fmt(row.relative_20d_pct, 1)}%</strong></div>` : ''}
      </div>
    </article>`;
  }).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header">
      <div class="strat-title">${strat.icon} ${strat.name}</div>
      <div class="strat-desc">只放每日需要人工看圖維護的標的：頸線當日進場、三池共振、趨勢45-65。未確認訊號留在背景策略頁。</div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <span class="table-title">今日待看</span>
        <div class="toolbar-right">
          <span class="updated-tag">共 ${summary.total ?? rows.length} 檔</span>
          <span class="updated-tag">頸線 ${summary.neckline_confirmed ?? 0}</span>
          <span class="updated-tag">三池 ${summary.resonance ?? 0}</span>
          <span class="updated-tag">趨勢45-65 ${summary.trend_45_65 ?? 0}</span>
          <span class="updated-tag">工作檯 ${poolDataDate}</span>
          ${kbarTag}
        </div>
      </div>
      ${strongLatestRows.length ? `<div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div class="summary-label">強勢雷達 Latest</div>
          <div class="summary-sub">最近 3 個交易日新進雷達，先看 K 棒確認，不視為進場訊號</div>
        </div>
        <button class="view-btn" onclick="setStrategy('strong_stock_monitor')">查看 ${strongLatestRows.length} 檔</button>
      </div>` : ''}
      <div style="display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        ${filterOptions.map(([key, label, count]) => `
          <button class="view-btn ${activeFilter === key ? 'active' : ''}" onclick="setDecisionPoolFilter('${key}')">${label} ${count}</button>
        `).join('')}
      </div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">今日沒有需要放上工作檯的標的</div>'}</div>
    </div>
  </div>`;
  setTimeout(() => rows.forEach(row => {
    if (activeFilter === 'strong_latest') setStrongStockPeriod(row.stock_id, 'day');
    else setUnifiedCandidatePeriod(row.stock_id, 'day');
  }), 40);
}

function strongStockBars(stockId) {
  return DATA.strong_stock_kbars_data?.stocks?.[String(stockId)]?.daily
    || DATA.stock_kbars_data?.stocks?.[String(stockId)]?.daily
    || [];
}

function setStrongStockPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-strong-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  drawPoolKChart(
    card.querySelector('canvas'),
    aggregatePoolBars(strongStockBars(String(stockId)), period),
    `strong-${stockId}`,
    null,
    [],
  );
}

function renderStrongStockMonitor(strat, main) {
  const data = DATA.strong_stock_monitor_data || {};
  const summary = data.summary || {};
  const allRows = Array.isArray(data.rows) ? data.rows : [];
  const latestRows = Array.isArray(data.latest_rows) ? data.latest_rows : allRows.filter(row => row.latest_entered);
  const activeFilter = window._strongStockFilter || 'latest';
  const strongThemes = (data.themes || []).filter(theme => theme.strong_theme);
  const filterOptions = [
    ['latest', 'Latest', summary.latest ?? latestRows.length],
    ['leader', 'Leader', summary.leader ?? allRows.filter(row => row.tier === 'leader').length],
    ['watch', 'Watch', summary.watch ?? allRows.filter(row => row.tier === 'watch').length],
    ['all', '全部', summary.total ?? allRows.length],
  ];
  window.setStrongStockFilter = key => {
    window._strongStockFilter = key;
    renderStrategy();
  };
  const rows = activeFilter === 'latest'
    ? latestRows
    : activeFilter === 'all' ? allRows : allRows.filter(row => row.tier === activeFilter);
  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);
  const fmtPct = value => value == null || Number.isNaN(Number(value)) ? '-' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
  const fmtLots = value => value == null || Number.isNaN(Number(value)) ? '-' : Math.round(Number(value)).toLocaleString();
  const kbarDate = (() => {
    let latest = '';
    rows.forEach(row => {
      const last = strongStockBars(row.stock_id).at(-1);
      if (last?.date && last.date > latest) latest = last.date;
    });
    return latest;
  })();
  const themeHtml = strongThemes.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:12px 14px;border-bottom:1px solid var(--border)">
        ${strongThemes.map(theme => `
          <div class="summary-card" style="min-height:86px">
            <div class="summary-label">${escapeHtml(theme.label)}</div>
            <div class="summary-value">${theme.leader_count}<small style="font-size:10px;color:var(--text3);margin-left:5px">Leader</small></div>
            <div class="summary-sub">Watch ${theme.watch_count}｜相對20日 ${fmtPct(theme.avg_relative_20d_pct)}</div>
          </div>
        `).join('')}
      </div>`
    : '';
  const cards = rows.map(row => {
    const latest = strongStockBars(row.stock_id).at(-1) || {};
    const themes = (row.themes || []).map(theme => theme.label).filter(Boolean).join(' / ');
    const reasons = (row.reasons || []).slice(0, 4).join(' / ');
    const tierLabel = row.tier === 'leader' ? 'Leader' : 'Watch';
    const latestTag = row.latest_entered
      ? `<span class="tag-badge" style="color:var(--amber);border-color:var(--border)">新進 ${escapeHtml(row.first_seen_date || row.date || '')}</span>`
      : '';
    return `<article class="pool-kcard" data-strong-id="${row.stock_id}" data-period="day">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${escapeHtml(row.stock_id)}</span><span class="stock-name">${escapeHtml(row.name || '-')}</span></div>
          <div class="stock-industry">${escapeHtml(row.industry || themes || '-')}</div>
        </div>
        <div class="pool-kcard-score"><span>${tierLabel}</span><strong>${fmt(row.close ?? latest.close)}</strong><em>${row.date || ''}</em></div>
      </div>
      <div class="pool-kcard-tags">
        <span class="tag-badge" style="color:${row.tier === 'leader' ? 'var(--green)' : 'var(--blue)'};border-color:var(--border)">${tierLabel}</span>
        ${latestTag}
        ${themes ? `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${escapeHtml(themes)}</span>` : ''}
      </div>
      <div class="pool-kchart-wrap">
        <canvas></canvas>
        <div class="pool-kchart-empty" data-empty="strong-${row.stock_id}">無 K 棒資料</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setStrongStockPeriod('${row.stock_id}','day')">日</button>
          <button onclick="setStrongStockPeriod('${row.stock_id}','week')">週</button>
          <button onclick="setStrongStockPeriod('${row.stock_id}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>20日</span><strong>${fmtPct(row.ret_20d_pct)}</strong></div>
        <div><span>相對20日</span><strong>${fmtPct(row.relative_20d_pct)}</strong></div>
        <div><span>量比</span><strong>${fmt(row.vol_ratio, 2)}</strong></div>
        <div><span>20均量</span><strong>${fmtLots(row.vol20)}</strong></div>
      </div>
      ${reasons ? `<div class="stock-industry" style="padding:0 14px 12px">${escapeHtml(reasons)}</div>` : ''}
    </article>`;
  }).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header">
      <div class="strat-title">${strat.icon} ${strat.name}</div>
      <div class="strat-desc">強勢股與族群同步監控。這裡用來看 K 棒型態與族群是否同步，不直接視為進場確認。</div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar">
        <span class="table-title">強勢看圖雷達</span>
        <div class="toolbar-right">
          <span class="updated-tag">Leader ${summary.leader ?? '-'}</span>
          <span class="updated-tag">Watch ${summary.watch ?? '-'}</span>
          <span class="updated-tag">Latest ${summary.latest ?? latestRows.length}</span>
          <span class="updated-tag">強勢族群 ${summary.strong_themes ?? '-'}</span>
          <span class="updated-tag">資料 ${data.data_date || '-'}</span>
          ${kbarDate ? `<span class="updated-tag">K棒 ${kbarDate}</span>` : ''}
        </div>
      </div>
      ${themeHtml}
      <div style="display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">
        ${filterOptions.map(([key, label, count]) => `
          <button class="view-btn ${activeFilter === key ? 'active' : ''}" onclick="setStrongStockFilter('${key}')">${label} ${count}</button>
        `).join('')}
      </div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有符合條件的強勢股</div>'}</div>
    </div>
  </div>`;
  setTimeout(() => rows.forEach(row => setStrongStockPeriod(row.stock_id, 'day')), 40);
}
