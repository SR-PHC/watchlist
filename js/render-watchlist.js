const MINI_WATCHLIST = 'data/watchlist.json';

function _watchlistData() {
  if (!DATA.watchlist_data) DATA.watchlist_data = { last_updated: '', active: [], expired: [] };
  if (!Array.isArray(DATA.watchlist_data.active)) DATA.watchlist_data.active = [];
  if (!Array.isArray(DATA.watchlist_data.expired)) DATA.watchlist_data.expired = [];
  return DATA.watchlist_data;
}

function _watchlistSourceLabel(row) {
  const labels = {
    chips: '低基期',
    big_holder_trend: '趨勢',
    volume_signal: '量增',
    right_top: '突破',
    neckline_retest: '頸線回測',
  };
  return (row.sources || []).map(src => labels[src] || src).join(' / ') || '工作檯';
}

function _watchlistDaysRemaining(row) {
  if (row.pinned) return null;
  if (!row.expire_date) return row.days_remaining ?? null;
  const today = new Date(dateTW());
  const expire = new Date(row.expire_date);
  let days = 0;
  const d = new Date(today);
  while (d <= expire) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) days += 1;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(0, days);
}

function _watchlistEntryClose(stockId, beforeDate = dateTW()) {
  const daily = DATA.stock_kbars_data?.stocks?.[String(stockId)]?.daily || [];
  const rows = daily
    .filter(bar => String(bar.date || '').slice(0, 10) < beforeDate && bar.close != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = rows[rows.length - 1];
  return last ? Number(last.close) : null;
}

async function addStockPoolToWatchlist(stockId) {
  const row = (DATA.momentum_candidates_data?.focus_results || [])
    .find(item => String(item.stock_id) === String(stockId));
  if (!row) {
    alert('找不到工作檯資料');
    return;
  }

  const wl = _watchlistData();
  if ((wl.active || []).some(item => String(item.stock_id) === String(stockId))) {
    alert('這檔已經在自選清單中');
    return;
  }

  const m = row.metrics || {};
  const addedDate = dateTW();
  const entryPrice = _watchlistEntryClose(row.stock_id, addedDate) ?? row.entry_price ?? row.entry_close ?? row.selected_close ?? row.close ?? null;
  const currentPrice = row.current_price ?? row.close ?? entryPrice;
  const added = {
    id: `${row.stock_id}-${Date.now()}`,
    stock_id: row.stock_id,
    name: row.name || '',
    industry: row.industry || '',
    market: row.market || '',
    source_strategy: _watchlistSourceLabel(row),
    sources: row.sources || [],
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice,
    current_price: currentPrice,
    pnl_pct: entryPrice ? parseFloat(((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)) : 0,
    pattern_score: row.pattern_score ?? null,
    pattern_state: row.pattern_state || '',
    pattern_tags: row.pattern_tags || [],
    patterns: row.patterns || [],
    key_level: row.key_level ?? null,
    invalidation: row.invalidation ?? null,
    vol_20d_avg: m.vol_20d_avg ?? null,
    pinned: false,
    status: '觀察中',
    note: '',
  };

  wl.active.push(added);
  wl.last_updated = dateTW();
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add ${row.stock_id}`);
  if (ok) {
    alert(`${row.stock_id} 已加入自選`);
    renderStrategy();
  } else {
    wl.active.pop();
  }
}

async function addDailyEntryToWatchlist(stockId) {
  const analysis = DATA.daily_entry_analysis_data || {};
  const row = (analysis.candidates || [])
    .find(item => String(item.stock_id) === String(stockId));
  if (!row) {
    alert('找不到每日建倉分析資料');
    return;
  }

  const wl = _watchlistData();
  if ((wl.active || []).some(item => String(item.stock_id) === String(stockId))) {
    alert('這檔已經在自選清單中');
    return;
  }

  const addedDate = dateTW();
  const entryPrice = _watchlistEntryClose(row.stock_id, addedDate)
    ?? row.close
    ?? row.reference_entry?.low
    ?? null;
  const currentPrice = row.close ?? entryPrice;
  const sourceStrategies = row.source_strategies || [];
  const added = {
    id: `${row.stock_id}-${Date.now()}`,
    stock_id: row.stock_id,
    name: row.name || '',
    industry: row.industry || '',
    market: row.market || '',
    source_strategy: `每日建倉分析 / ${sourceStrategies.join(' / ') || '人工候選'}`,
    sources: sourceStrategies,
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice,
    current_price: currentPrice,
    pnl_pct: entryPrice ? parseFloat(((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)) : 0,
    pattern_score: row.pattern_score ?? null,
    pattern_state: row.pattern_type || '',
    pattern_tags: [row.pattern_type, ...sourceStrategies].filter(Boolean),
    patterns: [],
    key_level: row.reference_entry?.low ?? null,
    invalidation: row.structural_stop?.price ?? null,
    vol_20d_avg: null,
    pinned: false,
    status: '觀察中',
    note: `每日建倉分析 ${analysis.analysis_date || addedDate}`,
  };

  wl.active.push(added);
  wl.last_updated = dateTW();
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add daily entry ${row.stock_id}`);
  if (ok) {
    alert(`${row.stock_id} 已加入自選`);
    renderStrategy();
  } else {
    wl.active.pop();
  }
}

async function watchlistTogglePin(id) {
  const wl = _watchlistData();
  const row = wl.active.find(item => item.id === id);
  if (!row) return;
  row.pinned = !row.pinned;
  wl.last_updated = dateTW();
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: ${row.pinned ? 'pin' : 'unpin'} ${row.stock_id}`);
  if (ok) renderStrategy(); else row.pinned = !row.pinned;
}

async function watchlistRemove(id) {
  const wl = _watchlistData();
  const idx = wl.active.findIndex(item => item.id === id);
  if (idx === -1) return;
  const row = wl.active[idx];
  if (!confirm(`將 ${row.stock_id} 移出自選？`)) return;
  const [removed] = wl.active.splice(idx, 1);
  removed.removed_date = dateTW();
  removed.status = '已移除';
  wl.expired.unshift(removed);
  wl.last_updated = dateTW();
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: remove ${row.stock_id}`);
  if (ok) renderStrategy();
  else {
    wl.expired.shift();
    wl.active.splice(idx, 0, removed);
  }
}

