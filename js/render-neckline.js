const MINI_NECKLINE_CANDIDATES = 'data/neckline_candidates.json';

function _necklineData() {
  if (!DATA.neckline_candidates_data) DATA.neckline_candidates_data = {};
  const d = DATA.neckline_candidates_data;
  if (!Array.isArray(d.watch_pool)) d.watch_pool = [];
  if (!Array.isArray(d.pinned_tracking)) d.pinned_tracking = [];
  if (!d.deleted || typeof d.deleted !== 'object') d.deleted = {};
  if (!d.pinned || typeof d.pinned !== 'object') d.pinned = {};
  syncNecklineSummary(d);
  return d;
}

function syncNecklineSummary(d) {
  if (!d.summary || typeof d.summary !== 'object') d.summary = {};
  d.summary.watch_pool_total = d.watch_pool.length;
  d.summary.pinned_total = Object.keys(d.pinned).length;
  d.summary.new_in_watch_pool = d.watch_pool.filter(row => row && row.is_new).length;
  return d.summary;
}

function getNecklineRankData() {
  return DATA.neckline_daily_rank_data || { summary: {}, rows: [] };
}

function necklineGuideLevels(row) {
  return [
    { value: row.neckline_price, color: '#176d91', dash: [5, 3] },
    { value: row.box_high, color: '#8b5cf6', dash: [3, 3] },
  ].filter(level => level.value != null && Number.isFinite(Number(level.value)));
}

function getNecklineBars(stockId) {
  return DATA.neckline_kbars_data?.stocks?.[stockId]?.daily
    || DATA.confirmed_entry_kbars_data?.stocks?.[stockId]?.daily
    || DATA.stock_kbars_data?.stocks?.[stockId]?.daily
    || [];
}

function setNecklineKPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-neckline-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const row = _necklineData().watch_pool.find(item => String(item.stock_id) === String(stockId));
  const bars = getNecklineBars(stockId);
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), `neckline-${stockId}`, null, necklineGuideLevels(row || {}));
}

function drawNecklineKCharts(rows) {
  rows.forEach(row => setNecklineKPeriod(String(row.stock_id), 'day'));
}

function setHollowNecklineKPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-hollow-neckline-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const row = getNecklineRankData().rows?.find(item => String(item.stock_id) === String(stockId));
  const bars = getNecklineBars(stockId);
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), `hollow-neckline-${stockId}`, null, necklineGuideLevels(row || {}));
}

function drawHollowNecklineKCharts(rows) {
  rows.forEach(row => setHollowNecklineKPeriod(String(row.stock_id), 'day'));
}

async function pinNecklineWatch(stockId) {
  const d = _necklineData();
  const row = d.watch_pool.find(item => String(item.stock_id) === String(stockId));
  if (!row) return;
  const today = dateTW();
  const pinInfo = { pin_date: today, pin_price: row.as_of_price, name: row.name };
  const prevPinned = { ...d.pinned };
  const prevTracking = [...d.pinned_tracking];

  d.pinned[stockId] = pinInfo;
  row.pinned = true;
  d.pinned_tracking = [
    { stock_id: stockId, name: row.name, industry: row.industry, pin_date: today, pin_price: row.as_of_price, current_price: row.as_of_price, pnl_pct: 0, status_now: row.signal_label || '觀察池' },
    ...d.pinned_tracking.filter(item => String(item.stock_id) !== String(stockId)),
  ];
  syncNecklineSummary(d);

  const ok = await miniWriteJson(MINI_NECKLINE_CANDIDATES, d, `neckline: pin ${stockId}`);
  if (ok) renderStrategy();
  else { d.pinned = prevPinned; row.pinned = false; d.pinned_tracking = prevTracking; syncNecklineSummary(d); }
}

async function unpinNecklineTracking(stockId) {
  const d = _necklineData();
  const prevPinned = { ...d.pinned };
  const prevTracking = [...d.pinned_tracking];

  delete d.pinned[stockId];
  d.pinned_tracking = d.pinned_tracking.filter(item => String(item.stock_id) !== String(stockId));
  const watchRow = d.watch_pool.find(item => String(item.stock_id) === String(stockId));
  if (watchRow) watchRow.pinned = false;
  syncNecklineSummary(d);

  const ok = await miniWriteJson(MINI_NECKLINE_CANDIDATES, d, `neckline: unpin ${stockId}`);
  if (ok) renderStrategy();
  else { d.pinned = prevPinned; d.pinned_tracking = prevTracking; if (watchRow) watchRow.pinned = true; syncNecklineSummary(d); }
}

