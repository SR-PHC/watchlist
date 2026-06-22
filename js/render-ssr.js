function buildSSRRows() {
  return DATA.momentum_candidates_data?.focus_results || [];
}

function renderDailyEntryAnalysis(analysis) {
  if (!analysis || !analysis.analysis_date) return '';

  const fmtPrice = value => value == null || Number.isNaN(Number(value))
    ? '-'
    : Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
  const fmtRatio = value => value == null || Number.isNaN(Number(value))
    ? '-'
    : `${Number(value).toFixed(2)}R`;
  const decisionClass = analysis.decision === 'open_position' ? 'positive' : 'cautious';
  const statusClass = analysis.data_status === 'fresh' ? 'fresh' : 'partial';
  const candidates = (analysis.candidates || []).slice(0, 3);
  const poolUpdated = (DATA.momentum_candidates_data?.updated || '').slice(0, 10);
  const isStale = poolUpdated && analysis.analysis_date && analysis.analysis_date < poolUpdated;

  const candidateCards = candidates.map(candidate => {
    const entry = candidate.reference_entry || {};
    const stop = candidate.structural_stop || {};
    const targets = candidate.targets || [];
    const rr = candidate.reward_risk || {};
    const inWatchlist = (DATA.watchlist_data?.active || [])
      .some(item => String(item.stock_id) === String(candidate.stock_id));
    return `
      <article class="entry-analysis-card">
        <div class="entry-analysis-card-head">
          <div>
            <div class="entry-analysis-rank">候選 ${candidate.rank || '-'}</div>
            <div class="entry-analysis-stock">
              <span>${candidate.stock_id || '-'}</span>
              <strong>${candidate.name || '-'}</strong>
            </div>
          </div>
          <div class="entry-analysis-score">
            <span>型態分</span>
            <strong>${fmtPrice(candidate.pattern_score)}</strong>
          </div>
        </div>
        <div class="entry-analysis-tags">
          <span>${candidate.pattern_type || '型態待確認'}</span>
          <span>${(candidate.source_strategies || []).join(' / ') || '來源未提供'}</span>
        </div>
        <div class="entry-analysis-chart" data-entry-stock-id="${candidate.stock_id}" data-period="day">
          <canvas data-entry-kchart="${candidate.stock_id}"></canvas>
          <div class="pool-kchart-empty" data-empty="entry-${candidate.stock_id}">尚未更新 K 棒</div>
          <div class="pool-period-switch entry-analysis-period">
            <button class="active" onclick="setDailyEntryKPeriod('${candidate.stock_id}', 'day')">日</button>
            <button onclick="setDailyEntryKPeriod('${candidate.stock_id}', 'week')">週</button>
            <button onclick="setDailyEntryKPeriod('${candidate.stock_id}', 'month')">月</button>
          </div>
        </div>
        <div class="entry-analysis-levels">
          <div><span>參考區</span><strong>${fmtPrice(entry.low)} - ${fmtPrice(entry.high)}</strong></div>
          <div><span>結構停損</span><strong class="risk">${fmtPrice(stop.price)}</strong></div>
          <div><span>目標一</span><strong>${fmtPrice(targets[0]?.price)}</strong></div>
          <div><span>目標二</span><strong>${fmtPrice(targets[1]?.price)}</strong></div>
          <div><span>報酬風險</span><strong>${fmtRatio(rr.target1)} / ${fmtRatio(rr.target2)}</strong></div>
        </div>
        <div class="pool-kcard-actions">
          <button class="perf-btn perf-btn-add" onclick="addDailyEntryToWatchlist('${candidate.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已在自選' : '加入自選'}</button>
        </div>
        <details class="entry-analysis-details">
          <summary>查看分析依據</summary>
          <div class="entry-analysis-detail-grid">
            <section>
              <h4>優勢</h4>
              <ul>${(candidate.strengths || []).map(item => `<li>${item}</li>`).join('') || '<li>未提供</li>'}</ul>
            </section>
            <section>
              <h4>風險</h4>
              <ul>${(candidate.risks || []).map(item => `<li>${item}</li>`).join('') || '<li>未提供</li>'}</ul>
            </section>
          </div>
          <div class="entry-analysis-basis">
            <p><b>進場依據：</b>${entry.basis || '-'}</p>
            <p><b>停損依據：</b>${stop.basis || '-'}</p>
            <p><b>目標依據：</b>${rr.basis || '-'}</p>
            <p><b>失效條件：</b>${(candidate.invalidation_conditions || []).join('；') || '-'}</p>
          </div>
        </details>
      </article>`;
  }).join('');

  return `
    <section class="entry-analysis-panel">
      <div class="entry-analysis-header">
        <div>
          <div class="entry-analysis-eyebrow">CODEX 盤後決策支援</div>
          <h2>今日建倉分析</h2>
        </div>
        <div class="entry-analysis-meta">
          <span>${analysis.analysis_date}</span>
          <span>${(analysis.generated_at || '').slice(11, 16) || '-'}</span>
          <span>${(analysis.commit_sha || '-').slice(0, 7)}</span>
          ${isStale ? `<span class="entry-analysis-stale">落後標的池 ${poolUpdated}</span>` : ''}
        </div>
      </div>
      ${isStale ? `
        <div class="entry-analysis-warning stale">
          <strong>分析已過期</strong>
          <span>目前標的池資料為 ${poolUpdated}，但今日建倉分析仍停在 ${analysis.analysis_date}。請確認 Codex 自動化「每日標的池建倉分析」是否仍在執行並有提交 data/daily_entry_analysis.json。</span>
        </div>` : ''}
      <div class="entry-analysis-decision ${decisionClass}">
        <div>
          <span class="entry-analysis-status ${statusClass}">${analysis.data_status_label || analysis.data_status || '資料狀態未知'}</span>
          <strong>${analysis.decision_label || '等待分析'}</strong>
        </div>
        <p>${analysis.decision_summary || '-'}</p>
      </div>
      <div class="entry-analysis-stats">
        <div><span>今日新進</span><strong>${analysis.new_candidate_count ?? '-'}</strong></div>
        <div><span>人工候選</span><strong>${analysis.qualified_count ?? candidates.length}</strong></div>
        <div><span>大盤</span><strong>${analysis.market_context?.taiex_change_pct != null ? `${Number(analysis.market_context.taiex_change_pct) > 0 ? '+' : ''}${Number(analysis.market_context.taiex_change_pct).toFixed(2)}%` : '-'}</strong></div>
      </div>
      ${candidateCards ? `<div class="entry-analysis-grid">${candidateCards}</div>` : '<div class="entry-analysis-empty">今天沒有合格候選，維持空手等待。</div>'}
      ${(analysis.missing_data || []).length ? `
        <div class="entry-analysis-warning">
          <strong>資料提醒</strong>
          <span>${analysis.missing_data.join('；')}</span>
        </div>` : ''}
      <div class="entry-analysis-footnote">結構價位僅供人工看圖與風險規劃，不是自動下單或保證買進指令。</div>
    </section>`;
}

