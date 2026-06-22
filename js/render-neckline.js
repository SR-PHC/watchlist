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

function necklineGuideLevels(row) {
  return [
    { value: row.neckline_price, color: '#176d91', dash: [5, 3] },
    { value: row.box_high, color: '#8b5cf6', dash: [3, 3] },
  ].filter(level => level.value != null && Number.isFinite(Number(level.value)));
}

function setNecklineKPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-neckline-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(button => {
    button.classList.toggle('active', button.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const row = _necklineData().watch_pool.find(item => String(item.stock_id) === String(stockId));
  const bars = DATA.neckline_kbars_data?.stocks?.[stockId]?.daily || [];
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), `neckline-${stockId}`, null, necklineGuideLevels(row || {}));
}

function drawNecklineKCharts(rows) {
  rows.forEach(row => setNecklineKPeriod(String(row.stock_id), 'day'));
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
  const d = _necklineData();
  const idx = d.watch_pool.findIndex(item => String(item.stock_id) === String(stockId));
  if (idx === -1) return;
  const row = d.watch_pool[idx];
  if (!confirm(`將 ${row.stock_id} ${row.name || ''} 移出觀察池？30個交易日內不會再自動跳出。`)) return;

  const prevDeleted = { ...d.deleted };
  d.watch_pool.splice(idx, 1);
  d.deleted[stockId] = { deleted_date: dateTW() };
  syncNecklineSummary(d);

  const ok = await miniWriteJson(MINI_NECKLINE_CANDIDATES, d, `neckline: delete ${stockId}`);
  if (ok) renderStrategy();
  else { d.watch_pool.splice(idx, 0, row); d.deleted = prevDeleted; syncNecklineSummary(d); }
}

function renderNeckline(strat, main) {
  const data = _necklineData();
  const summary = data.summary || {};
  const rows = [...data.watch_pool].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  const watchPoolTotal = rows.length;
  const newInWatchPool = rows.filter(row => row && row.is_new).length;
  const fmt = (value, digits = 2) => value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(digits);
  const pnlCls = pct => (pct || 0) >= 0 ? 'sa-pnl-pos' : 'sa-pnl-neg';
  const pnlStr = pct => pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;

  const cards = rows.map(row => {
    const dist = row.dist_to_neckline_pct;
    const tags = [
      row.is_new ? '今日新增' : '',
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
        <button class="perf-btn sidebar-mini-btn" onclick="pinNecklineWatch('${row.stock_id}')" ${row.pinned ? 'disabled' : ''}>${row.pinned ? '已釘選' : '釘選'}</button>
        <button class="perf-btn perf-btn-del sidebar-mini-btn" onclick="deleteNecklineWatch('${row.stock_id}')">刪除</button>
      </div>
    </article>`;
  }).join('');

  const trackingRows = data.pinned_tracking.map(row => `<tr>
    <td><span class="stock-code">${row.stock_id}</span><span style="font-size:12px;color:var(--text2);margin-left:4px">${row.name || '-'}</span></td>
    <td style="font-family:var(--mono);font-size:12px">${row.pin_date || '-'}</td>
    <td style="font-family:var(--mono);font-size:12px">${fmt(row.pin_price)}</td>
    <td style="font-family:var(--mono);font-size:12px">${fmt(row.current_price)}</td>
    <td><span class="${pnlCls(row.pnl_pct)}" style="font-family:var(--mono);font-weight:700">${pnlStr(row.pnl_pct)}</span></td>
    <td><span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${row.status_now || '-'}</span></td>
    <td><button class="perf-btn sidebar-mini-btn" onclick="unpinNecklineTracking('${row.stock_id}')">取消釘選</button></td>
  </tr>`).join('');

  main.innerHTML = `<div class="strategy-panel active">
    <div class="strat-header"><div class="strat-title">${strat.icon} ${strat.name}</div><div class="strat-desc">${strat.description}</div></div>
    <div class="summary-row">
      <div class="summary-card"><div class="summary-label">候選清單</div><div class="summary-value">${summary.candidate_pool_total ?? '-'}</div><div class="summary-sub">全市場掃描</div></div>
      <div class="summary-card"><div class="summary-label">觀察池</div><div class="summary-value green">${watchPoolTotal}</div><div class="summary-sub">距頸線 5% 以內</div></div>
      <div class="summary-card"><div class="summary-label">已進場</div><div class="summary-value blue">${summary.entered_total ?? '-'}</div><div class="summary-sub">請至「頸線追蹤」查看</div></div>
      <div class="summary-card"><div class="summary-label">資料日期</div><div class="summary-value" style="font-size:16px">${data.updated || '-'}</div><div class="summary-sub">盤後掃描</div></div>
    </div>
    <div class="conditions">${(strat.conditions || []).map(condition => `<span class="cond"><i class="cond-dot"></i>${condition}</span>`).join('')}</div>
    <div class="table-wrap">
      <div class="table-toolbar"><span class="table-title">觀察池</span><div class="toolbar-right"><span class="updated-tag">今日新增 ${newInWatchPool}</span></div></div>
      <div class="pool-kcard-grid">${cards || '<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有貼近頸線的標的</div>'}</div>
    </div>
    <div class="table-wrap" style="margin-top:16px">
      <div class="table-toolbar"><span class="table-title">釘選追蹤</span><div class="toolbar-right"><span class="updated-tag">${data.pinned_tracking.length} 檔</span></div></div>
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text3);line-height:1.7">
        釘選的標的會持續顯示，即使後續狀態變成「已進場」也不會消失，直到你取消釘選。
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>代號 / 名稱</th><th>釘選日</th><th>釘選價</th><th>現價</th><th>損益</th><th>目前狀態</th><th>操作</th></tr></thead>
          <tbody>${trackingRows || `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">目前沒有釘選標的</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  </div>`;
  setTimeout(() => drawNecklineKCharts(rows), 40);
}