async function deleteNecklineWatch(stockId) {
  return deleteManyNecklineStocks([stockId]);
}

async function deleteManyNecklineStocks(stockIds) {
  const d = _necklineData();
  const ids = [...new Set(stockIds.map(String).filter(Boolean))];
  if (!ids.length) return;
  const labels = ids.slice(0, 8).map(id => {
    const row = d.watch_pool.find(item => String(item.stock_id) === id)
      || getNecklineRankData().rows?.find(item => String(item.stock_id) === id);
    return `${id}${row?.name ? ` ${row.name}` : ''}`;
  });
  const moreText = ids.length > 8 ? ` 等 ${ids.length} 檔` : '';
  if (!confirm(`將 ${labels.join('、')}${moreText} 移出頸線清單？30個交易日內不會再自動跳出。`)) return;

  const prevWatchPool = [...d.watch_pool];
  const prevDeleted = { ...d.deleted };
  const prevPinned = { ...d.pinned };
  const prevTracking = [...d.pinned_tracking];

  d.watch_pool = d.watch_pool.filter(item => !ids.includes(String(item.stock_id)));
  ids.forEach(stockId => {
    d.deleted[stockId] = { deleted_date: dateTW() };
    delete d.pinned[stockId];
  });
  d.pinned_tracking = d.pinned_tracking.filter(item => !ids.includes(String(item.stock_id)));
  syncNecklineSummary(d);

  const ok = await miniWriteJson(MINI_NECKLINE_CANDIDATES, d, `neckline: delete ${ids.join(',')}`);
  if (ok) renderStrategy();
  else {
    d.watch_pool = prevWatchPool;
    d.deleted = prevDeleted;
    d.pinned = prevPinned;
    d.pinned_tracking = prevTracking;
    syncNecklineSummary(d);
  }
}