function renderSSR(strat, main) {
  const momentumData = DATA.momentum_candidates_data || {};
  const focusRows = momentumData.focus_results || [];
  const poolFilter = window._stockPoolFilter || 'all';
  const sortCol = window._ssrSortCol || 'score';
  const sortAsc = window._ssrSortAsc !== undefined ? window._ssrSortAsc : false;

  window.setStockPoolFilter = function setStockPoolFilter(v) {
    window._stockPoolFilter = v;
    renderStrategy();
  };

  window.ssrSort = function ssrSort(col) {
    if (window._ssrSortCol === col) window._ssrSortAsc = !window._ssrSortAsc;
    else { window._ssrSortCol = col; window._ssrSortAsc = false; }
    renderStrategy();
  };

  function fmtNum(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '-' : Number(v).toFixed(digits);
  }

  function fmtPct(v, digits = 2) {
    return v == null || Number.isNaN(Number(v)) ? '-' : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(digits)}%`;
  }

  function sourceLabel(src) {
    return ({
      chips: '低基期',
      volume_signal: '量增',
      big_holder_trend: '趨勢',
      right_top: '突破',
    }[src] || src);
  }

  function poolCategory(row) {
    if ((row.pattern_state || '') === '太遠不追') return 'exclude';
    if ((row.pattern_state || '') === '值得看圖') return 'watch';
    if (row.breakout_stage === 'pre_breakout') return 'pre_breakout';
    return 'other';
  }

  function matchesPoolFilter(row, filter) {
    const category = poolCategory(row);
    if (category === 'exclude') return false;
    if (filter === 'watch') return category === 'watch';
    if (filter === 'pre_breakout') return category === 'pre_breakout';
    return true;
  }

  function poolCount(filter) {
    return focusRows.filter(row => matchesPoolFilter(row, filter)).length;
  }

  function breakoutStageText(row) {
    if (!row || !(row.sources || []).includes('right_top')) return '';
    const label = row.breakout_stage_label || (
      row.breakout_stage === 'pre_breakout' ? '準突破' :
      row.breakout_stage === 'confirmed_breakout' ? '突破確認' : ''
    );
    const dist = row.breakout_distance_pct ?? row.metrics?.breakout_distance_pct ?? row.metrics?.pre_breakout_distance_pct;
    if (!label) return '';
    return dist != null ? `${label} ${fmtNum(dist, 1)}%` : label;
  }

  function value(row, col) {
    const m = row.metrics || {};
    if (col === 'score') return row.pattern_score ?? 0;
    if (col === 'vol_20d_avg') return m.vol_20d_avg ?? 0;
    if (col === 'primary_metric') return m.ignition_vol_ratio ?? m.today_vol_ratio ?? m.track_vol_ratio ?? 0;
    return row[col] ?? m[col];
  }

  function compare(a, b) {
    const va = value(a, sortCol);
    const vb = value(b, sortCol);
    const na = Number(va);
    const nb = Number(vb);
    const cmp = !Number.isNaN(na) && !Number.isNaN(nb)
      ? na - nb
      : String(va ?? '').localeCompare(String(vb ?? ''));
    return sortAsc ? cmp : -cmp;
  }

  function sortIcon(col) {
    return `<span class="sort-icon">${sortCol === col ? (sortAsc ? '↑' : '↓') : '·'}</span>`;
  }

  function stateColor(state) {
    if (state === '值得看圖') return 'var(--green)';
    if (state === '太遠不追') return 'var(--amber)';
    if (state === '型態破壞') return '#dc2626';
    return 'var(--text2)';
  }

  const filters = [
    { key: 'all', label: '全部', count: poolCount('all') },
    { key: 'watch', label: '值得看圖', count: poolCount('watch') },
    { key: 'pre_breakout', label: '準突破', count: poolCount('pre_breakout') },
  ];

  const filterButtons = filters.map(opt => `
    <button class="view-btn ${poolFilter === opt.key ? 'active' : ''}"
      onclick="setStockPoolFilter('${opt.key}')">${opt.label} ${opt.count}</button>
  `).join('');

  const rows = focusRows
    .filter(row => matchesPoolFilter(row, poolFilter))
    .sort(compare);

  const kbarDate = (DATA.stock_kbars_data?.updated || DATA.stock_kbars_data?.date || '').slice(0, 16) || '-';
  const kbarCount = DATA.stock_kbars_data?.count || 0;
  const entryAnalysisHTML = '';

  const cardsHTML = rows.map(row => {
    const m = row.metrics || {};
    const patState = row.pattern_state || '先觀察';
    const patScore = row.pattern_score ?? 0;
    const stageText = breakoutStageText(row);
    const displayKeyLevel = row.key_level ?? row.breakout_key_level ?? m.breakout_key_level ?? m.pre_breakout_key_level;
    const tags = [
      ...(stageText ? [stageText] : []),
      ...(row.pattern_tags || []),
      ...(row.sources || []).map(sourceLabel),
    ].slice(0, 5);
    const vol20 = m.vol_20d_avg;
    const watchItem = (DATA.watchlist_data?.active || []).find(item => String(item.stock_id) === String(row.stock_id));
    const inWatchlist = !!watchItem;

    return `<article class="pool-kcard" data-stock-id="${row.stock_id}">
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
          <strong>${fmtNum(row.close, 2)}</strong>
          <em>(${fmtNum(patScore, 1)})</em>
        </div>
      </div>
      <div class="pool-kcard-tags">
        <span class="tag-badge" style="color:${stateColor(patState)};border-color:var(--border)">${patState}</span>
        ${tags.map(tag => `<span class="tag-badge" style="color:var(--text3);border-color:var(--border)">${tag}</span>`).join('')}
      </div>
      <div class="pool-kchart-wrap">
        <canvas data-kchart="${row.stock_id}"></canvas>
        <div class="pool-kchart-empty" data-empty="${row.stock_id}">尚未更新 K 棒</div>
        <div class="pool-period-switch">
          <button class="active" onclick="setPoolKPeriod('${row.stock_id}', 'day')">日</button>
          <button onclick="setPoolKPeriod('${row.stock_id}', 'week')">週</button>
          <button onclick="setPoolKPeriod('${row.stock_id}', 'month')">月</button>
        </div>
      </div>
      <div class="pool-kcard-detail">
        <div><span>20日均量</span><strong>${vol20 != null ? Math.round(vol20).toLocaleString() : '-'}</strong></div>
        <div><span>關鍵價</span><strong>${fmtNum(displayKeyLevel, 2)}</strong></div>
        <div><span>失效價</span><strong class="neg">${fmtNum(row.invalidation, 2)}</strong></div>
        ${stageText ? `<div><span>突破</span><strong>${stageText}</strong></div>` : ''}
        <div><span>來源</span><strong>${(row.sources || []).map(sourceLabel).join(' / ') || '-'}</strong></div>
      </div>
      <div class="pool-kcard-actions">
        <button class="perf-btn perf-btn-add" onclick="addStockPoolToWatchlist('${row.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已在自選' : '加入自選'}</button>
      </div>
    </article>`;
  }).join('');

  const rowsHTML = rows.map(row => {
    const m = row.metrics || {};
    const patState = row.pattern_state || '先觀察';
    const patScore = row.pattern_score ?? 0;
    const patTags = (row.pattern_tags || []).join(' ');
    const patternList = (row.patterns || []).join(' / ');
    const keyLevel = row.key_level ?? row.breakout_key_level ?? m.breakout_key_level ?? m.pre_breakout_key_level;
    const invalidation = row.invalidation;
    const vol = m.today_vol_ratio ?? m.ignition_vol_ratio ?? m.track_vol_ratio;
    const stageText = breakoutStageText(row);
    const color = stateColor(patState);
    const inWatchlist = (DATA.watchlist_data?.active || []).some(item => String(item.stock_id) === String(row.stock_id));

    return `<tr>
      <td>
        <div class="stock-code">${row.stock_id}</div>
        <div class="stock-name">${row.name || '-'}</div>
        <div class="stock-industry" style="font-size:10px;color:var(--text3)">${row.industry || '-'}</div>
      </td>
      <td><span class="tag-badge" style="color:${color};border-color:rgba(80,90,110,.35)">${patState}</span></td>
      <td><span style="font-family:var(--mono);font-weight:700;color:${color}">${fmtNum(patScore, 1)}</span></td>
      <td style="font-size:11px;line-height:1.5;max-width:140px">
        ${patTags ? `<span style="color:var(--text)">${patTags}</span>` : ''}
        ${stageText ? `<br><span style="color:var(--blue)">${stageText}</span>` : ''}
        ${patternList ? `<br><span style="color:var(--text3)">${patternList}</span>` : ''}
        ${!patTags && !patternList && !stageText ? '-' : ''}
      </td>
      <td style="font-family:var(--mono);font-size:12px;white-space:nowrap">
        ${keyLevel != null ? `<span style="color:var(--green);font-weight:700">${fmtNum(keyLevel, 2)}</span>` : '-'}
        ${invalidation != null ? `<br><span style="font-size:10px;color:#dc2626">↓ ${fmtNum(invalidation, 2)}</span>` : ''}
      </td>
      <td><span class="price-cell">${fmtNum(row.close, 1)}</span></td>
      <td style="font-size:11px;color:var(--text2);line-height:1.6">
        ${vol != null ? `<span style="font-family:var(--mono)">量 ${fmtNum(vol, 2)}x</span>` : '<span style="color:var(--text3)">-</span>'}
        <br>${(row.sources || []).map(s => `<span class="tag-badge" style="color:var(--text3);border-color:rgba(80,90,110,.25)">${sourceLabel(s)}</span>`).join('')}
      </td>
      <td><button class="perf-btn perf-btn-add sidebar-mini-btn" onclick="addStockPoolToWatchlist('${row.stock_id}')" ${inWatchlist ? 'disabled' : ''}>${inWatchlist ? '已加入' : '加入自選'}</button></td>
    </tr>`;
  }).join('');

  window.exportFocusCSV = function exportFocusCSV() {
    const headers = [
      '代號', '名稱', '產業', '市場', '型態狀態', '型態分', '型態標籤',
      '關鍵價', '失效價', '型態可信度', '收盤', '20日均量', '量比', '週漲跌(%)', '來源', '突破狀態',
    ];
    const csvRows = rows.map(row => {
      const m = row.metrics || {};
      const vol = m.today_vol_ratio ?? m.ignition_vol_ratio ?? m.track_vol_ratio;
      return [
        row.stock_id,
        row.name || '',
        row.industry || '',
        row.market || '',
        row.pattern_state || '',
        row.pattern_score != null ? Number(row.pattern_score).toFixed(1) : '',
        (row.pattern_tags || []).join(' '),
        (row.key_level ?? row.breakout_key_level ?? m.breakout_key_level ?? m.pre_breakout_key_level) != null
          ? Number(row.key_level ?? row.breakout_key_level ?? m.breakout_key_level ?? m.pre_breakout_key_level).toFixed(2)
          : '',
        row.invalidation != null ? Number(row.invalidation).toFixed(2) : '',
        row.pattern_confidence != null ? Number(row.pattern_confidence).toFixed(2) : '',
        row.close ?? '',
        m.vol_20d_avg != null ? Number(m.vol_20d_avg).toFixed(0) : '',
        vol != null ? Number(vol).toFixed(2) : '',
        m.week_chg_pct != null ? Number(m.week_chg_pct).toFixed(2) : '',
        (row.sources || []).map(sourceLabel).join(' / '),
        breakoutStageText(row),
      ];
    });
    const csv = [headers, ...csvRows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const updated = (momentumData.updated || '').slice(0, 10) || strat.dataUpdated || 'export';
    const a = Object.assign(document.createElement('a'), { href: url, download: `focus_pool_${updated}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  main.innerHTML = `
    <div class="strategy-panel active">
      <div class="strat-header">
        <div class="strat-title">${strat.icon} ${strat.name}</div>
        <div class="strat-desc">${strat.description}</div>
      </div>
      ${entryAnalysisHTML}
      <div class="table-wrap">
        <div class="table-toolbar">
          <span class="table-title">標的池</span>
          <div class="toolbar-right">
            <span class="updated-tag">值得看圖 ${momentumData.summary?.pattern_watch ?? focusRows.length} / 全 ${momentumData.summary?.total || focusRows.length}</span>
            <span class="updated-tag">20日均量 > 3000</span>
            <span class="updated-tag">K棒 ${kbarCount} 檔 ${kbarDate}</span>
            <button class="btn-csv" onclick="triggerShioajiPriceUpdate(this)">更新資料</button>
            <button class="btn-csv" onclick="exportFocusCSV()">匯出 CSV</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border);flex-wrap:wrap">
          ${filterButtons}
        </div>
        <div class="pool-kcard-grid">
          ${cardsHTML || `<div style="grid-column:1/-1;text-align:center;color:var(--text3);padding:28px">目前沒有標的池候選</div>`}
        </div>
        <div class="table-scroll ${rows.length > 10 ? 'table-vscroll' : ''}">
          <table>
            <thead>
              <tr>
                <th onclick="ssrSort('stock_id')" style="cursor:pointer">代號 / 名稱${sortIcon('stock_id')}</th>
                <th>型態狀態</th>
                <th onclick="ssrSort('score')" style="cursor:pointer">型態分${sortIcon('score')}</th>
                <th>型態標籤</th>
                <th>關鍵 / 失效</th>
                <th onclick="ssrSort('close')" style="cursor:pointer">收盤${sortIcon('close')}</th>
                <th>來源 / 背景</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${rowsHTML || `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:28px">目前沒有標的池候選</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  setTimeout(() => {
    drawDailyEntryKCharts();
    drawPoolKCharts(rows);
  }, 40);
}

