//  STRATEGY REGISTRY
//  新增選股策略只需在這裡加一筆 + 提供 data
// ════════════════════════════════════════════════════
// 公開唯讀展示版：不含績效頁，PERF_UNLOCKED 固定為 false。
const PERF_UNLOCKED = false;
const STRATEGIES = [
  {
    id: "ssr",
    name: "候選標的",
    shortName: "候選標的",
    icon: "✦",
    group: "decision",
    available: true,
    description: "整合原標的池與頸線回測觀察池，在同一頁比較後加入統一自選。",
    conditions: [],
    dataUpdated: "載入中...",
    dataSource: "前端彙整既有策略結果",
  },
  {
    id: "watchlist",
    name: "自選",
    shortName: "自選",
    icon: "◇",
    group: "decision",
    available: true,
    description: "收納從候選標的人工挑選的股票；多重來源合併為同一筆觀察紀錄。",
    conditions: [
      "來源：標的池與頸線回測",
      "預設觀察 10 個交易日",
      "釘選標的保留",
    ],
  },
  {
    id: "neckline",
    hidden: true,
    name: "頸線回測",
    shortName: "頸線回測",
    icon: "⌁",
    group: "decision",
    available: true,
    description: "觀察池：股價回落、貼近精確頸線（±5%）的標的，可釘選持續關注或刪除降噪。",
    conditions: [
      "只採用擺動高點頸線，排除較弱的 box_high 回退訊號",
      "觀察池門檻：拉回低點距精確頸線 ±5% 以內",
      "刪除後 30 個交易日內不會再自動跳出",
      "釘選的標的會持續顯示在下方釘選追蹤，不受狀態變化影響",
    ],
  },
  // ── 策略一：籌碼選股 ──
  {
    id: "chips_big_holder",
    name: "低基期大戶",
    shortName: "低基期大戶",
    icon: "◈",
    group: "source",
    available: true,
    description: "週末籌碼海選：追蹤千張大戶與 400 張大戶持股相對成長率（R），標記持續成長、雙軌觸發、單周增幅三類標籤，篩選低基期且量能充足的標的。",
    conditions: [
      "5日均量 > 500 張",
      "千張大戶比例 > 30%",
      "股價乖離 EMA120：0%～10%",
      "布林帶寬 BBW ≤ 15%",
      "持續成長：連續兩週 R > 0%",
      "雙軌觸發：R_400 ≥ 1.0% 且 R_1000 ≥ 1.0%",
      "單周增幅：任一門檻單週 R > 3.0%",
      "400張訊號需同期間千張至少持平（排除千張賣下來的假增加）",
    ],
    dataUpdated: "載入中...",
    dataSource: "集保開放資料 + FinMind",
    dataKey: "chips_big_holder_data",
  },
  {
    id: "big_holder_trend",
    name: "趨勢大戶",
    shortName: "趨勢大戶",
    icon: "◆",
    group: "source",
    available: true,
    description: "獨立從集保大戶資料篩選：不限制股價乖離，要求均線完整多頭排列（EMA20 > EMA60 > EMA120 > EMA200），找出大戶持續加碼且趨勢確立的標的供人工判讀。",
    conditions: [
      "千張大戶比例 > 30%",
      "千張或 400 張大戶連續 4 週增加，或千張 / 400 張本週增加超過 3%",
      "400張訊號需同期間千張至少持平（排除千張賣下來的假增加）",
      "20 日均量 > 500 張",
      "均線多頭排列：EMA20 > EMA60 > EMA120 > EMA200",
      "不限制股價乖離（短期整理震盪可接受）",
    ],
    dataUpdated: "載入中...",
    dataSource: "集保大戶資料 + price_cache",
    dataKey: "big_holder_trend_data",
  },
  {
    id: "volume_signal",
    // SOURCE / BACKUP - DO NOT DELETE:
    // Daily volume signal remains a model input, but it is hidden from the main nav
    // so the dashboard stays focused on decision-ready views.
    hidden: true,
    name: "量增訊號",
    shortName: "量增訊號",
    icon: "◆",
    group: "chips",
    available: true,
    description: "每日盤後針對籌碼集中入池標的掃描量能突破訊號，捕捉主力啟動時機。",
    conditions: [
      "來源：籌碼集中入池標的",
      "當日成交量 ≥ 10日均量 × 1.5",
      "收盤價 > EMA5",
    ],
    dataUpdated: "載入中...",
    dataSource: "FinMind（每日盤後）",
    dataKey: "volume_signal_data",
  },
  {
    id: "volume_pullback",
    // SOURCE / BACKUP - DO NOT DELETE:
    // Volume pullback remains part of 精選觀察 and LINE candidates. Hide the raw
    // tab to reduce duplicate daily decision surfaces.
    hidden: true,
    name: "量增回測",
    shortName: "量增回測",
    icon: "◎",
    group: "decision",
    available: true,
    description: "追蹤放量突破後回測不破的標的，鎖定點火後回穩與再啟動。",
    conditions: [
      "來源：籌碼集中入池、價格突破追蹤、既有量增訊號",
      "點火：近 5 日任一天成交量 >= 10日均量 × 2.5，且收盤站上 EMA5 或 EMA20",
      "回穩：目前收盤守住點火日低點與 EMA20，回落不超過 8%，量能降溫",
      "再啟動：回穩後突破前一日高點，或量比重新 >= 1.5",
      "10:00 盤中預警：目前停用備用，功能保留勿刪",
    ],
    dataUpdated: "載入中...",
    dataSource: "price_cache + TWSE MIS 盤中即時行情（10:00 預警停用備用）",
    dataKey: "volume_pullback_data",
  },
  {
    id: "big_holder_trend_track",
    name: "趨勢標的",
    shortName: "趨勢標的",
    icon: "◉",
    group: "track",
    available: true,
    description: "趨勢大戶入池標的追蹤，記錄入池收盤、現價、損益，觀察期 2 週。釘選標的永久保留。",
    conditions: [],
  },
  // ── 策略二：突破策略 ──
  {
    id: "right_top",
    name: "突破策略",
    shortName: "突破策略",
    icon: "▲",
    group: "source",
    available: true,
    description: "整合盤整突破、動能突破與價格突破，區分低波動打底、日線啟動與強勢股續創新高。",
    conditions: [
      "盤整突破：週收盤突破前 10 週高點，且突破前 10 週波動 < 20%",
      "盤整突破：前 3 週未創 10 週新高，保留原本第一根突破精神",
      "動能突破：Close > MA20 > MA60，日線突破前 60 日高",
      "動能突破：突破前 10 日貼近 MA20 整理，今日量 ≥ 前 5 日均量 × 1.5",
      "價格突破：Close > EMA20 ≥ EMA60 ≥ EMA120，且 Close ≥ 前 60 日高",
      "價格突破：近 5 日均量 / 20 日均量 > 1.2，且 Close / EMA20 ≤ 1.25",
      "風險控制：排除過度乖離，並以大戶近 3 週連增作為品質標籤",
    ],
    dataUpdated: "載入中...",
    dataSource: "FinMind + 集保大戶資料",
    dataKey: "right_top_data",
  },
  {
    id: "right_top_track",
    name: "突破標的",
    shortName: "突破標的",
    icon: "◉",
    group: "track",
    available: true,
    description: "突破策略觸發標的的後續追蹤，記錄入選收盤、現價、損益，觀察期 10 個交易日。",
    conditions: [],
  },
  {
    id: "neckline_track",
    name: "頸線追蹤",
    shortName: "頸線追蹤",
    icon: "⌁",
    group: "track",
    available: true,
    description: "頸線回測確認進場標的的後續追蹤，記錄進場價、現價、損益，觀察期 10 個交易日。",
    conditions: [],
  },
];