function renderWatchlist(strat, main) {
  const wl = _watchlistData();
  const activeRows = wl.active || [];
  const expiredRows = wl.expired || [];
  const pinnedCount = activeRows.filter(row => row.pinned).length;
  const expiringCount = activeRows.filter(row => !row.pinned && Number(_watchlistDaysRemaining(row) ?? 99) <= 3).length;
  const avgPnl = activeRows.length
    ? activeRows.reduce((sum, row) => sum + Number(row.pnl_pct || 0), 0) / activeRows.length
    : 0;
  const currentPriceDate = DATA.current_prices_data?.date || wl.last_updated || '-';

  function fmtNum(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(digits);
  }

  function fmtPct(v, digits = 1) {
    if (v == null || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
  }

  function daysLabel(row) {
    if (row.pinned) return '<span class="tag-badge" style="color:var(--green);border-color:var(--green-glow)">釘選</span>';
    const days = _watchlistDaysRemaining(row);
    if (days == null) return '-';
    const color = days <= 3 ? 'var(--amber)' : 'var(--text2)';
    return `<span style="font-family:var(--mono);font-weight:700;color:${color}">${days}</span>`;
  }

  const cards = [...activeRows]
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      return String(b.added_date || '').localeCompare(String(a.added_date || ''));
    })
    .map(row => {
      const pnl = Number(row.pnl_pct || 0);
      const tags = (row.pattern_tags || []).slice(0, 5);
      const themeLabels = candidateThemeLabels(row.stock_id);
      const roleLabels = candidateThemeRoleLabels(row.stock_id);
      return `<article class="pool-kcard" data-watch-id="${row.id}">
        <div class="pool-kcard-top">
          <div>
            <div class="pool-kcard-id">
              <span class="stock-code">${row.stock_id}</span>
              <span class="stock-name">${row.name || '-'}</span>
            </div>
            <div class="stock-industry">${row.industry || '-'}</div>
            ${renderCandidateThemeBadges(row.stock_id)}
          </div>
          <div class="pool-kcard-score">
            <span>現價</span>
            <strong>${fmtNum(row.current_price ?? row.entry_price, 2)}</strong>
            <em>${row.added_date || ''}</em>
          </div>
        </div>
        <div class="pool-kcard-tags">
          <span class="tag-badge" style="color:var(--green);border-color:var(--border)">自選 ${row.added_date || '-'}</span>
          <span class="tag-badge" style="color:var(--blue);border-color:var(--border)">${row.source_strategy || '工作檯'}</span>
          <span class="tag-badge" style="color:${pnl >= 0 ? 'var(--market-up)' : 'var(--market-down)'};border-color:var(--border)">${fmtPct(pnl, 1)}</span>
          ${tags.map(tag => `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${tag}</span>`).join('')}
        </div>
        <div class="pool-kchart-wrap">
          <canvas data-watch-kchart="${row.id}"></canvas>
          <div class="pool-kchart-empty" data-empty="wl-${row.id}">尚未更新 K 棒</div>
          <div class="pool-period-switch">
            <button class="active" onclick="setWatchlistKPeriod('${row.id}', '${row.stock_id}', 'day')">日</button>
            <button onclick="setWatchlistKPeriod('${row.id}', '${row.stock_id}', 'week')">週</button>
            <button onclick="setWatchlistKPeriod('${row.id}', '${row.stock_id}', 'month')">月</button>
          </div>
        </div>
        <div class="pool-kcard-detail">
          <div><span>加入日</span><strong>${row.added_date || '-'}</strong></div>
          <div><span>剩餘日</span><strong>${row.pinned ? '釘選' : (_watchlistDaysRemaining(row) ?? '-')}</strong></div>
          <div><span>關鍵價</span><strong>${fmtNum(row.key_level, 2)}</strong></div>
          <div><span>失效價</span><strong class="neg">${fmtNum(row.invalidation, 2)}</strong></div>
          <div><span>題材</span><strong>${themeLabels.join(' / ') || '-'}</strong></div>
          <div><span>角色</span><strong>${roleLabels.join(' / ') || '-'}</strong></div>
        </div>
        <div class="pool-kcard-actions">
          <button class="perf-btn sidebar-mini-btn" onclick="watchlistTogglePin('${row.id}')">${row.pinned ? '取消釘選' : '釘選'}</button>
          <button class="perf-btn perf-btn-del sidebar-mini-btn" onclick="watchlistRemove('${row.id}')">移除</button>
        </div>
      </article>`;
    }).join('');

  const rows = [...activeRows]
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      return String(b.added_date || '').localeCompare(String(a.added_date || ''));
    })
    .map(row => {
      const pnl = Number(row.pnl_pct || 0);
      const tags = (row.pattern_tags || []).slice(0, 4);
      const themeLabels = candidateThemeLabels(row.stock_id, 3);
      return `<tr>
        <td>
          <div class="stock-code">${row.stock_id}</div>
          <div class="stock-name">${row.name || '-'}</div>
          <div class="stock-industry" style="font-size:10px;color:var(--text3)">${row.industry || '-'}</div>
          <div class="stock-industry" style="font-size:10px;color:var(--text2)">${themeLabels.join(' / ') || '-'}</div>
        </td>
        <td><span class="priority-badge blue">${row.source_strategy || '工作檯'}</span></td>
        <td style="font-family:var(--mono);white-space:nowrap">${row.added_date || '-'}</td>
        <td>${row.pattern_state || row.status || '-'}</td>
        <td style="font-family:var(--mono);white-space:nowrap">${fmtNum(row.entry_price, 2)}<span class="watchlist-mobile-date">${row.added_date || '-'}</span></td>
        <td style="font-family:var(--mono);white-space:nowrap">${fmtNum(row.current_price, 2)}<span class="watchlist-mobile-date">${currentPriceDate}</span></td>
        <td><span class="${pnl >= 0 ? 'pos' : 'neg'}" style="font-family:var(--mono);font-weight:700">${fmtPct(pnl, 1)}</span></td>
        <td>${daysLabel(row)}</td>
        <td style="max-width:210px;line-height:1.55">
          ${(row.pattern_state || row.status) ? `<span class="tag-badge" style="color:var(--text2);border-color:var(--border)">${row.pattern_state || row.status}</span>` : ''}
          ${tags.map(tag => `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${tag}</span>`).join('')}
        </td>
        <td style="white-space:nowrap">
          <button class="perf-btn sidebar-mini-btn" onclick="watchlistTogglePin('${row.id}')">${row.pinned ? '取消釘選' : '釘選'}</button>
          <button class="perf-btn perf-btn-del sidebar-mini-btn" onclick="watchlistRemove('${row.id}')">移除</button>
        </td>
      </tr>`;
    }).join('');

  main.innerHTML = `
    <div class="strategy-panel active">
      <div class="strat-header">
        <div class="strat-title">${strat.icon} ${strat.name}</div>
        <div class="strat-desc">從工作檯或策略來源人工加入；預設觀察 10 個交易日，釘選標的不自動剔除，多重來源只保留一筆。</div>
      </div>

      <div class="summary-row">
        <div class="summary-card">
          <div class="summary-label">觀察中</div>
          <div class="summary-value green">${activeRows.length}</div>
          <div class="summary-sub">人工加入</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">釘選</div>
          <div class="summary-value blue">${pinnedCount}</div>
          <div class="summary-sub">不自動剔除</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">即將剔除</div>
          <div class="summary-value amber">${expiringCount}</div>
          <div class="summary-sub">剩 3 個交易日內</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">平均損益</div>
          <div class="summary-value ${avgPnl >= 0 ? 'green' : 'amber'}">${fmtPct(avgPnl, 1)}</div>
          <div class="summary-sub">觀察中標的</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">自選 K 線</span>
          <div class="toolbar-right">
            <span class="updated-tag">K棒 ${(DATA.stock_kbars_data?.updated || DATA.stock_kbars_data?.date || '').slice(0, 16) || '-'}</span>
          </div>
        </div>
        <div class="pool-kcard-grid">
          ${cards || `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有自選標的。</div>`}
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">自選清單</span>
          <div class="toolbar-right">
            <span class="updated-tag">歷史 ${expiredRows.length}</span>
            <span class="updated-tag">更新 ${(wl.last_updated || '').slice(0, 10) || '-'}</span>
          </div>
        </div>
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text3);line-height:1.7">
          自選統一收納你從「工作檯」或策略來源人工加入的股票；同一股票若同時符合多個來源，只保留一筆並合併來源快照。
        </div>
        <div class="table-scroll ${activeRows.length > 10 ? 'table-vscroll' : ''}">
          <table id="watchlistTable">
            <thead>
              <tr>
                <th>代號 / 名稱</th>
                <th>來源</th>
                <th>加入日</th>
                <th>狀態</th>
                <th>入選收盤</th>
                <th>現價</th>
                <th>績效</th>
                <th>剩餘日</th>
                <th>狀態 / 標籤</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:28px">目前沒有自選標的，請先從工作檯或策略來源加入。</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  setTimeout(() => drawWatchlistKCharts(activeRows), 40);
}

function setWatchlistKPeriod(rowId, stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-watch-id="${rowId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const item = (DATA.watchlist_data?.active || []).find(row => row.id === rowId);
  const rows = DATA.stock_kbars_data?.stocks?.[stockId]?.daily
    || DATA.neckline_kbars_data?.stocks?.[stockId]?.daily
    || [];
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(rows, period), `wl-${rowId}`, item?.added_date || null);
}

function drawWatchlistKCharts(rows) {
  rows.forEach(row => {
    const card = document.querySelector(`.pool-kcard[data-watch-id="${row.id}"]`);
    if (!card) return;
    const period = card.dataset.period || 'day';
    const bars = DATA.stock_kbars_data?.stocks?.[row.stock_id]?.daily
      || DATA.neckline_kbars_data?.stocks?.[row.stock_id]?.daily
      || [];
    drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), `wl-${row.id}`, row.added_date || null);
  });
}