function renderNeckline(strat, main) {
  const data = _necklineData();
  const summary = data.summary || {};
  const rows = [...data.watch_pool].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const rankData = getNecklineRankData();
  const watchPoolTotal = rows.length;
  const newInWatchPool = rows.filter(row => row && row.is_new).length;
  const rankRowMap = new Map((rankData.rows || []).map(row => [String(row.stock_id), row]));
  const hollowRows = (rankData.rows || []).filter(row => row.is_hollow_pattern);
  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);

  const cards = rows.map(row => {
    const dist = row.dist_to_neckline_pct;
    const rankRow = rankRowMap.get(String(row.stock_id));
    const tags = [
      row.is_new ? '今日新增' : '',
      rankRow?.is_hollow_pattern ? (rankRow.hollow_pattern_label || '凹洞型態') : '',
      row.entry_type_label || '',
      `拉回 ${row.event_age_days} 日`,
    ].filter(Boolean);
    return `<article class="pool-kcard" data-neckline-id="${row.stock_id}">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${row.stock_id}</span><span class="stock-name">${row.name || '-'}</span></div>
          <div class="stock-industry">${row.industry || '-'}</div>
        </div>
        <div class="pool-kcard-score"><span>距頸線</span><strong>${dist == null ? '-' : `${dist.toFixed(2)}%`}</strong><em>現價 ${fmt(row.as_of_price)}</em></div>
      </div>
      <div class="pool-kcard-tags">
        ${row.pinned ? '<span class="tag-badge" style="color:var(--amber);border-color:var(--amber)">★ 釘選</span>' : ''}
        ${tags.map(tag => `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${tag}</span>`).join('')}
      </div>
      <div class="pool-kchart-wrap">
        <canvas></canvas><div class="pool-kchart-empty" data-empty="neckline-${row.stock_id}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setNecklineKPeriod('${row.stock_id}','day')">日</button>
          <button onclick="setNecklineKPeriod('${row.stock_id}','week')">週</button>
          <button onclick="setNecklineKPeriod('${row.stock_id}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>頸線</span><strong>${fmt(row.neckline_price)}</strong></div>
        <div><span>箱型高點</span><strong>${fmt(row.box_high)}</strong></div>
        <div><span>拉回低點日</span><strong>${row.dip_date || '-'}</strong></div>
        <div><span>20日均量</span><strong>${row.avg_vol_20d == null ? '-' : Math.round(row.avg_vol_20d).toLocaleString()}</strong></div>
      </div>
      <div class="pool-kcard-actions">
        <button class="perf-btn sidebar-mini-btn" onclick="${row.pinned ? `unpinNecklineTracking('${row.stock_id}')` : `pinNecklineWatch('${row.stock_id}')`}">${row.pinned ? '取消釘選' : '釘選'}</button>
        <button class="perf-btn perf-btn-del sidebar-mini-btn" onclick="deleteNecklineWatch('${row.stock_id}')">刪除</button>
      </div>
    </article>`;
  }).join('');

  const hollowCards = hollowRows.map(row => {
    const stockId = String(row.stock_id);
    return `<article class="pool-kcard" data-hollow-neckline-id="${stockId}">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id"><span class="stock-code">${stockId}</span><span class="stock-name">${row.name || '-'}</span></div>
          <div class="stock-industry">${row.industry || '-'}</div>
        </div>
        <div class="pool-kcard-score"><span>現價</span><strong>${fmt(row.as_of_price)}</strong><em>${row.status || '-'}</em></div>
      </div>
      <div class="pool-kcard-tags">
        <span class="tag-badge" style="color:#57d4c6;border-color:rgba(87,212,198,.55)">凹洞型態</span>
        <span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${row.strength_label || '-'}</span>
      </div>
      <div class="pool-kchart-wrap">
        <canvas></canvas><div class="pool-kchart-empty" data-empty="hollow-neckline-${stockId}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setHollowNecklineKPeriod('${stockId}','day')">日</button>
          <button onclick="setHollowNecklineKPeriod('${stockId}','week')">週</button>
          <button onclick="setHollowNecklineKPeriod('${stockId}','month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>頸線</span><strong>${fmt(row.neckline_price)}</strong></div>
        <div><span>確認日</span><strong>${row.entry_date || '-'}</strong></div>
        <div><span>強勢分</span><strong>${fmt(row.score_total, 1)}</strong></div>
        <div><span>量縮</span><strong>凹洞</strong></div>
      </div>
    </article>`;
  }).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header"><div class="strat-title">${strat.icon} ${strat.name}</div><div class="strat-desc">${strat.description}</div></div>
    <div class="summary-row">
      <div class="summary-card"><div class="summary-label">候選清單</div><div class="summary-value">${summary.candidate_pool_total ?? '-'}</div><div class="summary-sub">全市場掃描</div></div>
      <div class="summary-card"><div class="summary-label">觀察池</div><div class="summary-value green">${watchPoolTotal}</div><div class="summary-sub">距頸線 5% 以內</div></div>
      <div class="summary-card"><div class="summary-label">已進場</div><div class="summary-value blue">${summary.entered_total ?? '-'}</div><div class="summary-sub">請至「頸線追蹤」查看</div></div>
      <div class="summary-card"><div class="summary-label">排名母體</div><div class="summary-value amber">${rankData.summary?.total ?? '-'}</div><div class="summary-sub">含你保留的全量樣本</div></div>
      <div class="summary-card"><div class="summary-label">資料日期</div><div class="summary-value" style="font-size:16px">${data.updated || '-'}</div><div class="summary-sub">盤後掃描</div></div>
    </div>
    <div class="conditions">${(strat.conditions || []).map(condition => `<span class="cond"><i class="cond-dot"></i>${condition}</span>`).join('')}</div>
    <div class="table-wrap">
      <div class="table-toolbar"><span class="table-title">凹洞型態 K棒</span><div class="toolbar-right"><span class="updated-tag">${hollowRows.length} 檔</span></div></div>
      <div class="pool-kcard-grid">${hollowCards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有凹洞型態標的</div>'}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px">
      <div class="table-toolbar"><span class="table-title">觀察池</span><div class="toolbar-right"><span class="updated-tag">今日新增 ${newInWatchPool}</span></div></div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有貼近頸線的標的</div>'}</div>
    </div>
  </div>`;
  setTimeout(() => drawNecklineKCharts(rows), 40);
  setTimeout(() => drawHollowNecklineKCharts(hollowRows), 60);
}