// ════════════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════════════
const DATA = {
  chips_big_holder_data:  [],
  big_holder_trend_data:  [],
  big_holder_trend_meta:  null,
  volume_signal_data:     [],
  volume_pullback_data:    null,
  momentum_candidates_data: null,
  daily_entry_analysis_data: null,
  watchlist_data:       null,
  intraday_candidates_data: null,
  stock_kbars_data:     null,
  neckline_candidates_data: null,
  neckline_kbars_data: null,
  performance_data:       null,
  market_index_data:      null,
  yuanta_portfolio:       null,
  yuanta_account_snapshots: null,
  right_top_data:         [],
  right_top_industry:     [],
  right_top_track_data:         null,
  big_holder_trend_track_data:  null,
  neckline_track_data:          null,
  neckline_daily_rank_data:     null,
};
let DATE_LABELS = [];

// ════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════
function getDefaultStrategyId() {
  return (PERF_UNLOCKED && STRATEGIES.find(s => s.id === "performance" && !s.hidden)?.id)
    || STRATEGIES.find(s => s.id === "ssr" && !s.hidden)?.id
    || STRATEGIES.find(s => s.available && !s.hidden && s.id !== "performance")?.id
    || STRATEGIES.find(s => s.available && !s.hidden)?.id
    || "ssr";
}

function isVisibleStrategy(id) {
  const strat = STRATEGIES.find(s => s.id === id);
  return !!strat && !strat.hidden;
}

let activeStratId = getDefaultStrategyId();
let sortCol = "chg_2w_1000";
let sortAsc = false;
let chipsViewMode = "stock"; // "stock" | "industry"
let expandedRow = null;