function aggregatePoolBars(rows, period) {
  if (period === 'day') return rows.slice(-90);
  const map = new Map();
  rows.forEach(bar => {
    const date = new Date(bar.date);
    const key = period === 'month'
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : `${date.getFullYear()}-${String(Math.ceil((((date - new Date(date.getFullYear(), 0, 1)) / 86400000) + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`;
    const item = map.get(key);
    if (!item) {
      map.set(key, { date: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume || 0 });
    } else {
      item.high = Math.max(item.high, bar.high);
      item.low = Math.min(item.low, bar.low);
      item.close = bar.close;
      item.volume += bar.volume || 0;
      item.date = bar.date;
    }
  });
  return [...map.values()].slice(period === 'month' ? -36 : -72);
}

function setPoolKPeriod(stockId, period) {
  const card = document.querySelector(`.pool-kcard[data-stock-id="${stockId}"]`);
  if (!card) return;
  card.dataset.period = period;
  card.querySelectorAll('.pool-period-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const rows = DATA.stock_kbars_data?.stocks?.[stockId]?.daily || [];
  drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(rows, period), stockId, getWatchlistMarkerDate(stockId));
}

function drawPoolKCharts(rows) {
  rows.forEach(row => {
    const card = document.querySelector(`.pool-kcard[data-stock-id="${row.stock_id}"]`);
    if (!card) return;
    const period = card.dataset.period || 'day';
    const bars = DATA.stock_kbars_data?.stocks?.[row.stock_id]?.daily || [];
    drawPoolKChart(card.querySelector('canvas'), aggregatePoolBars(bars, period), row.stock_id, getWatchlistMarkerDate(row.stock_id));
  });
}

