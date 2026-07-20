// 策略共振：三追蹤池（趨勢/突破/頸線）交集檢視。
// 資料來源 data/pool_resonance.json（notify_pool_resonance.py 匯出），
// K棒 data/resonance_kbars.json（export_resonance_kbars.py 從本地價格倉匯出）。
// 標的隨各池時效到期自動離池，這一頁永遠只顯示「現在仍共振中」的標的。

const RESONANCE_POOL_ORDER = ['趨勢', '突破', '頸線'];
const RESONANCE_POOL_COLORS = { 趨勢: '#b8873b', 突破: '#c0504d', 頸線: '#176d91' };
const RESONANCE_SOURCE_CODES = { 趨勢: 'big_holder_trend', 突破: 'right_top', 頸線: 'neckline_retest' };

function resonanceRows() {
  return DATA.pool_resonance_data?.rows || [];
}

function resonanceBars(stockId) {
  return DATA.resonance_kbars_data?.stocks?.[stockId]?.daily
    || DATA.stock_kbars_data?.stocks?.[stockId]?.daily
    || DATA.neckline_kbars_data?.stocks?.[stockId]?.daily
    || [];
}

function resonanceGuideLevels(row) {
  return RESONANCE_POOL_ORDER
    .filter(pool => row.pools?.[pool]?.entry_price != null)
    .map(pool => ({ value: row.pools[pool].entry_price, color: RESONANCE_POOL_COLORS[pool], dash: [4, 3] }));
}

function resonanceEarliestPool(row) {
  const pools = Object.entries(row.pools || {}).filter(([, d]) => d.entry_date);
  if (!pools.length) return null;
  pools.sort((a, b) => a[1].entry_date.localeCompare(b[1].entry_date));
  return { pool: pools[0][0], ...pools[0][1] };
}

function resonanceMinDaysRemaining(row) {
  const days = Object.values(row.pools || {})
    .map(d => d.days_remaining)
    .filter(v => v != null && Number.isFinite(Number(v)));
  return days.length ? Math.min(...days) : null;
}

function _applyPriceToResonance(priceMap) {
  const data = DATA.pool_resonance_data;
  if (!data) return;
  (data.rows || []).forEach(row => {
    const price = priceMap[row.stock_id];
    if (price === undefined) return;
    row.current_price = price;
    Object.values(row.pools || {}).forEach(detail => {
      if (detail.entry_price) {
        detail.current_price = price;
        detail.pnl_pct = parseFloat(((price - detail.entry_price) / detail.entry_price * 100).toFixed(2));
      }
    });
  });
}

function setResonancePeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-resonance-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const row = resonanceRows().find(r => String(r.stock_id) === String(stockId));
  drawPoolKChart(
    card.querySelector('canvas'),
    aggregatePoolBars(resonanceBars(String(stockId)), period),
    `resonance-${stockId}`,
    getWatchlistMarkerDate(stockId),
    row ? resonanceGuideLevels(row) : [],
  );
}

async function addResonanceToWatchlist(stockId) {
  const row = resonanceRows().find(r => String(r.stock_id) === String(stockId));
  if (!row) return;
  const wl = _watchlistData();
  const existing = (wl.active || []).find(item => String(item.stock_id) === String(stockId));
  const sourceCodes = Object.keys(row.pools || {}).map(pool => RESONANCE_SOURCE_CODES[pool]).filter(Boolean);
  if (existing) {
    existing.sources = [...new Set([...(existing.sources || []), ...sourceCodes])];
    existing.pattern_tags = [...new Set([...(existing.pattern_tags || []), `策略共振${row.level}池`])];
    wl.last_updated = dateTW();
    const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: merge resonance ${stockId}`);
    if (ok) { alert(`${stockId} 已合併共振來源`); renderNav(); renderStrategy(); }
    return;
  }
  const addedDate = dateTW();
  const earliest = resonanceEarliestPool(row);
  const entryPrice = row.current_price ?? earliest?.entry_price ?? null;
  wl.active.push({
    id: `${stockId}-${Date.now()}`,
    stock_id: String(stockId),
    name: row.name,
    industry: row.industry || '',
    market: '',
    source_strategy: '策略共振',
    sources: sourceCodes,
    source_details: {},
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice,
    current_price: row.current_price ?? entryPrice,
    pnl_pct: 0,
    pattern_score: null,
    pattern_state: '觀察中',
    pattern_tags: [`策略共振${row.level}池`, ...Object.keys(row.pools || {})],
    patterns: [],
    key_level: null,
    invalidation: null,
    vol_20d_avg: null,
    pinned: false,
    status: '觀察中',
    note: `策略共振：${Object.entries(row.pools).map(([pool, d]) => `${pool}${d.entry_date?.slice(5) || ''}`).join(' / ')}`,
  });
  wl.last_updated = addedDate;
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add resonance ${stockId}`);
  if (ok) { alert(`${stockId} 已加入自選`); renderNav(); renderStrategy(); }
  else wl.active.pop();
}