function dateTW(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addTradingDaysTW(days) {
  const [year, month, day] = dateTW().split('-').map(Number);
  const date = new Date(year, month - 1, day);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return formatLocalDate(date);
}

// ════════════════════════════════════════════════════
//  TRADINGVIEW APP DEEP LINK
//  手機上優先呼出 TradingView App（需已安裝），
//  未安裝時 fallback 到網頁版；桌機直接開新分頁。
// ════════════════════════════════════════════════════
function openTV(tvSymbol, event) {
  event.stopPropagation();
  event.preventDefault();
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  // 使用完整 https URL；iOS/Android 上 TradingView 已註冊 universal link，
  // 安裝後會自動攔截並在 App 內開啟正確標的圖表。
  const webUrl = `https://www.tradingview.com/chart/?symbol=${tvSymbol}`;
  if (isMobile) {
    // 先嘗試 custom scheme（冒號不編碼，App 才能正確解析 symbol）
    const appUrl = `tradingview://chart?symbol=${tvSymbol}`;
    const t0 = Date.now();
    window.location.href = appUrl;
    // App 未安裝時 300ms 後 fallback 到網頁版（universal link）
    setTimeout(() => {
      if (Date.now() - t0 < 800) window.open(webUrl, '_blank');
    }, 300);
  } else {
    window.open(webUrl, '_blank');
  }
}

// ════════════════════════════════════════════════════
//  EXCHANGE DETECTION
//  資料若有 market 欄位（"TWSE"/"TPEX"）優先採用，
//  否則依代號範圍推算（非 100% 精確）
// ════════════════════════════════════════════════════
function guessMarket(stockId) {
  const n = parseInt(stockId, 10);
  if (n >= 1000 && n <= 2999) return 'TWSE';   // 上市
  if (n >= 3000 && n <= 3499) return 'TWSE';   // 上市居多
  if (n >= 3500 && n <= 3999) return 'TPEX';   // 上櫃居多
  if (n >= 4000 && n <= 4999) return 'TPEX';   // 上櫃
  if (n >= 5000 && n <= 5999) return 'TPEX';   // 上櫃居多
  if (n >= 6000 && n <= 6999) return 'TPEX';   // 上櫃居多
  if (n >= 7000 && n <= 9999) return 'TPEX';   // 上櫃
  return 'TWSE';                                 // fallback
}

function getTVSymbol(d) {
  const market = d.market || guessMarket(d.stock_id);
  return `${market}:${d.stock_id}`;
}

// ════════════════════════════════════════════════════
//  RENDER HELPERS
// ════════════════════════════════════════════════════
function sparkBars(trend) {
  const min = Math.min(...trend), max = Math.max(...trend);
  const range = max - min || 1;
  return trend.map(v => {
    const h = Math.round(((v - min) / range) * 18) + 6;
    return `<span class="spark-bar" style="height:${h}px"></span>`;
  }).join('');
}

function trendBars(trend, label, colorClass) {
  const max = Math.max(...trend);
  return [...trend].reverse().map((v, i) => `
    <div class="trend-row">
      <span class="trend-date">${DATE_LABELS[DATE_LABELS.length - 1 - i]}</span>
      <div class="trend-bar-wrap">
        <div class="trend-bar ${colorClass}" style="width:${(v/max*100).toFixed(1)}%"></div>
      </div>
      <span class="trend-val">${v.toFixed(2)}%</span>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
//  RENDER STRATEGY TABS
// ════════════════════════════════════════════════════
const NAV_GROUP_LABELS = {
  decision:  '決策',
  source:    '策略',
  track:     '追蹤',
  backup:    '備用觀察',
  ssr:       'SSR',
  chips:     '籌碼選股',
  right_top: '突破策略',
};

function _navBadge(s) {
  if (!s.available) return '—';
  if (s.id === 'performance') {
    return new Set(
      (DATA.performance_data?.positions || [])
        .filter(p => !p.confirmed && p.stock_id)
        .map(p => String(p.stock_id))
    ).size;
  }
  if (s.id === 'ssr') {
    const ids = new Set([
      ...(DATA.momentum_candidates_data?.focus_results || [])
        .filter(row => row && row.pattern_state !== '太遠不追' && row.pattern_state !== '型態破壞')
        .map(row => String(row.stock_id)),
      ...(DATA.neckline_candidates_data?.watch_pool || []).map(row => String(row.stock_id)),
    ]);
    return ids.size || '—';
  }
  if (s.id === 'watchlist') return DATA.watchlist_data?.active?.length ?? '—';
  if (s.id === 'neckline') return DATA.neckline_candidates_data?.summary?.watch_pool_total ?? '—';
  if (s.id === 'volume_pullback') return DATA.volume_pullback_data?.active?.length ?? '—';
  if (s.id === 'big_holder_trend_track') return DATA.big_holder_trend_track_data?.active?.length ?? '—';
  if (s.id === 'right_top_track') return DATA.right_top_track_data?.active?.length ?? '—';
  if (s.id === 'neckline_track') return DATA.neckline_track_data?.active?.length ?? '—';
  const rows = DATA[s.dataKey] || [];
  return rows.length || (s.dataUpdated === '載入中...' ? '—' : 0);
}

function _navTab(s) {
  const badge = `<span class="badge">${_navBadge(s)}</span>`;
  return `<button class="strat-tab ${s.id===activeStratId?'active':''} ${!s.available?'locked':''}"
    onclick="${s.available ? `setStrategy('${s.id}')` : ''}"
    title="${!s.available ? (s.comingSoon||'即將推出') : ''}">
    ${s.icon} ${s.shortName}${badge}
  </button>`;
}

function _updateHdrBtns() {
  const btnPerf   = document.getElementById('hdrBtnPerf');

  // 績效按鈕：需解鎖才顯示
  if (btnPerf) btnPerf.style.display = PERF_UNLOCKED ? '' : 'none';

  [btnPerf].forEach(btn => {
    if (!btn || btn.style.display === 'none') return;
    const isActive = activeStratId === 'performance';
    btn.style.background     = isActive ? 'var(--bg3)' : 'none';
    btn.style.borderColor    = isActive ? 'var(--border)' : 'transparent';
    btn.style.color          = isActive ? 'var(--text)'  : 'var(--text2)';
  });
}

function renderNav() {
  const nav = document.getElementById('strategyNav');
  let html = '';

  _updateHdrBtns();

  // MINI 本地來源以績效頁為入口；非本地來源維持隱藏。
  if (PERF_UNLOCKED) {
    const perf = STRATEGIES.find(s => s.id === 'performance');
    if (perf) html += `<div class="nav-group nav-group-primary">${_navTab(perf)}</div>`;
  }

  // 依 group 分組渲染
  const groupOrder = [];
  const grouped = {};
  STRATEGIES.filter(s => s.group !== null && !s.hidden).forEach(s => {
    const g = s.group;
    if (!grouped[g]) { grouped[g] = []; groupOrder.push(g); }
    grouped[g].push(s);
  });

  groupOrder.forEach(g => {
    const label = NAV_GROUP_LABELS[g];
    const collapsed = window.innerWidth > 720 && localStorage.getItem(`nav_group_collapsed_${g}`) === '1';
    html += `<div class="nav-group ${collapsed ? 'collapsed' : ''}">`;
    if (label) {
      const totalCount = grouped[g].reduce((n, s) => { const b = _navBadge(s); return n + (+b || 0); }, 0);
      html += `<button class="nav-group-label" onclick="toggleNavGroup('${g}')">
        ${label}${collapsed ? `<span class="badge" style="margin-left:2px">${totalCount}</span>` : ''}
        <span class="nav-group-caret">${collapsed ? '▶' : '▼'}</span>
      </button>`;
    }
    if (!collapsed) {
      grouped[g].forEach(s => { html += _navTab(s); });
    }
    html += `</div>`;
  });

  nav.innerHTML = html;
}

function updateAppChrome(strat) {
  const title = document.getElementById('pageHeadingTitle');
  if (title) title.textContent = strat?.id === 'performance' ? '投資組合總覽' : (strat?.name || '投資決策中心');
  const headerMeta = document.querySelector('.header-meta');
  if (headerMeta) headerMeta.style.display = strat?.id === 'performance' ? 'none' : '';
  const sync = document.getElementById('appSyncStatus');
  const date = DATA.market_index_data?.updated
    || DATA.watchlist_data?.last_updated
    || DATA.momentum_candidates_data?.updated;
  if (sync) sync.textContent = date ? `更新於 ${String(date).slice(0, 10)}` : '等待資料載入';
}

// ════════════════════════════════════════════════════
//  RENDER ACTIVE STRATEGY
// ════════════════════════════════════════════════════
function renderStrategy() {
  if (!isVisibleStrategy(activeStratId)) activeStratId = getDefaultStrategyId();
  const strat = STRATEGIES.find(s => s.id === activeStratId);
  const main = document.getElementById('mainContent');
  updateAppChrome(strat);

  if (!strat.available) {
    main.innerHTML = `<div class="coming-soon">
      <div class="coming-icon">${strat.icon}</div>
      <div class="coming-title">${strat.name}</div>
      <div class="coming-desc">${strat.description}<br><br><span style="color:var(--amber)">${strat.comingSoon}</span></div>
    </div>`;
    return;
  }

  if (strat.id !== 'performance' && typeof setPerfSidebarMode === 'function') setPerfSidebarMode(false);
  if (strat.id === 'ssr')              { renderUnifiedCandidates(strat, main); return; }
  if (strat.id === 'watchlist')        { renderWatchlist(strat, main);       return; }
  if (strat.id === 'neckline')         { renderNeckline(strat, main);        return; }
  if (strat.id === 'chips_big_holder') { renderChipsHolder(strat, main);    return; }
  if (strat.id === 'big_holder_trend') { renderBigHolderTrend(strat, main); return; }
  if (strat.id === 'volume_signal')    { renderVolumeSignal(strat, main);   return; }
  if (strat.id === 'volume_pullback')  { renderVolumePullback(strat, main); return; }
  if (strat.id === 'big_holder_trend_track'){ renderBigHolderTrendTrack(strat, main);   return; }
  if (strat.id === 'right_top')             { renderRightTop(strat, main);               return; }
  if (strat.id === 'right_top_track')       { renderRightTopTrack(strat, main);          return; }
  if (strat.id === 'neckline_track')        { renderNecklineTrack(strat, main);          return; }
  if (strat.id === 'performance')      { renderPerformance(strat, main);    return; }
}

function toggleNavGroup(g) {
  const key = `nav_group_collapsed_${g}`;
  localStorage.setItem(key, localStorage.getItem(key) === '1' ? '0' : '1');
  renderNav();
}

// ════════════════════════════════════════════════════
//  INTERACTIONS
// ════════════════════════════════════════════════════
async function setStrategy(id) {
  if (id === "performance" && !PERF_UNLOCKED) return;
  if (!isVisibleStrategy(id)) id = getDefaultStrategyId();
  activeStratId = id;
  expandedRow = null;
  renderNav();
  toggleMobileNav(false);
  showStrategyLoading(id);
  await loadData(id);
}

function toggleMobileNav(open) {
  document.body.classList.toggle('mobile-nav-open', !!open);
}

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') toggleMobileNav(false);
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 720) toggleMobileNav(false);
});

function sort(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  renderStrategy();
}

function toggleExpand(sid) {
  const prev = expandedRow;
  if (prev) {
    document.getElementById(`expand-${prev}`).style.display = 'none';
    document.getElementById(`row-${prev}`).classList.remove('expanded');
  }
  if (prev !== sid) {
    document.getElementById(`expand-${sid}`).style.display = 'table-row';
    document.getElementById(`row-${sid}`).classList.add('expanded');
    expandedRow = sid;
  } else {
    expandedRow = null;
  }
}


function exportCSV() {
  const strat = STRATEGIES.find(s => s.id === activeStratId);
  const data = DATA[strat.dataKey] || [];
  if (!data.length) return;

  const dateRow = DATE_LABELS.length ? DATE_LABELS.join(' / ') : strat.dataUpdated;
  const headers = [
    '代號', '名稱', '產業',
    '現價', '乖離EMA120(%)',
    '大戶比例(%)', '4週增幅(%)',
    `大戶趨勢(${dateRow})`,
    `散戶趨勢(${dateRow})`,
    '資料日期'
  ];

  const rows = data.map(d => [
    d.stock_id,
    d.name,
    d.industry || '',
    d.close.toFixed(1),
    (d.deviation >= 0 ? '+' : '') + d.deviation.toFixed(2),
    d.big_pct_latest.toFixed(2),
    (d.big_4w_chg >= 0 ? '+' : '') + d.big_4w_chg.toFixed(2),
    d.big_trend   ? d.big_trend.map(v => v.toFixed(2)).join(' / ')   : '',
    d.retail_trend? d.retail_trend.map(v => v.toFixed(2)).join(' / '): '',
    strat.dataUpdated
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${strat.id}_${strat.dataUpdated}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


//  INIT — 首頁只載必要資料，其餘分頁點開時才載入
// ════════════════════════════════════════════════════
const STRATEGY_RESOURCE_KEYS = {
  performance: ['perf', 'marketIndex', 'yuanta', 'yuantaSnapshots'],
  ssr: ['momentum', 'entryAnalysis', 'watchlist', 'kbars', 'neckline', 'necklineKbars'],
  watchlist: ['momentum', 'entryAnalysis', 'watchlist', 'kbars', 'neckline', 'necklineKbars'],
  neckline: ['neckline', 'necklineKbars', 'necklineDailyRank'],
  neckline_track: ['necklineTrack'],
  chips_big_holder: ['chips'],
  big_holder_trend: ['bigHolderTrend'],
  volume_signal: ['volumeSignal'],
  volume_pullback: ['volumePullback', 'momentum'],
  big_holder_trend_track: ['bigHolderTrendTrack'],
  right_top: ['rightTop'],
  right_top_track: ['rightTopTrack'],
};

const JSON_CACHE = new Map();
const JSON_REQUESTS = new Map();
const RESOURCE_LABELS = {
  chips: '低基期大戶',
  bigHolderTrend: '趨勢大戶',
  volumeSignal: '量增訊號',
  volumePullback: '量增回測',
  momentum: '標的池',
  entryAnalysis: '建倉分析',
  watchlist: '自選清單',
  neckline: '頸線回測',
  necklineKbars: '頸線 K 棒',
  kbars: 'K 棒資料',
  perf: '績效資料',
  marketIndex: '大盤指數',
  rightTop: '突破策略',
  rightTopTrack: '突破追蹤',
  bigHolderTrendTrack: '趨勢追蹤',
  necklineTrack: '頸線追蹤',
  necklineDailyRank: '頸線日排名',
  yuanta: '元大帳戶',
  yuantaSnapshots: '帳戶快照',
  currentPrices: '最新價格',
};
let loadProgressSerial = 0;
let loadProgressHideTimer = null;

function beginLoadProgress(strategyId, requestedKeys) {
  const pending = [...requestedKeys].filter(key => !JSON_CACHE.has(key));
  if (!pending.length) return null;

  const root = document.getElementById('loadProgress');
  const label = document.getElementById('loadProgressLabel');
  const percent = document.getElementById('loadProgressPercent');
  const bar = document.getElementById('loadProgressBar');
  if (!root || !label || !percent || !bar) return null;

  if (loadProgressHideTimer) clearTimeout(loadProgressHideTimer);
  const strat = STRATEGIES.find(s => s.id === strategyId);
  const tracker = {
    id: ++loadProgressSerial,
    total: pending.length,
    done: 0,
    completed: new Set(),
    startedAt: Date.now(),
  };
  root.classList.add('active');
  root.setAttribute('aria-valuenow', '0');
  label.textContent = `準備讀取${strat?.name || ''}資料（0/${tracker.total}）`;
  percent.textContent = '0%';
  bar.style.width = '0%';
  return tracker;
}

function updateLoadProgressLabel(tracker, key) {
  if (!tracker || tracker.id !== loadProgressSerial) return;
  const label = document.getElementById('loadProgressLabel');
  if (label) label.textContent = `正在讀取：${RESOURCE_LABELS[key] || key}（${tracker.done}/${tracker.total}）`;
}

function completeLoadProgressItem(tracker, key) {
  if (!tracker || tracker.id !== loadProgressSerial || tracker.completed.has(key)) return;
  tracker.completed.add(key);
  tracker.done += 1;
  const value = Math.min(100, Math.round(tracker.done / tracker.total * 100));
  const root = document.getElementById('loadProgress');
  const label = document.getElementById('loadProgressLabel');
  const percent = document.getElementById('loadProgressPercent');
  const bar = document.getElementById('loadProgressBar');
  if (root) root.setAttribute('aria-valuenow', String(value));
  if (percent) percent.textContent = `${value}%`;
  if (bar) bar.style.width = `${value}%`;

  if (tracker.done >= tracker.total) {
    if (label) label.textContent = `讀取完成（${tracker.done}/${tracker.total}）`;
    const remaining = Math.max(150, 650 - (Date.now() - tracker.startedAt));
    loadProgressHideTimer = setTimeout(() => {
      if (tracker.id === loadProgressSerial) root?.classList.remove('active');
    }, remaining);
  } else if (label) {
    label.textContent = `${RESOURCE_LABELS[key] || key}完成（${tracker.done}/${tracker.total}）`;
  }
}

function trackDataRequest(promise, tracker, key) {
  updateLoadProgressLabel(tracker, key);
  return promise.finally(() => completeLoadProgressItem(tracker, key));
}

async function fetchDataJson(key, path, requestedKeys, tracker) {
  if (!requestedKeys.has(key)) return JSON_CACHE.get(key) || null;
  if (JSON_CACHE.has(key)) return JSON_CACHE.get(key);
  if (JSON_REQUESTS.has(key)) return trackDataRequest(JSON_REQUESTS.get(key), tracker, key);

  const request = fetch(path)
    .then(response => {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      JSON_CACHE.set(key, data);
      return data;
    })
    .catch(error => {
      console.warn(`資料載入失敗 ${path}:`, error);
      return null;
    })
    .finally(() => JSON_REQUESTS.delete(key));

  JSON_REQUESTS.set(key, request);
  return trackDataRequest(request, tracker, key);
}

function showStrategyLoading(strategyId) {
  const main = document.getElementById('mainContent');
  const strat = STRATEGIES.find(s => s.id === strategyId);
  if (!main) return;
  main.innerHTML = `<div class="coming-soon">
    <div class="coming-icon">${strat?.icon || '…'}</div>
    <div class="coming-title">載入${strat?.name || ''}資料中…</div>
    <div class="coming-desc">第一次開啟會下載這個分頁需要的資料，之後會沿用瀏覽器快取。</div>
  </div>`;
}

async function loadData(strategyId = activeStratId) {
  const requestedKeys = new Set([
    ...(STRATEGY_RESOURCE_KEYS[strategyId] || []),
    'currentPrices',
  ]);
  const progress = beginLoadProgress(strategyId, requestedKeys);

  try {
    const [chipsRes, bhtRes, vsRes, vpbRes, mcRes, entryAnalysisRes, wlRes, intradayRes, kbRes, perfRes, miRes, rtRes, rttRes, bhttRes, yuantaRes, yuantaSnapshotsRes, necklineRes, necklineKbarsRes, nteRes, necklineDailyRankRes] = await Promise.all([
      fetchDataJson('chips', 'data/chips_big_holder.json', requestedKeys, progress),
      fetchDataJson('bigHolderTrend', 'data/big_holder_trend.json', requestedKeys, progress),
      fetchDataJson('volumeSignal', 'data/volume_signal.json', requestedKeys, progress),
      fetchDataJson('volumePullback', 'data/volume_pullback.json', requestedKeys, progress),
      fetchDataJson('momentum', 'data/momentum_candidates.json', requestedKeys, progress),
      fetchDataJson('entryAnalysis', 'data/daily_entry_analysis.json', requestedKeys, progress),
      fetchDataJson('watchlist', 'data/watchlist.json', requestedKeys, progress),
      fetchDataJson('intraday', 'data/intraday_candidates.json', requestedKeys, progress),
      fetchDataJson('kbars', 'data/shioaji_kbars.json', requestedKeys, progress),
      fetchDataJson('perf', 'data/performance.json', requestedKeys, progress),
      fetchDataJson('marketIndex', 'data/market_index.json', requestedKeys, progress),
      fetchDataJson('rightTop', 'data/right_top.json', requestedKeys, progress),
      fetchDataJson('rightTopTrack', 'data/right_top_track.json', requestedKeys, progress),
      fetchDataJson('bigHolderTrendTrack', 'data/big_holder_trend_track.json', requestedKeys, progress),
      fetchDataJson('yuanta', 'data/yuanta_portfolio.json', requestedKeys, progress),
      fetchDataJson('yuantaSnapshots', 'data/yuanta_account_snapshots.json', requestedKeys, progress),
      fetchDataJson('neckline', 'data/neckline_candidates.json', requestedKeys, progress),
      fetchDataJson('necklineKbars', 'data/neckline_kbars.json', requestedKeys, progress),
      fetchDataJson('necklineTrack', 'data/neckline_track.json', requestedKeys, progress),
      fetchDataJson('necklineDailyRank', 'data/neckline_daily_rank.json', requestedKeys, progress),
    ]);

    if (chipsRes && chipsRes.results) {
      DATA.chips_big_holder_data = chipsRes.results.map(d => {
        const t1 = d.big_trend_1000;
        const t4 = d.big_trend_400;
        return {
          ...d,
          chg_2w_1000: t1 && t1.length >= 4 ? +(t1[3] - t1[1]).toFixed(2) : null,
          chg_2w_400:  t4 && t4.length >= 4 ? +(t4[3] - t4[1]).toFixed(2) : null,
        };
      });
      const strat = STRATEGIES.find(s => s.id === 'chips_big_holder');
      if (strat) {
        strat.dataUpdated  = (chipsRes.updated      || '').slice(0, 10) || strat.dataUpdated;
        strat.priceUpdated = (chipsRes.price_updated || '').slice(0, 10) || '';
      }
    }

    if (bhtRes && bhtRes.results) {
      DATA.big_holder_trend_data = bhtRes.results;
      DATA.big_holder_trend_meta = bhtRes;
      const strat = STRATEGIES.find(s => s.id === 'big_holder_trend');
      if (strat) strat.dataUpdated = (bhtRes.source_date || bhtRes.updated || '').slice(0, 10) || strat.dataUpdated;
    }

    if (vsRes && vsRes.results) {
      DATA.volume_signal_data = vsRes.results;
      const strat = STRATEGIES.find(s => s.id === 'volume_signal');
      if (strat) strat.dataUpdated = (vsRes.updated || '').slice(0, 10) || strat.dataUpdated;
    }

    if (vpbRes && (vpbRes.active || vpbRes.failed)) {
      DATA.volume_pullback_data = vpbRes;
      const strat = STRATEGIES.find(s => s.id === 'volume_pullback');
      if (strat) strat.dataUpdated = (vpbRes.updated || '').slice(0, 10) || strat.dataUpdated;
    }

    if (mcRes && mcRes.results) {
      DATA.momentum_candidates_data = mcRes;
    }

    if (entryAnalysisRes && entryAnalysisRes.analysis_date) {
      DATA.daily_entry_analysis_data = entryAnalysisRes;
    }

    if (wlRes && (wlRes.active || wlRes.expired)) {
      DATA.watchlist_data = wlRes;
    }

    if (intradayRes && (intradayRes.results || intradayRes.focus_results)) {
      DATA.intraday_candidates_data = intradayRes;
      const strat = STRATEGIES.find(s => s.id === 'intraday_candidates');
      if (strat) strat.dataUpdated = (intradayRes.updated || intradayRes.date || '').slice(0, 16) || strat.dataUpdated;
    }

    if (kbRes && kbRes.stocks) {
      DATA.stock_kbars_data = kbRes;
    }

    if (necklineRes && necklineRes.summary) {
      DATA.neckline_candidates_data = necklineRes;
      const strat = STRATEGIES.find(s => s.id === 'neckline');
      if (strat) strat.dataUpdated = (necklineRes.updated || '').slice(0, 10) || strat.dataUpdated;
    }

    if (necklineKbarsRes && necklineKbarsRes.stocks) {
      DATA.neckline_kbars_data = necklineKbarsRes;
    }

    if (necklineDailyRankRes && Array.isArray(necklineDailyRankRes.rows)) {
      DATA.neckline_daily_rank_data = necklineDailyRankRes;
    }

    if (perfRes) {
      DATA.performance_data = perfRes;
    }

    if (yuantaRes && yuantaRes.meta) {
      DATA.yuanta_portfolio = yuantaRes;
    }

    if (yuantaSnapshotsRes && Array.isArray(yuantaSnapshotsRes.snapshots)) {
      DATA.yuanta_account_snapshots = yuantaSnapshotsRes;
    }

    if (miRes && miRes.indices) {
      DATA.market_index_data = miRes;
    }

    if (rtRes && rtRes.results) {
      DATA.right_top_data     = rtRes.results;
      DATA.right_top_industry = rtRes.industry_stats || [];
      const strat = STRATEGIES.find(s => s.id === 'right_top');
      if (strat) strat.dataUpdated = (rtRes.updated || '').slice(0, 10) || strat.dataUpdated;
    }

    const ssrStrat = STRATEGIES.find(s => s.id === 'ssr');
    if (ssrStrat) {
      const dates = ['chips_big_holder', 'right_top']
        .map(id => STRATEGIES.find(s => s.id === id)?.dataUpdated)
        .filter(d => d && d !== '載入中...');
      ssrStrat.dataUpdated = dates.length ? dates.sort().slice(-1)[0] : ssrStrat.dataUpdated;
    }

    if (rttRes && (rttRes.active || rttRes.expired)) {
      DATA.right_top_track_data = rttRes;
    }

    if (nteRes && (nteRes.active || nteRes.expired)) {
      DATA.neckline_track_data = nteRes;
      const strat = STRATEGIES.find(s => s.id === 'neckline_track');
      if (strat) strat.dataUpdated = (nteRes.last_updated || '').slice(0, 10) || strat.dataUpdated;
    }

    if (bhttRes && (bhttRes.active || bhttRes.expired)) {
      DATA.big_holder_trend_track_data = bhttRes;
      const strat = STRATEGIES.find(s => s.id === 'big_holder_trend_track');
      if (strat) strat.dataUpdated = (bhttRes.last_updated || '').slice(0, 10) || strat.dataUpdated;
    }

  } catch (e) {
    console.error('資料載入失敗:', e);
  }

  // 套用最新現價（若 current_prices.json 存在且日期在今日或昨日）
  try {
    const cpData = await fetchDataJson('currentPrices', 'data/current_prices.json', requestedKeys, progress);
    if (cpData) DATA.current_prices_data = cpData;
    if (cpData?.prices) {
        const today = dateTW();
        const yesterday = dateTW(-1);
        if (cpData.date === today || cpData.date === yesterday) {
          if (typeof _applyPriceToChips    === 'function') _applyPriceToChips(cpData.prices);
          if (typeof _applyPriceToVolumeSignal === 'function') _applyPriceToVolumeSignal(cpData.prices);
          // DISABLED / BACKUP - DO NOT DELETE: VCP price patching is paused while the tab is hidden.
          if (typeof _applyPriceToRightTop === 'function') _applyPriceToRightTop(cpData.prices);
          if (typeof _applyPriceToBigHolderTrend === 'function') _applyPriceToBigHolderTrend(cpData.prices);
          if (typeof _applyPriceToRttTrack === 'function') _applyPriceToRttTrack(cpData.prices);
          if (typeof _applyPriceToBhtTrack === 'function') _applyPriceToBhtTrack(cpData.prices);
          // DISABLED / BACKUP - DO NOT DELETE: institutional momentum price patching is paused while the tab is hidden.
          if (typeof _applyPriceToAnalysis === 'function') _applyPriceToAnalysis(cpData.prices);
          if (typeof _applyPriceToWatchlist === 'function') _applyPriceToWatchlist(cpData.prices);
          if (typeof _applyPriceToPerf === 'function') await _applyPriceToPerf(cpData.prices, cpData.date, false);
        }
    }
  } catch (e) {
    console.warn('current_prices.json 套用失敗:', e);
  }

  // 資料載入完成後渲染
  if (activeStratId === strategyId) {
    renderNav();
    renderStrategy();
  }
}

// app.js is loaded before the page renderers. With warm local caches, loadData()
// can otherwise finish before render-perf.js/render-candidates.js are defined.
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => loadData(), { once: true });
} else {
  loadData();
}
