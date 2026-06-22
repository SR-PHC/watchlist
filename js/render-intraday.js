// ── 盤中預選 ──────────────────────────────────────────────────

function _intradayData() {
  if (!DATA.intraday_candidates_data) {
    DATA.intraday_candidates_data = {
      updated: '',
      date: '',
      summary: { universe: 0, total: 0, focus: 0 },
      focus_results: [],
      results: [],
    };
  }
  return DATA.intraday_candidates_data;
}

function _intradaySourceLabel(row) {
  const labels = {
    chips: '低基期',
    big_holder_trend: '趨勢',
    volume_signal: '量增',
    right_top: '突破',
  };
  return (row.sources || []).map(src => labels[src] || src).join(' / ') || '策略候選';
}

function _intradayStateColor(state) {
  if (state === '值得看圖') return 'var(--green)';
  if (state === '太遠不追') return 'var(--amber)';
  if (state === '型態破壞') return '#dc2626';
  return 'var(--text2)';
}

function _intradayRows() {
  const data = _intradayData();
  return (data.focus_results || []).length ? data.focus_results : [];
}

async function addIntradayToWatchlist(stockId) {
  const data = _intradayData();
  const row = (data.focus_results || data.results || [])
    .find(item => String(item.stock_id) === String(stockId));
  if (!row) {
    alert('找不到盤中預選資料');
    return;
  }

  const wl = _watchlistData();
  if ((wl.active || []).some(item => String(item.stock_id) === String(stockId))) {
    alert('這檔已經在自選清單中');
    return;
  }

  const m = row.metrics || {};
  const intraday = row.intraday || {};
  const addedDate = dateTW();
  const entryPrice = _watchlistEntryClose(row.stock_id, addedDate) ?? row.entry_price ?? row.entry_close ?? row.selected_close ?? null;
  const currentPrice = row.current_price ?? row.close ?? intraday.close ?? entryPrice;
  const added = {
    id: `${row.stock_id}-${Date.now()}`,
    stock_id: row.stock_id,
    name: row.name || '',
    industry: row.industry || '',
    market: row.market || '',
    source_strategy: `盤中預選 / ${_intradaySourceLabel(row)}`,
    sources: row.sources || [],
    added_date: addedDate,
    expire_date: addTradingDaysTW(10),
    entry_price: entryPrice ?? currentPrice,
    current_price: currentPrice,
    pnl_pct: entryPrice ? parseFloat(((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)) : 0,
    pattern_score: row.pattern_score ?? null,
    pattern_state: row.pattern_state || '',
    pattern_tags: row.pattern_tags || [],
    patterns: row.patterns || [],
    key_level: row.key_level ?? null,
    invalidation: row.invalidation ?? null,
    vol_20d_avg: m.vol_20d_avg ?? intraday.vol_20d_avg ?? null,
    pinned: false,
    status: '觀察中',
    note: `盤中預選 ${String(data.updated || data.date || '').slice(0, 16)}`,
  };

  wl.active.push(added);
  wl.last_updated = dateTW();
  const ok = await miniWriteJson(MINI_WATCHLIST, wl, `watchlist: add intraday ${row.stock_id}`);
  if (ok) {
    alert(`${row.stock_id} 已加入自選`);
    renderStrategy();
  } else {
    wl.active.pop();
  }
}

async function triggerIntradayPreselectUpdate(btn) {
  const orig = btn.textContent;
  const previousUpdated = (DATA.intraday_candidates_data?.updated || DATA.intraday_candidates_data?.date || '');
  btn.disabled = true;
  try {
    btn.textContent = '啟動MINI盤中掃描...';
    await triggerMiniLocalAction('/intraday-preselect');

    for (let elapsed = 0; elapsed < 540; elapsed += 5) {
      btn.textContent = `盤中掃描中... ${elapsed + 5}s`;
      await new Promise(resolve => setTimeout(resolve, 5000));
      const stamp = Date.now();
      const intradayRes = await fetch(`data/intraday_candidates.json?t=${stamp}`, { cache: 'no-store' });
      if (!intradayRes.ok) continue;
      DATA.intraday_candidates_data = await intradayRes.json();
      JSON_CACHE.set('intraday', DATA.intraday_candidates_data);
      const updatedNow = DATA.intraday_candidates_data.updated || DATA.intraday_candidates_data.date || '';
      if (updatedNow && updatedNow !== previousUpdated) break;
    }
    if (!DATA.intraday_candidates_data) throw new Error('無法讀取 intraday_candidates.json');

    const stamp = Date.now();
    const pRes = await fetch(`data/current_prices.json?t=${stamp}`, { cache: 'no-store' });
    if (pRes.ok) {
      const pData = await pRes.json();
      JSON_CACHE.set('currentPrices', pData);
      const priceMap = pData.prices || {};
      _applyPriceToChips(priceMap);
      _applyPriceToVolumeSignal(priceMap);
      _applyPriceToRightTop(priceMap);
      _applyPriceToBigHolderTrend(priceMap);
      _applyPriceToRttTrack(priceMap);
      _applyPriceToBhtTrack(priceMap);
      _applyPriceToAnalysis(priceMap);
      _applyPriceToWatchlist(priceMap);
      await _applyPriceToPerf(priceMap, pData.date || dateTW(), false);
    }

    const kRes = await fetch(`data/shioaji_kbars.json?t=${stamp}`, { cache: 'no-store' });
    if (kRes.ok) {
      DATA.stock_kbars_data = await kRes.json();
      JSON_CACHE.set('kbars', DATA.stock_kbars_data);
    }

    renderNav();
    renderStrategy();
    const updated = (DATA.intraday_candidates_data.updated || DATA.intraday_candidates_data.date || '').slice(0, 16) || dateTW();
    btn.textContent = `已更新 ${updated}`;
    btn.disabled = false;
    setTimeout(() => { btn.textContent = orig; }, 4000);
  } catch (e) {
    const localHint = e instanceof TypeError ? '本機 MINI bridge 未啟動' : e.message;
    alert('更新盤中預選失敗：' + localHint);
    btn.disabled = false;
    btn.textContent = orig;
  }
}

function setIntradayKPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-intraday-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const rows = DATA.stock_kbars_data?.stocks?.[stockId]?.daily || [];
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(rows, period), `intraday-${stockId}`, null);
}

