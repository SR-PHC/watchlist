// ═══════════════════════════════════════════════════════════════
//  突破策略：盤整突破 + 動能突破 + 價格突破
// ═══════════════════════════════════════════════════════════════
function renderRightTop(strat, main) {
  const rawData = DATA.right_top_data || [];
  const industryStats = DATA.right_top_industry || [];

  if (rawData.length === 0) {
    main.innerHTML = `
      <div class="strategy-panel active">
        <div class="strat-header">
          <div class="strat-title">${strat.icon} ${strat.name}</div>
          <div class="strat-desc">${strat.description}</div>
        </div>
        <div class="conditions">
          ${strat.conditions.map(c => `<div class="cond"><span class="cond-dot"></span>${c}</div>`).join('')}
        </div>
        <div class="coming-soon" style="padding:48px 20px">
          <div class="coming-icon" style="font-size:28px">▲</div>
          <div class="coming-title">資料尚未生成</div>
          <div class="coming-desc">
            請按頁首「更新資料」觸發 MINI 本機每日掃描，或等待盤後自動排程執行。
          </div>
        </div>
      </div>`;
    return;
  }

  const rtSortCol = window._rtSortCol || 'score';
  const rtSortAsc = window._rtSortAsc !== undefined ? window._rtSortAsc : false;
  const rtView = window._rtView || 'stock';
  const rtFilter = window._rtFilter || 'all';

  function rtCompare(a, b) {
    const va = rtSortCol === 'score'
      ? (a.pattern_score ?? a.score ?? '')
      : (a[rtSortCol] != null ? a[rtSortCol] : '');
    const vb = rtSortCol === 'score'
      ? (b.pattern_score ?? b.score ?? '')
      : (b[rtSortCol] != null ? b[rtSortCol] : '');
    const isDate = /^\d{4}-\d{2}-\d{2}/.test(va) || /^\d{4}-\d{2}-\d{2}/.test(vb);
    const numA = parseFloat(va);
    const numB = parseFloat(vb);
    const cmp = isDate
      ? String(va).localeCompare(String(vb))
      : (!isNaN(numA) && !isNaN(numB))
        ? numA - numB
        : String(va).localeCompare(String(vb));
    return rtSortAsc ? cmp : -cmp;
  }

  function rtSort(col) {
    if (window._rtSortCol === col) window._rtSortAsc = !window._rtSortAsc;
    else { window._rtSortCol = col; window._rtSortAsc = false; }
    renderStrategy();
  }
  window.rtSort = rtSort;

  function setRtView(v) {
    window._rtView = v;
    renderStrategy();
  }
  window.setRtView = setRtView;

  function setRtFilter(v) {
    window._rtFilter = v;
    window._rtSortCol = window._rtSortCol || 'score';
    renderStrategy();
  }
  window.setRtFilter = setRtFilter;

  function sortIcon(col) {
    const isActive = rtSortCol === col;
    return `<span class="sort-icon">${isActive ? (rtSortAsc ? '↑' : '↓') : '·'}</span>`;
  }

  function matchFilter(d) {
    if (rtFilter === 'consolidation') return !!d.is_consolidation_breakout;
    if (rtFilter === 'momentum') return !!d.is_momentum_breakout;
    if (rtFilter === 'price') return !!d.is_price_breakout;
    if (rtFilter === 'dual') return [d.is_consolidation_breakout, d.is_momentum_breakout, d.is_price_breakout].filter(Boolean).length >= 2;
    if (rtFilter === 'whale') return !!d.whale_3w_up || !!d.whale_400_3w_up;
    return true;
  }

  const filtered = rawData.filter(matchFilter);
  const data = filtered.slice().sort(rtCompare);
  const consolidationCount = rawData.filter(d => d.is_consolidation_breakout).length;
  const momentumCount = rawData.filter(d => d.is_momentum_breakout).length;
  const priceCount = rawData.filter(d => d.is_price_breakout).length;
  const dualCount = rawData.filter(d => [d.is_consolidation_breakout, d.is_momentum_breakout, d.is_price_breakout].filter(Boolean).length >= 2).length;
  const whaleCount = rawData.filter(d => d.whale_3w_up || d.whale_400_3w_up).length;
  const topIndustry = industryStats[0];

  function fmtNum(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(digits);
  }

  function fmtPct(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(digits)}%`;
  }

  function fmtLots(v) {
    return v == null || Number.isNaN(Number(v)) ? '—' : Math.round(Number(v)).toLocaleString();
  }

  function entryCloseOf(d) {
    return d.entry_close ?? d.signal_close ?? d.selected_close ?? d.close;
  }

  function latestCloseOf(d) {
    return d.latest_close ?? d.current_price ?? d.close;
  }

  function sinceEntryPctOf(d) {
    if (d.since_entry_pct != null) return d.since_entry_pct;
    const entry = entryCloseOf(d);
    const latest = latestCloseOf(d);
    return entry ? ((latest - entry) / entry * 100) : null;
  }

  function tagBadges(tags) {
    // 語意分組順序：突破類(紅0) / 量能類(橙1) / 籌碼類(琥珀2) / 輔助(灰3)
    const meta = {
      '盤整突破':    { color: '#dc2626', order: 0 },
      '動能突破':    { color: '#dc2626', order: 0 },
      '價格突破':    { color: '#dc2626', order: 0 },
      '雙重符合':    { color: '#dc2626', order: 0 },
      '週量強放大':  { color: '#ea7317', order: 1 },
      '日量強放大':  { color: '#ea7317', order: 1 },
      '量能續航':    { color: '#ea7317', order: 1 },
      '日線啟動':    { color: '#ea7317', order: 1 },
      '60日新高':    { color: '#3b82f6', order: 1 },
      'EMA多頭':     { color: '#0284c7', order: 1 },
      '千張大戶連增':{ color: '#d97706', order: 2 },
      '400張同步':   { color: '#d97706', order: 2 },
      '低乖離':      { color: '#9ca3af', order: 3 },
    };
    return (tags || [])
      .slice()
      .sort((a, b) => (meta[a]?.order ?? 9) - (meta[b]?.order ?? 9))
      .map(t => {
        const c = meta[t]?.color || '#9ca3af';
        return `<span class="tag-badge" style="color:${c};border-color:${c}4d">${t}</span>`;
      }).join('');
  }

  function exportRtCSV() {
    const typeLabels = { consolidation: '盤整突破', momentum: '動能突破', price: '價格突破' };
    const headers = [
      '代號', '名稱', '產業', '市場', '訊號類型', '分數', '舊品質', '標籤',
      '收盤', '週量比', '週漲幅(%)', '10週前高',
      '日量比', '價格量比', 'MA20乖離(%)', 'EMA20乖離(%)', 'MA20', 'MA60', 'EMA20', 'EMA60', 'EMA120', '60日前高',
      '千張大戶連增', '400張同步', '千張3週變化', '400張3週變化', '訊號日'
    ];
    const rows = data.map(d => [
      d.stock_id, d.name, d.industry, d.market,
      (d.signal_types || []).map(t => typeLabels[t] || t).join(' / '),
      d.pattern_score ?? d.score ?? '',
      (d.tags || []).join(' / '),
      d.close ?? '',
      d.vol_ratio ?? '',
      d.change_pct ?? '',
      d.high_10w ?? '',
      d.daily_vol_ratio ?? '',
      d.price_vol_ratio ?? '',
      d.bias_ma20 ?? '',
      d.price_bias_ema20 ?? '',
      d.ma20 ?? '',
      d.ma60 ?? '',
      d.ema20 ?? '',
      d.ema60 ?? '',
      d.ema120 ?? '',
      d.high_60d ?? d.price_high_60d ?? '',
      d.whale_3w_up ? 'Y' : '',
      d.whale_400_3w_up ? 'Y' : '',
      d.big_1000_chg_3w ?? '',
      d.big_400_chg_3w ?? '',
      d.signal_date ?? d.week_date ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `breakout_${strat.dataUpdated}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }
  window.exportRtCSV = exportRtCSV;

  function stockTable() {
    return `
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">突破策略標的池</span>
          <div class="toolbar-right">
            <span class="updated-tag">更新：${strat.dataUpdated}</span>
            <button class="btn-csv" onclick="exportRtCSV()">匯出 CSV</button>
          </div>
        </div>
        <div class="table-scroll">
          <table id="rightTopTable">
            <thead>
              <tr>
                <th onclick="rtSort('stock_id')" style="cursor:pointer">代號 / 名稱${sortIcon('stock_id')}</th>
                <th onclick="rtSort('score')" style="cursor:pointer">分數${sortIcon('score')}</th>
                <th onclick="rtSort('close')" style="cursor:pointer">入選收盤${sortIcon('close')}</th>
                <th onclick="rtSort('close')" style="cursor:pointer">現價${sortIcon('close')}</th>
                <th onclick="rtSort('since_entry_pct')" style="cursor:pointer">績效${sortIcon('since_entry_pct')}</th>
                <th onclick="rtSort('vol_20d_avg')" style="cursor:pointer">20均量${sortIcon('vol_20d_avg')}</th>
                <th onclick="rtSort('change_pct')" style="cursor:pointer">60日漲幅${sortIcon('change_pct')}</th>
                <th onclick="rtSort('big_1000_chg_3w')" style="cursor:pointer">近期 400/1000張${sortIcon('big_1000_chg_3w')}</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(d => {
                const mkt = d.market === 'TPEX' ? 'TPEX' : 'TWSE';
                const tvSymbol = `${mkt}:${d.stock_id}`;
                const emaBias = d.price_bias_ema20 ?? d.bias_ma20;
                const entryClose = entryCloseOf(d);
                const latestClose = latestCloseOf(d);
                const sinceEntryPct = sinceEntryPctOf(d);
                const sinceEntryClass = (sinceEntryPct ?? 0) >= 0 ? 'pos' : 'neg';
                return `<tr>
                  <td>
                    <a href="https://www.tradingview.com/chart/?symbol=${tvSymbol}"
                       onclick="openTV('${tvSymbol}', event)" style="text-decoration:none;display:inline-block">
                      <div class="stock-code" style="display:flex;align-items:center;gap:5px">
                        ${d.stock_id}<span style="font-size:9px;opacity:.45;font-family:var(--mono)">↗</span>
                      </div>
                      <div class="stock-name">${d.name}</div>
                    </a>
                    <div class="stock-industry" style="font-size:10px;color:var(--text3)">${d.industry || d.market || '—'}</div>
                    <div class="holder-signal-tags">${tagBadges(d.tags)}</div>
                  </td>
                  <td>
                    <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--green)">${fmtNum(d.pattern_score ?? d.score, 1)}</span>
                  </td>
                  <td>
                    <span class="price-cell">${fmtNum(entryClose)}</span><br>
                    <span class="mobile-price-date" style="font-size:11px;color:var(--text3)">${d.signal_date || d.week_date || strat.dataUpdated}</span>
                  </td>
                  <td>
                    <span class="price-cell">${fmtNum(latestClose)}</span><br>
                    <span class="mobile-price-date" style="font-size:11px;color:var(--text3)">${strat.priceUpdated || strat.dataUpdated}</span>
                  </td>
                  <td><span class="deviation ${sinceEntryClass}">${fmtPct(sinceEntryPct)}</span></td>
                  <td><span style="font-family:var(--mono);font-size:12px">${fmtLots(d.vol_20d_avg ?? d.price_vol_20d_avg)}</span></td>
                  <td>
                    <span class="deviation ${(emaBias || 0) >= 0 ? 'pos' : 'neg'}" style="font-size:13px">${fmtPct(emaBias)}</span><br>
                    <span class="metric-sub">週 ${fmtPct(d.change_pct)}</span>
                  </td>
                  <td>
                    <div class="holder-trend-cell compact-holder-trend">
                      <div class="holder-trend-grid">
                        <span class="trend-label">千張</span><span>${d.big_pct_1000 != null ? fmtPct(d.big_pct_1000).replace('+', '') : '—'}</span><span class="${(d.big_1000_chg_3w ?? 0) >= 0 ? 'pos' : 'neg'}">${fmtPct(d.big_1000_chg_3w)}</span><span>${d.whale_3w_up ? '連增' : '—'}</span><span>${d.vol_ratio ? fmtNum(d.vol_ratio) + 'x' : '—'}</span>
                        <span class="trend-label">400</span><span>${d.big_pct_400 != null ? fmtPct(d.big_pct_400).replace('+', '') : '—'}</span><span class="${(d.big_400_chg_3w ?? 0) >= 0 ? 'pos' : 'neg'}">${fmtPct(d.big_400_chg_3w)}</span><span>${d.whale_400_3w_up ? '同步' : '—'}</span><span>${d.price_vol_ratio ? fmtNum(d.price_vol_ratio) + 'x' : '—'}</span>
                      </div>
                      <div class="metric-sub">比例 / 3週 / 訊號 / 量比</div>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function industryView() {
    if (industryStats.length === 0) {
      return `<div style="padding:48px 20px;text-align:center;color:var(--text3)">尚無產業統計資料</div>`;
    }
    const maxCount = industryStats[0].count;
    return `
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">產業分布統計</span>
          <div class="toolbar-right"><span class="updated-tag">共 ${industryStats.length} 個產業</span></div>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
          ${industryStats.map((ind, idx) => {
            const barPct = maxCount > 0 ? (ind.count / maxCount * 100).toFixed(1) : 0;
            const rankColor = idx === 0 ? 'var(--green)' : idx === 1 ? 'var(--amber)' : idx === 2 ? 'var(--blue)' : 'var(--text3)';
            return `
              <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:11px;font-weight:700;font-family:var(--mono);color:${rankColor};min-width:24px">#${idx + 1}</span>
                    <span style="font-weight:600;font-size:14px">${ind.industry}</span>
                    <span style="font-size:12px;color:var(--green);font-weight:600">${ind.count} 檔</span>
                  </div>
                </div>
                <div style="background:var(--bg3);border-radius:4px;height:6px;margin-bottom:8px">
                  <div style="background:${rankColor};width:${barPct}%;height:100%;border-radius:4px;transition:width .3s"></div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:4px">
                  ${ind.stocks.map(s => `
                    <span style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;
                                 padding:2px 7px;font-size:11px;font-family:var(--mono);cursor:pointer;color:var(--text2)"
                          onclick="openTV('${s.stock_id}', event)" title="${s.name}">
                      ${s.stock_id} ${s.name}
                    </span>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  main.innerHTML = `
    <div class="strategy-panel active">
      <div class="strat-header">
        <div class="strat-title">${strat.icon} ${strat.name}</div>
        <div class="strat-desc">${strat.description}</div>
      </div>
      <div class="conditions">
        ${strat.conditions.map(c => `<div class="cond"><span class="cond-dot"></span>${c}</div>`).join('')}
      </div>

      <div class="summary-row">
        <div class="summary-card">
          <div class="summary-label">入池標的數</div>
          <div class="summary-value green">${data.length}</div>
          <div class="summary-sub">${rtFilter === 'all' ? `全部 ${rawData.length}` : `篩選 / 全部 ${rawData.length}`}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">平均分數</div>
          <div class="summary-value amber">${fmtNum(data.length ? data.reduce((sum, d) => sum + Number(d.pattern_score ?? d.score ?? 0), 0) / data.length : 0, 1)}</div>
          <div class="summary-sub">型態分數</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">入池後平均漲幅</div>
          ${(() => {
            const avgReturn = data.length ? data.reduce((sum, d) => sum + Number(sinceEntryPctOf(d) ?? 0), 0) / data.length : 0;
            return `<div class="summary-value ${avgReturn >= 0 ? 'green' : 'red'}">${fmtPct(avgReturn)}</div>`;
          })()}
          <div class="summary-sub">現價 vs 入選收盤</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">資料日期</div>
          <div class="summary-value" style="font-size:16px;font-family:var(--mono)">${strat.dataUpdated}</div>
          <div class="summary-sub">突破 ${consolidationCount} / 動能 ${momentumCount} / 價格 ${priceCount}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;padding:0 0 10px 0;flex-wrap:wrap">
        <button class="view-btn ${rtFilter === 'all' ? 'active' : ''}" onclick="setRtFilter('all')">全部</button>
        <button class="view-btn ${rtFilter === 'consolidation' ? 'active' : ''}" onclick="setRtFilter('consolidation')">盤整突破</button>
        <button class="view-btn ${rtFilter === 'momentum' ? 'active' : ''}" onclick="setRtFilter('momentum')">動能突破</button>
        <button class="view-btn ${rtFilter === 'price' ? 'active' : ''}" onclick="setRtFilter('price')">價格突破 ${priceCount}</button>
        <button class="view-btn ${rtFilter === 'dual' ? 'active' : ''}" onclick="setRtFilter('dual')">雙重符合 ${dualCount}</button>
        <button class="view-btn ${rtFilter === 'whale' ? 'active' : ''}" onclick="setRtFilter('whale')">大戶加持</button>
      </div>

      <div style="display:flex;gap:8px;padding:0 0 12px 0">
        <button class="view-btn ${rtView === 'stock' ? 'active' : ''}" onclick="setRtView('stock')">個股列表</button>
        <button class="view-btn ${rtView === 'industry' ? 'active' : ''}" onclick="setRtView('industry')">產業統計</button>
      </div>

      ${rtView === 'stock' ? stockTable() : industryView()}
    </div>`;
}

function _applyPriceToRightTop(priceMap) {
  if (!priceMap || !DATA.right_top_data) return;
  DATA.right_top_data.forEach(item => {
    const p = priceMap[item.stock_id];
    const close = typeof p === 'number' ? p : p?.close;
    if (close == null) return;
    if (item.entry_close == null) item.entry_close = item.close;
    item.latest_close = close;
    item.close = close;
    if (item.entry_close) {
      item.since_entry_pct = parseFloat(
        ((item.latest_close - item.entry_close) / item.entry_close * 100).toFixed(2)
      );
    }
  });
}
