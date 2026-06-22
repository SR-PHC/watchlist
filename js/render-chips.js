// ════════════════════════════════════════════════════
//  族群柱狀圖 TOP 6（按入選數量，同數量以平均增幅排序）
// ════════════════════════════════════════════════════
function renderIndustryChart(allData) {
  const groups = {};
  allData.forEach(d => {
    const ind = d.industry || '其他';
    if (!groups[ind]) groups[ind] = [];
    groups[ind].push(d);
  });
  const top6 = Object.entries(groups)
    .map(([name, items]) => ({
      name,
      count: items.length,
      avg: items.reduce((s, d) => s + (d.cumulative_3w || 0), 0) / items.length
    }))
    .sort((a, b) => b.count !== a.count ? b.count - a.count : b.avg - a.avg)
    .slice(0, 6);
  if (!top6.length) return '';
  const maxCount = top6[0].count;
  const bars = top6.map(g => {
    const pct = (g.count / maxCount * 100).toFixed(1);
    const avgSign = g.avg >= 0 ? '+' : '';
    return `<div class="ind-bar-row">
      <div class="ind-bar-label" title="${g.name}">${g.name}</div>
      <div class="ind-bar-track">
        <div class="ind-bar-fill" style="width:${pct}%">
          <span class="ind-bar-count">${g.count} 支</span>
        </div>
      </div>
      <div class="ind-bar-avg">${avgSign}${g.avg.toFixed(2)}%</div>
    </div>`;
  }).join('');
  return `<div class="industry-chart">
    <div class="industry-chart-hd">族群分布 TOP 6　<span style="font-weight:400;color:var(--text3)">依入選數量 / 同數量以平均3週增幅排序</span></div>
    ${bars}
  </div>`;
}