function drawIntradayKCharts(rows) {
  rows.forEach(row => {
    const card = document.querySelector(`.pool-kcard[data-intraday-id="${row.stock_id}"]`);
    if (!card) return;
    const period = card.dataset.period || 'day';
    const bars = DATA.stock_kbars_data?.stocks?.[row.stock_id]?.daily || [];
    drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), `intraday-${row.stock_id}`, null);
  });
}

function renderIntradayCandidates(strat, main) {
  const data = _intradayData();
  const rows = _intradayRows();
  const allRows = data.results || [];
  const updated = (data.updated || data.date || '').slice(0, 16) || '-';
  const summary = data.summary || {};

  function fmtNum(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(digits);
  }

  function fmtPct(v, digits = 1) {
    if (v == null || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
  }

  function fmtProgress(v) {
    if (v == null || Number.isNaN(Number(v))) return '-';
    return `${(Number(v) * 100).toFixed(0)}%`;
  }

  const cards = rows.map(row => {
    const intraday = row.intraday || {};
    const patState = row.pattern_state || '先觀察';
    const patScore = row.pattern_score ?? 0;
    const stateColor = _intradayStateColor(patState);
    const tags = [...(row.pattern_tags || []), _intradaySourceLabel(row)].filter(Boolean).slice(0, 5);
    const inWatchlist = (DATA.watchlist_data?.active || []).some(item => String(item.stock_id) === String(row.stock_id));

    return `<article class="pool-kcard" data-intraday-id="${row.stock_id}">
      <div class="pool-kcard-top">
        <div>
          <div class="pool-kcard-id">
            <span class="stock-code">${row.stock_id}</span>
            <span class="stock-name">${row.name || '-'}</span>
          </div>
          <div class="stock-industry">${row.industry || '-'}</div>
        </div>
        <div class="pool-kcard-score">
          <span>現價</span>
          <strong>${fmtNum(row.close ?? intraday.close, 2)}</strong>
          <em>(${fmtNum(patScore, 1)})</em>
        </div>
      </div>
      <div class="pool-kcard-tags">
        <span class="tag-badge" style="color:var(--amber);border-color:var(--border)">盤中暫定</span>
        <span class="tag-badge" style="color:${stateColor};border-color:var(--border)">${patState}</span>
        ${tags.map(tag => `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${tag}</span>`).join('')}
      </div>
      <div class="pool-kchart-wrap">
        <canvas data-intraday-kchart="${row.stock_id}"></canvas>
        <div class="pool-kchart-empty" data-empty="intraday-${row.stock_id}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setIntradayKPeriod('${row.stock_id}', 'day')">日</button>
          <button onclick="setIntradayKPeriod('${row.stock_id}', 'week')">週</button>
          <button onclick="setIntradayKPeriod('${row.stock_id}', 'month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>盤中量</span><strong>${intraday.volume_lots != null ? Math.round(intraday.volume_lots).toLocaleString() : '-'}</strong></div>
        <div><span>量/20均</span><strong>${fmtProgress(intraday.volume_progress)}</strong></div>
        <div><span>漲跌</span><strong class="${Number(intraday.change_rate || 0) >= 0 ? 'pos' : 'neg'}">${fmtPct(intraday.change_rate)}</strong></div>
        <div><span>來源</span><strong>${_intradaySourceLabel(row)}</strong></div>
      </div>
      <div class="pool-kcard-actions">
        <button class="perf-btn perf-btn-add" onclick="addIntradayToWatchlist('${row.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已在自選' : '加入自選'}</button>
      </div>
    </article>`;
  }).join('');

  const tableRows = rows.map(row => {
    const intraday = row.intraday || {};
    const stateColor = _intradayStateColor(row.pattern_state || '');
    const inWatchlist = (DATA.watchlist_data?.active || []).some(item => String(item.stock_id) === String(row.stock_id));
    return `<tr>
      <td>
        <div class="stock-code">${row.stock_id}</div>
        <div class="stock-name">${row.name || '-'}</div>
        <div class="stock-industry" style="font-size:10px;color:var(--text3)">${row.industry || '-'}</div>
      </td>
      <td><span class="tag-badge" style="color:${stateColor};border-color:var(--border)">${row.pattern_state || '-'}</span></td>
      <td><span style="font-family:var(--mono);font-weight:700;color:${stateColor}">${fmtNum(row.pattern_score, 1)}</span></td>
      <td style="font-family:var(--mono);white-space:nowrap">
        ${fmtNum(row.close ?? intraday.close, 2)}
        <br><span style="color:var(--text3);font-size:11px">${fmtPct(intraday.change_rate)}</span>
      </td>
      <td style="font-family:var(--mono);white-space:nowrap">
        ${intraday.volume_lots != null ? Math.round(intraday.volume_lots).toLocaleString() : '-'}
        <br><span style="color:var(--text3);font-size:11px">${fmtProgress(intraday.volume_progress)}</span>
      </td>
      <td>${_intradaySourceLabel(row)}</td>
      <td><button class="perf-btn perf-btn-add sidebar-mini-btn" onclick="addIntradayToWatchlist('${row.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已加入' : '加入自選'}</button></td>
    </tr>`;
  }).join('');

  main.innerHTML = `
    <div class="strategy-panel active">
      <div class="strat-header">
        <div class="strat-title">${strat.icon} ${strat.name}</div>
        <div class="strat-desc">${strat.description}</div>
      </div>

      <div class="summary-row">
        <div class="summary-card">
          <div class="summary-label">盤中預選</div>
          <div class="summary-value green">${rows.length}</div>
          <div class="summary-sub">值得看圖</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">掃描宇宙</div>
          <div class="summary-value blue">${summary.universe ?? data.requested ?? 0}</div>
          <div class="summary-sub">既有策略候選</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">完成分析</div>
          <div class="summary-value amber">${summary.total ?? allRows.length}</div>
          <div class="summary-sub">Shioaji snapshot</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">更新</div>
          <div class="summary-value" style="font-size:18px">${updated}</div>
          <div class="summary-sub">每次執行覆蓋</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">盤中預選 K 棒</span>
          <div class="toolbar-right">
            <span class="updated-tag">非正式盤後結果</span>
            <span class="updated-tag">未加入自選者下次覆蓋</span>
            <button class="btn-csv" onclick="triggerIntradayPreselectUpdate(this)">更新盤中預選</button>
          </div>
        </div>
        <div class="pool-kcard-grid">
          ${cards || `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有盤中預選。盤中可按「更新盤中預選」由 MINI 本機掃描產生。</div>`}
        </div>
        <div class="table-scroll ${rows.length > 10 ? 'table-vscroll' : ''}">
          <table>
            <thead>
              <tr>
                <th>代號 / 名稱</th>
                <th>型態狀態</th>
                <th>型態分</th>
                <th>現價</th>
                <th>盤中量</th>
                <th>來源</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${tableRows || `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:28px">目前沒有盤中預選。</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  setTimeout(() => drawIntradayKCharts(rows), 40);
}