function getDailyEntryCandidate(stockId) {
  return (DATA.daily_entry_analysis_data?.candidates || [])
    .find(candidate => String(candidate.stock_id) === String(stockId));
}

function dailyEntryGuideLevels(candidate) {
  if (!candidate) return [];
  const entry = candidate.reference_entry || {};
  const targets = candidate.targets || [];
  return [
    { value: entry.low, color: '#0284c7', dash: [4, 3] },
    { value: entry.high, color: '#0284c7', dash: [4, 3] },
    { value: candidate.structural_stop?.price, color: '#c92a2a', dash: [3, 3] },
    { value: targets[0]?.price, color: '#087f5b', dash: [2, 3] },
    { value: targets[1]?.price, color: '#087f5b', dash: [2, 3] },
  ].filter(level => level.value != null && Number.isFinite(Number(level.value)));
}

function setDailyEntryKPeriod(stockId, period) {
  const chart = document.querySelector(`.entry-analysis-chart[data-entry-stock-id="${stockId}"]`);
  if (!chart) return;
  chart.dataset.period = period;
  chart.querySelectorAll('.pool-period-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === ({ day: '日', week: '週', month: '月' }[period]));
  });
  const rows = DATA.stock_kbars_data?.stocks?.[stockId]?.daily || [];
  const candidate = getDailyEntryCandidate(stockId);
  drawPoolKChart(
    chart.querySelector('canvas'),
    aggregatePoolBars(rows, period),
    `entry-${stockId}`,
    null,
    dailyEntryGuideLevels(candidate),
  );
}