// ════════════════════════════════════════════════════
//  籌碼集中：渲染器
// ════════════════════════════════════════════════════
function renderChipsHolder(strat, main) {
  const allData = DATA.chips_big_holder_data || [];

  if (allData.length === 0) {
    main.innerHTML = `<div class="coming-soon">
      <div class="coming-icon">${strat.icon}</div>
      <div class="coming-title">${strat.name}</div>
      <div class="coming-desc">資料尚未產生，請確認 MINI 本機大戶持股分析排程已執行，或手動執行 <b>scripts/launch_holdings_scan.sh</b>。</div>
    </div>`;
    return;
  }

  // 排序（個股模式）
  function combined3w(d) { return (d.cumulative_3w || 0) + (d.cumulative_3w_400 || 0); }
  function fmtNum(v, digits = 2) { return v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(digits); }
  function fmtPct(v) { return v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`; }
  function fmtLots(v) { return v == null || Number.isNaN(Number(v)) ? '—' : Math.round(Number(v)).toLocaleString(); }
  function entryCloseOf(d) { return d.entry_close ?? d.signal_close ?? d.selected_close ?? d.close; }
  function latestCloseOf(d) { return d.latest_close ?? d.current_price ?? d.close; }
  function sinceEntryPctOf(d) {
    if (d.since_entry_pct != null) return d.since_entry_pct;
    const entry = entryCloseOf(d);
    const latest = latestCloseOf(d);
    return entry ? ((latest - entry) / entry * 100) : null;
  }
  function latestWeekChange(d, type) {
    const key = type === '400' ? 'chg_1w_400' : 'chg_1w_1000';
    const trend = type === '400' ? d.big_trend_400 : d.big_trend_1000;
    if (d[key] != null) return d[key];
    return Array.isArray(trend) && trend.length >= 2
      ? +(trend[trend.length - 1] - trend[trend.length - 2]).toFixed(2)
      : null;
  }
  function sortValue(d, col) {
    if (col === 'score') return d.pattern_score ?? d.score ?? 0;
    if (col === 'chg_1w_1000') return latestWeekChange(d, '1000');
    if (col === 'chg_1w_400') return latestWeekChange(d, '400');
    return d[col];
  }

  const sortedData = allData.slice().sort((a, b) => {
    const va = sortValue(a, sortCol) ?? -9999;
    const vb = sortValue(b, sortCol) ?? -9999;
    return sortAsc ? va - vb : vb - va;
  });

  // 族群模式：按族群平均三周累積增幅分組
  function buildIndustryGroups(data) {
    const groups = {};
    data.forEach(d => {
      const ind = d.industry || '其他';
      if (!groups[ind]) groups[ind] = [];
      groups[ind].push(d);
    });
    return Object.entries(groups).map(([name, items]) => {
      const avg = items.reduce((s, d) => s + combined3w(d), 0) / items.length;
      items.sort((a, b) => combined3w(b) - combined3w(a));
      return { name, items, avg: Math.round(avg * 100) / 100 };
    }).sort((a, b) => b.avg - a.avg);
  }

  const tagStyle = {
    '持續成長': 'color:#3a86ff;border-color:rgba(58,134,255,0.5)',
    '雙軌觸發': 'color:#e66e29;border-color:rgba(230,110,41,0.5)',
    '單周增幅': 'color:#e63946;border-color:rgba(230,57,70,0.5)',
  };

  function tagBadges(tags) {
    if (!tags || !tags.length) return '';
    return tags.map(t => {
      const style = tagStyle[t] || 'color:#888;border-color:rgba(136,136,136,0.4)';
      return `<span class="tag-badge" style="${style}">${t}</span>`;
    }).join('');
  }

  function consecutiveBadge(weeks) {
    if (!weeks || weeks < 2) return '';
    return `<span class="tag-badge" style="color:var(--amber);border-color:rgba(240,136,62,0.5);font-size:11px;font-weight:600">連續${weeks}週</span>`;
  }

  function chipsRow(d) {
    const devSign  = d.deviation >= 0 ? '+' : '';
    const weekSign = (d.week_chg_pct >= 0) ? '+' : '';
    const weekClass = d.week_chg_pct >= 0 ? 'pos' : 'neg';
    const devClass  = d.deviation  >= 0 ? 'pos' : 'neg';
    const chg1w1000 = latestWeekChange(d, '1000');
    const chg1w400 = latestWeekChange(d, '400');
    const entryClose = entryCloseOf(d);
    const latestClose = latestCloseOf(d);
    const sinceEntryPct = sinceEntryPctOf(d);
    const sinceEntryClass = (sinceEntryPct ?? 0) >= 0 ? 'pos' : 'neg';
    return `
      <tr onclick="toggleExpand('${d.stock_id}')" id="row-${d.stock_id}">
        <td>
          <a href="https://www.tradingview.com/chart/?symbol=${getTVSymbol(d)}"
            onclick="openTV('${getTVSymbol(d)}', event)"
            style="text-decoration:none;display:inline-block">
            <div class="stock-code" style="display:flex;align-items:center;gap:5px">
              ${d.stock_id}<span style="font-size:9px;opacity:.45;font-family:var(--mono)">↗</span>
            </div>
          <div class="stock-name">${d.name}</div>
        </a>
        <div class="stock-industry">${d.industry || ''}</div>
        <div class="holder-signal-tags">${tagBadges(d.tags)}</div>
        ${consecutiveBadge(d.consecutive_weeks)}
      </td>
        <td>
          <span style="font-family:var(--mono);font-weight:700;color:var(--green)">${d.pattern_score != null ? d.pattern_score.toFixed(1) : (d.score != null ? d.score.toFixed(1) : '—')}</span>
        </td>
        <td>
          <span class="price-cell">${fmtNum(entryClose, 1)}</span><br>
          <span class="mobile-price-date" style="font-size:11px;color:var(--text3)">${strat.dataUpdated}</span>
        </td>
        <td>
          <span class="price-cell">${fmtNum(latestClose, 1)}</span><br>
          <span class="mobile-price-date" style="font-size:11px;color:var(--text3)">${strat.priceUpdated || strat.dataUpdated}</span>
        </td>
        <td><span class="deviation ${sinceEntryClass}">${fmtPct(sinceEntryPct)}</span></td>
        <td><span style="font-family:var(--mono);font-size:12px">${fmtLots(d.vol_20d_avg)}</span></td>
        <td>
          <span class="deviation ${weekClass}">${d.week_chg_pct != null ? weekSign + d.week_chg_pct.toFixed(2) + '%' : '—'}</span><br>
          <span class="metric-sub">EMA120 ${d.deviation != null ? devSign + d.deviation.toFixed(2) + '%' : '—'}</span>
        </td>
        <td>
          <div class="holder-trend-cell compact-holder-trend">
            <div class="holder-trend-grid">
              <span class="trend-label">千張</span><span>${fmtPct(chg1w1000)}</span><span>${fmtPct(d.cumulative_3w)}</span><span>${fmtPct(d.chg_4w_1000)}</span><span>${d.big_pct_1000 != null ? d.big_pct_1000.toFixed(2) + '%' : '—'}</span>
              <span class="trend-label">400</span><span>${fmtPct(chg1w400)}</span><span>${fmtPct(d.cumulative_3w_400)}</span><span>${fmtPct(d.chg_4w_400)}</span><span>${d.big_pct_400 != null ? d.big_pct_400.toFixed(2) + '%' : '—'}</span>
            </div>
            <div class="metric-sub">單週 / 3週 / 4週 / 比例</div>
          </div>
        </td>
      </tr>
      <tr class="expand-row" id="expand-${d.stock_id}" style="display:none">
        <td colspan="8">
          <div class="expand-flat">
            <div class="expand-trend-wrap">
              ${(() => {
                const labels = d.date_labels || DATE_LABELS;
                const t1000  = d.big_trend_1000 || [];
                const t400   = d.big_trend_400  || [];
                const week1000 = t1000.length >= 2 ? +(t1000[t1000.length-1] - t1000[t1000.length-2]).toFixed(2) : null;
                const week400  = t400.length  >= 2 ? +(t400[t400.length-1]  - t400[t400.length-2]).toFixed(2) : null;
                const week1000Sign = week1000 != null && week1000 >= 0 ? '+' : '';
                const week400Sign  = week400  != null && week400  >= 0 ? '+' : '';
                const dateHdrs = [...labels].reverse().map(l => `<th>${l}</th>`).join('');
                const cells1000 = [...t1000].reverse().map(v => `<td>${v.toFixed(2)}%</td>`).join('');
                const cells400  = [...t400].reverse().map(v  => `<td>${v.toFixed(2)}%</td>`).join('');
                return `<table class="expand-table">
                  <thead><tr>
                    <th></th><th>單周增幅</th>${dateHdrs}
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td>千張大戶</td>
                      <td class="expand-cum ${week1000!=null&&week1000>=0?'pos':'neg'}">${week1000!=null?week1000Sign+week1000.toFixed(2)+'%':'—'}</td>
                      ${cells1000}
                    </tr>
                    <tr>
                      <td>400張大戶</td>
                      <td class="expand-cum ${week400!=null&&week400>=0?'pos':'neg'}">${week400!=null?week400Sign+week400.toFixed(2)+'%':'—'}</td>
                      ${cells400}
                    </tr>
                  </tbody>
                </table>`;
              })()}
            </div>
          </div>
        </td>
      </tr>`;
  }

  function industryGroupHTML(groups) {
    return groups.map(g => {
      const avgSign = g.avg >= 0 ? '+' : '';
      const rows = g.items.map(d => chipsRow(d)).join('');
      return `
        <tr class="industry-header-row">
          <td colspan="8">
            <span class="industry-name">${g.name}</span>
            <span class="industry-avg">平均3週增幅 ${avgSign}${g.avg.toFixed(2)}%</span>
            <span class="industry-count">${g.items.length} 支</span>
          </td>
        </tr>
        ${rows}`;
    }).join('');
  }

  const sortIcon = col => `<span class="sort-icon">${sortCol===col ? (sortAsc?'↑':'↓') : '·'}</span>`;
  const vscrollClass = allData.length > 10 ? 'table-vscroll' : '';
  const avgScore = allData.length
    ? allData.reduce((sum, d) => sum + Number(d.pattern_score ?? d.score ?? 0), 0) / allData.length
    : 0;
  const avgReturn = allData.length
    ? allData.reduce((sum, d) => sum + Number(sinceEntryPctOf(d) ?? 0), 0) / allData.length
    : 0;
  const priceUpdated = strat.priceUpdated || strat.dataUpdated;

  const tableBody = chipsViewMode === 'stock'
    ? sortedData.map(d => chipsRow(d)).join('')
    : industryGroupHTML(buildIndustryGroups(allData));

  main.innerHTML = `
    <div class="strategy-panel active">
      <div class="strat-header">
        <div class="strat-title">${strat.icon} ${strat.name}策略</div>
        <div class="strat-desc">${strat.description}</div>
      </div>
      <div class="conditions">
        ${strat.conditions.map(c => `<div class="cond"><span class="cond-dot"></span>${c}</div>`).join('')}
      </div>
      <div class="summary-row">
        <div class="summary-card">
          <div class="summary-label">入池標的數</div>
          <div class="summary-value green">${allData.length}</div>
          <div class="summary-sub">低基期大戶池</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">平均分數</div>
          <div class="summary-value amber">${fmtNum(avgScore, 1)}</div>
          <div class="summary-sub">型態分數</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">入池後平均漲幅</div>
          <div class="summary-value ${avgReturn >= 0 ? 'green' : 'red'}">${fmtPct(avgReturn)}</div>
          <div class="summary-sub">現價 vs 入池收盤</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">資料日期</div>
          <div class="summary-value" style="font-size:16px;font-family:var(--mono)">${strat.dataUpdated}</div>
          <div class="summary-sub">收盤更新 ${priceUpdated}</div>
        </div>
      </div>
      ${renderIndustryChart(allData)}
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">篩選結果</span>
          <div class="toolbar-right">
            <div style="display:flex;gap:6px">
              <button class="view-btn ${chipsViewMode==='stock'?'active':''}" onclick="setChipsView('stock')">個股</button>
              <button class="view-btn ${chipsViewMode==='industry'?'active':''}" onclick="setChipsView('industry')">族群</button>
            </div>
            <span class="updated-tag">籌碼：${strat.dataUpdated}${strat.priceUpdated && strat.priceUpdated !== strat.dataUpdated ? `　現價：${strat.priceUpdated}` : ''}</span>
            <button class="btn-csv" onclick="exportCSVChips()" title="匯出 CSV">↓ 匯出 CSV</button>
          </div>
        </div>
        <div class="table-scroll ${vscrollClass}">
        <table id="resultsTable">
          <thead>
            <tr>
              <th onclick="chipsSort('stock_id')">代號 / 名稱${sortIcon('stock_id')}</th>
              <th onclick="chipsSort('score')" data-tip="統一分數：籌碼、動能、量能、結構、主線加權後的 0-100 分">分數${sortIcon('score')}</th>
              <th onclick="chipsSort('close')">入選收盤${sortIcon('close')}</th>
              <th onclick="chipsSort('close')">現價${sortIcon('close')}</th>
              <th onclick="chipsSort('week_chg_pct')">績效${sortIcon('week_chg_pct')}</th>
              <th onclick="chipsSort('vol_20d_avg')" data-tip="近 20 個交易日平均成交量（張）">20均量${sortIcon('vol_20d_avg')}</th>
              <th onclick="chipsSort('deviation')" data-tip="週漲幅與 (現價-EMA120)/EMA120">週漲 / EMA120${sortIcon('deviation')}</th>
              <th onclick="chipsSort('chg_1w_1000')" data-tip="單週 / 3週 / 4週 / 最新持股比例">近期 400/1000張${sortIcon('chg_1w_1000')}</th>
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
        </div>
      </div>
    </div>`;

}

function setChipsView(mode) {
  chipsViewMode = mode;
  const strat = STRATEGIES.find(s => s.id === 'chips_big_holder');
  renderChipsHolder(strat, document.getElementById('mainContent'));
}

function chipsSort(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  const strat = STRATEGIES.find(s => s.id === 'chips_big_holder');
  renderChipsHolder(strat, document.getElementById('mainContent'));
}

function vsSort(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  const strat = STRATEGIES.find(s => s.id === 'volume_signal');
  renderVolumeSignal(strat, document.getElementById('mainContent'));
}

function exportCSVChips() {
  const data = DATA.chips_big_holder_data || [];
  if (!data.length) return;
  const strat = STRATEGIES.find(s => s.id === 'chips_big_holder');
  const scoreTags = new Set(['持續成長', '雙軌觸發', '單周增幅']);
  const fmt = v => v != null ? Number(v).toFixed(2) : '';
  const joinTrend = arr => Array.isArray(arr) ? arr.map(v => Number(v).toFixed(2)).join(' / ') : '';
  const headers = [
    '代號',
    '名稱',
    '產業',
    '市值(億)',
    '現價',
    '周漲跌(%)',
    'EMA120',
    '乖離EMA120(%)',
    '5日均量(張)',
    '20日均量(張)',
    '布林帶寬度',
    '千張大戶比例(%)',
    '400張大戶比例(%)',
    '千張大戶3週累積(%)',
    '400張大戶3週累積(%)',
    '千張大戶單周增幅(百分點)',
    '400張大戶單周增幅(百分點)',
    '千張大戶近四次差值(百分點)',
    '400張大戶近四次差值(百分點)',
    '連續週數',
    '評分標籤',
    '全部標籤',
    '趨勢日期',
    '千張大戶趨勢',
    '400張大戶趨勢'
  ];
  const rows = data.map(d => [
    d.stock_id || '',
    d.name || '',
    d.industry || '',
    fmt(d.market_cap),
    d.close != null ? Number(d.close).toFixed(1) : '',
    fmt(d.week_chg_pct),
    fmt(d.ema120),
    fmt(d.deviation),
    d.vol_5d_avg != null ? Math.round(d.vol_5d_avg) : '',
    d.vol_20d_avg != null ? Math.round(d.vol_20d_avg) : '',
    fmt(d.bbw),
    fmt(d.big_pct_1000),
    fmt(d.big_pct_400),
    fmt(d.cumulative_3w),
    fmt(d.cumulative_3w_400),
    fmt(d.chg_1w_1000 ?? (Array.isArray(d.big_trend_1000) && d.big_trend_1000.length >= 2 ? d.big_trend_1000[d.big_trend_1000.length - 1] - d.big_trend_1000[d.big_trend_1000.length - 2] : null)),
    fmt(d.chg_1w_400 ?? (Array.isArray(d.big_trend_400) && d.big_trend_400.length >= 2 ? d.big_trend_400[d.big_trend_400.length - 1] - d.big_trend_400[d.big_trend_400.length - 2] : null)),
    fmt(d.chg_4w_1000),
    fmt(d.chg_4w_400),
    d.consecutive_weeks || '',
    (d.tags || []).filter(t => scoreTags.has(t)).join(' / '),
    (d.tags || []).join(' / '),
    (d.date_labels || []).join(' / '),
    joinTrend(d.big_trend_1000),
    joinTrend(d.big_trend_400),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `chips_${strat?.dataUpdated || 'export'}.csv` });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ════════════════════════════════════════════════════