function renderPoolResonance(strat, main) {
  const allRows = resonanceRows();
  const dataDate = DATA.pool_resonance_data?.data_date
    || (DATA.pool_resonance_data?.updated || '').slice(0, 10);
  const filter = window._resonanceFilter || 'all';
  const matches = (row, key) => key === 'triple' ? row.level >= 3
    : key === 'double' ? row.level === 2
      : key === 'fresh' ? row.resonance_date === dataDate
        : key === 'a_plus' ? !!candidateHighMomentum(row.stock_id)?.a_plus_retest
          : key === 'ten_year' ? !!(candidateHighMomentum(row.stock_id)?.close_new_high_10y || candidateHighMomentum(row.stock_id)?.high_new_high_10y)
        : true;
  const counts = key => allRows.filter(row => matches(row, key)).length;
  const filters = [
    ['all', '全部'],
    ['triple', '三池全中'],
    ['double', '雙池共振'],
    ['a_plus', 'A+回測'],
    ['ten_year', '10年高'],
    ['fresh', '本次新完成'],
  ];
  window.setResonanceFilter = key => {
    window._resonanceFilter = key;
    renderStrategy();
  };

  const rows = [...allRows].filter(row => matches(row, filter)).sort((a, b) => {
    const highDiff = candidateHighMomentumScore(candidateHighMomentum(b.stock_id)) - candidateHighMomentumScore(candidateHighMomentum(a.stock_id));
    if (highDiff !== 0) return highDiff;
    if (a.level !== b.level) return b.level - a.level;
    if (a.resonance_date !== b.resonance_date) return b.resonance_date.localeCompare(a.resonance_date);
    const aPnl = resonanceEarliestPool(a)?.pnl_pct ?? -999;
    const bPnl = resonanceEarliestPool(b)?.pnl_pct ?? -999;
    return bPnl - aPnl;
  });

  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);
  const fmtPnl = value => {
    if (value == null || Number.isNaN(Number(value))) return '<strong>-</strong>';
    const cls = Number(value) > 0 ? 'pos' : Number(value) < 0 ? 'neg' : '';
    return `<strong class="${cls}">${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(1)}%</strong>`;
  };
  const buttons = filters.map(([key, label]) => `<button class="view-btn ${filter === key ? 'active' : ''}" onclick="setResonanceFilter('${key}')">${label} ${counts(key)}</button>`).join('');

  const cards = rows.map(row => {
    const earliest = resonanceEarliestPool(row);
    const minDays = resonanceMinDaysRemaining(row);
    const inWatchlist = (DATA.watchlist_data?.active || []).some(item => String(item.stock_id) === String(row.stock_id));
    const themeLabels = candidateThemeLabels(row.stock_id);
    const roleLabels = candidateThemeRoleLabels(row.stock_id);
    const high = candidateHighMomentum(row.stock_id);
    const poolTags = RESONANCE_POOL_ORDER
      .filter(pool => row.pools?.[pool])
      .map(pool => `<span class="tag-badge" style="color:${RESONANCE_POOL_COLORS[pool]};border-color:var(--border)">${pool} ${row.pools[pool].entry_date?.slice(5) || '-'}</span>`)
      .join('');
    const levelPill = row.level >= 3
      ? '<span class="rank-grade-pill rank-strength-priority">🔥 三池全中</span>'
      : '<span class="rank-grade-pill rank-strength-watch">雙池共振</span>';
    const freshTag = row.resonance_date === dataDate ? '<span class="tag-badge" style="color:var(--amber);border-color:var(--border)">本次新完成</span>' : '';
    const poolDetails = RESONANCE_POOL_ORDER
      .filter(pool => row.pools?.[pool])
      .map(pool => {
        const d = row.pools[pool];
        return `<div><span>${pool}池 ${d.entry_date?.slice(5) || '-'}</span>${fmtPnl(d.pnl_pct)}</div>`;
      })
      .join('');
    const highBadges = renderHighMomentumBadges(high);
    return `<article class="pool-kcard" data-resonance-id="${row.stock_id}">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${row.stock_id}</span><span class="stock-name">${row.name || '-'}</span></div>
          <div class="stock-industry">${row.industry || '-'}</div>
          ${renderCandidateThemeBadges(row.stock_id)}
        </div>
        <div class="pool-kcard-score"><span>現價</span><strong>${fmt(row.current_price)}</strong><em>共振完成 ${row.resonance_date?.slice(5) || '-'}</em></div>
      </div>
      <div class="pool-kcard-tags">${levelPill}${freshTag}${poolTags}</div>
      ${highBadges ? `<div class="pool-kcard-tags">${highBadges}</div>` : ''}
      <div class="pool-kchart-wrap">
        <canvas></canvas><div class="pool-kchart-empty" data-empty="resonance-${row.stock_id}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setResonancePeriod('${row.stock_id}','day')">日</button>
          <button onclick="setResonancePeriod('${row.stock_id}','week')">週</button>
          <button onclick="setResonancePeriod('${row.stock_id}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        ${poolDetails}
        <div><span>最早進場</span><strong>${earliest ? `${earliest.pool} ${fmt(earliest.entry_price)}` : '-'}</strong></div>
        <div><span>最短剩餘</span><strong>${minDays != null ? `${minDays} 交易日` : '-'}</strong></div>
        <div><span>高點動能</span><strong>${high?.momentum_reasons || '-'}</strong></div>
        <div><span>題材</span><strong>${themeLabels.join(' / ') || '-'}</strong></div>
        <div><span>角色</span><strong>${roleLabels.join(' / ') || '-'}</strong></div>
      </div>
      <div class="pool-kcard-actions">
        <button class="perf-btn perf-btn-add sidebar-mini-btn" onclick="addResonanceToWatchlist('${row.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已在自選' : '加入自選'}</button>
      </div>
    </article>`;
  }).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header"><div class="strat-title">${strat.icon} ${strat.name}</div><div class="strat-desc">${strat.description}</div></div>
    <div class="summary-row">
      <div class="summary-card"><div class="summary-label">共振標的</div><div class="summary-value">${counts('all')}</div><div class="summary-sub">同時在 2 池以上</div></div>
      <div class="summary-card"><div class="summary-label">三池全中</div><div class="summary-value amber">${counts('triple')}</div><div class="summary-sub">優先人工看圖</div></div>
      <div class="summary-card"><div class="summary-label">雙池共振</div><div class="summary-value blue">${counts('double')}</div><div class="summary-sub">次優先觀察</div></div>
      <div class="summary-card"><div class="summary-label">A+回測</div><div class="summary-value amber">${counts('a_plus')}</div><div class="summary-sub">共振又創10年高</div></div>
      <div class="summary-card"><div class="summary-label">本次新完成</div><div class="summary-value green">${counts('fresh')}</div><div class="summary-sub">共振日=${dataDate || '-'}</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar"><span class="table-title">策略共振</span><div class="toolbar-right"><span class="updated-tag">資料 ${dataDate || '-'}</span><button class="btn-csv" onclick="triggerPriceRefresh(this)">更新報價</button></div></div>
      <div style="display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">${buttons}</div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有共振中的標的</div>'}</div>
    </div>
  </div>`;
  setTimeout(() => rows.forEach(row => setResonancePeriod(row.stock_id, 'day')), 40);
}