function drawDailyEntryKCharts() {
  (DATA.daily_entry_analysis_data?.candidates || []).slice(0, 3).forEach(candidate => {
    const chart = document.querySelector(`.entry-analysis-chart[data-entry-stock-id="${candidate.stock_id}"]`);
    if (!chart) return;
    const period = chart.dataset.period || 'day';
    const rows = DATA.stock_kbars_data?.stocks?.[candidate.stock_id]?.daily || [];
    drawPoolKChart(
      chart.querySelector('canvas'),
      aggregatePoolBars(rows, period),
      `entry-${candidate.stock_id}`,
      null,
      dailyEntryGuideLevels(candidate),
    );
  });
}

function getWatchlistMarkerDate(stockId) {
  const item = (DATA.watchlist_data?.active || []).find(row => String(row.stock_id) === String(stockId));
  return item?.added_date || null;
}

function formatPoolChartDateLabel(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月`;
}

function drawPoolKChart(canvas, bars, stockId, markerDate = null, guideLevels = []) {
  if (!canvas) return;
  const empty = document.querySelector(`[data-empty="${stockId}"]`);
  if (!bars || !bars.length) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const pad = { top: 14, right: 38, bottom: 30, left: 8 };
  const volHeight = 34;
  const chartH = rect.height - pad.top - pad.bottom - volHeight;
  const chartW = rect.width - pad.left - pad.right;
  const prices = bars.flatMap(b => [b.high, b.low]).map(Number).filter(Number.isFinite);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);
  const maxVol = Math.max(...bars.map(b => Number(b.volume || 0)), 1);
  const slot = chartW / bars.length;
  const candleW = Math.max(2, Math.min(8, slot * .62));

  ctx.strokeStyle = '#e1e7ef';
  ctx.lineWidth = 1;
  ctx.font = '10px Consolas, monospace';
  ctx.fillStyle = '#8a94a3';
  for (let i = 0; i < 4; i += 1) {
    const y = pad.top + (chartH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(rect.width - pad.right + 24, y);
    ctx.stroke();
    ctx.fillText((max - (range / 3) * i).toFixed(max > 80 ? 0 : 1), rect.width - pad.right + 5, y + 3);
  }

  const yPrice = v => pad.top + ((max - v) / range) * chartH;
  guideLevels.forEach(level => {
    const value = Number(level.value);
    if (value < min || value > max) return;
    const y = yPrice(value);
    ctx.save();
    ctx.strokeStyle = level.color;
    ctx.globalAlpha = .72;
    ctx.setLineDash(level.dash || [4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(rect.width - pad.right, y);
    ctx.stroke();
    ctx.restore();
  });
  bars.forEach((bar, i) => {
    const open = Number(bar.open), high = Number(bar.high), low = Number(bar.low), close = Number(bar.close);
    const x = pad.left + i * slot + slot / 2;
    const up = close >= open;
    const color = up ? '#c92a2a' : '#087f5b';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, yPrice(high));
    ctx.lineTo(x, yPrice(low));
    ctx.stroke();
    const bodyTop = yPrice(Math.max(open, close));
    const bodyBottom = yPrice(Math.min(open, close));
    ctx.fillRect(x - candleW / 2, bodyTop, candleW, Math.max(1, bodyBottom - bodyTop));
    const volY = rect.height - pad.bottom - (Number(bar.volume || 0) / maxVol) * volHeight;
    ctx.globalAlpha = .35;
    ctx.fillRect(x - candleW / 2, volY, candleW, rect.height - pad.bottom - volY);
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = '#8a94a3';
  ctx.font = '10px Consolas, monospace';
  ctx.textAlign = 'center';
  bars.forEach((bar, i) => {
    const prevMonth = i > 0 ? new Date(bars[i - 1].date).getMonth() : -1;
    const monthChanged = new Date(bar.date).getMonth() !== prevMonth;
    if (!monthChanged) return;
    const x = pad.left + i * slot + slot / 2;
    ctx.fillText(formatPoolChartDateLabel(bar.date), x, rect.height - 10);
  });
  ctx.textAlign = 'left';

  if (markerDate) {
    const markerIndex = bars.findIndex(bar => bar.date >= markerDate);
    const idx = markerIndex >= 0 ? markerIndex : -1;
    if (idx >= 0) {
      const bar = bars[idx];
      const x = pad.left + idx * slot + slot / 2;
      const y = Math.min(rect.height - pad.bottom - volHeight - 6, yPrice(Number(bar.low)) + 12);
      ctx.strokeStyle = '#147bbd';
      ctx.fillStyle = '#147bbd';
      ctx.globalAlpha = .75;
      ctx.beginPath();
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

async function triggerShioajiKbarUpdate(btn) {
  return triggerShioajiPriceUpdate(btn);
}
