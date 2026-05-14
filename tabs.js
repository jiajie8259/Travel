/**
 * tracker.js — 消費回饋追蹤器引擎（所有行程頁共用）
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  每個行程頁需在載入本檔案「之前」先定義：            │
 * │                                                     │
 * │  const TRIP_CONFIG = {                              │
 * │    storageKey:  'tokyo26',      // localStorage 前綴 │
 * │    exportName:  '東京記帳',      // xlsx 檔名前綴    │
 * │    dayLabels:   {               // spotId 前兩碼 → 顯示文字 │
 * │      d1: 'D1 4/16',             │
 * │      d2: 'D2 4/17',             │
 * │    },                           │
 * │    dayOrder: ['D1 …','D2 …',…], // ledger 分群排序  │
 * │    freeDays: ['d1','d2','d3',…], // 自由記帳的 day key │
 * │    TRACKER_CAPS:  { … },        // 信用卡設定        │
 * │    TRACKER_SPOTS: { … },        // 據點設定          │
 * │    CARD_CHIP_STYLE: { … },      // 各卡晶片 inline CSS │
 * │  };                             │
 * └─────────────────────────────────────────────────────┘
 *
 * 依賴：
 *   - HTML 中存在 tracker-bar、tracker-modal、ledger-overlay、
 *     free-modal、reset-confirm-overlay 等元素
 *   - ExcelJS（tracker bar 的「匯出」按鈕會用到）
 */

/* ══════════════════════════════════════
   1. 全域狀態
   ══════════════════════════════════════ */
let trackerUsed    = {};   // { cardKey: rebateUsed }
let trackerLogs    = {};   // { spotId: [ {jpy, twd, rebate, payUsed}, … ] }
let trackerActive  = false;
let trackerPendingSpot   = null;
let trackerSelectedPay   = null;

let freeLogs       = {};   // { dayKey: [ {name, jpy, twd, rebate, payUsed}, … ] }
let freePendingDay = null;
let freeSelectedPay      = 'eco';

let skipState      = {};   // { spotRowId: true }

let TRACKER_JPY_TWD_LIVE = 0.201; // 備援預設值（¥100 = NT$20.10）

/* ══════════════════════════════════════
   2. 簡便存取 TRIP_CONFIG 欄位
   ══════════════════════════════════════ */
function TC()   { return window.TRIP_CONFIG; }
function CAPS() { return TC().TRACKER_CAPS; }
function SPOTS(){ return TC().TRACKER_SPOTS; }
function CHIPS(){ return TC().CARD_CHIP_STYLE; }

/* ══════════════════════════════════════
   3. 即時匯率
   ══════════════════════════════════════ */
async function fetchBOTRate() {
  // 策略1: open.er-api.com（完全免費，無 key，每日更新）
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY',
      { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      const twd = d?.rates?.TWD;
      if (twd && twd > 0) { TRACKER_JPY_TWD_LIVE = twd; updateRateDisplay('open.er-api'); return; }
    }
  } catch(e) {}

  // 策略2: jsdelivr + fawazahmed0
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json',
      { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      const twd = d?.jpy?.twd;
      if (twd && twd > 0) { TRACKER_JPY_TWD_LIVE = twd; updateRateDisplay('fawazahmed0'); return; }
    }
  } catch(e) {}

  // 策略3: fawazahmed0 daily
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/jpy.min.json`,
      { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const d = await res.json();
      const twd = d?.jpy?.twd;
      if (twd && twd > 0) { TRACKER_JPY_TWD_LIVE = twd; updateRateDisplay('fawazahmed0-daily'); return; }
    }
  } catch(e) {}

  updateRateDisplay('fallback');
}

function updateRateDisplay(source) {
  const el = document.getElementById('tracker-rate-display');
  if (!el) return;
  const rate100 = (TRACKER_JPY_TWD_LIVE * 100).toFixed(2);
  if (source === 'fallback') {
    el.textContent = `¥100 ≒ NT$${rate100}（預設值）`;
    el.style.color = '#f0c040';
  } else {
    el.textContent = `¥100 = NT$${rate100}　即時匯率 ✓`;
    el.style.color = '#6ec88a';
  }
}

/* ══════════════════════════════════════
   4. 持久化（localStorage）
   ══════════════════════════════════════ */
function trackerSaveState() {
  const k = TC().storageKey;
  try { localStorage.setItem(`${k}_tracker_used`, JSON.stringify(trackerUsed)); } catch(e) {}
  try { localStorage.setItem(`${k}_tracker_logs`, JSON.stringify(trackerLogs)); } catch(e) {}
}
function trackerLoadState() {
  const k = TC().storageKey;
  try { const u = localStorage.getItem(`${k}_tracker_used`); if (u) trackerUsed = JSON.parse(u); } catch(e) {}
  try { const l = localStorage.getItem(`${k}_tracker_logs`); if (l) trackerLogs = JSON.parse(l); } catch(e) {}
}
function freeLogsSave() {
  try { localStorage.setItem(`${TC().storageKey}_free_logs`, JSON.stringify(freeLogs)); } catch(e) {}
}
function freeLogsLoad() {
  try { const d = localStorage.getItem(`${TC().storageKey}_free_logs`); if (d) freeLogs = JSON.parse(d); } catch(e) {}
}
function skipSave() {
  try { localStorage.setItem(`${TC().storageKey}_skip`, JSON.stringify(skipState)); } catch(e) {}
}
function skipLoad() {
  try { const d = localStorage.getItem(`${TC().storageKey}_skip`); if (d) skipState = JSON.parse(d); } catch(e) {}
}

/* ══════════════════════════════════════
   5. Tracker 啟動
   ══════════════════════════════════════ */
function trackerActivate() {
  trackerActive = true;
  trackerLoadState();
  freeLogsLoad();
  skipLoad();
  fetchBOTRate();
  document.getElementById('tracker-bar').classList.add('visible');
  trackerRenderDashboard();
  trackerRenderAllSpotStatuses();
  skipInjectButtons();
  skipApplyAll();
  skipSetPanelClass(true);
  document.querySelectorAll('.add-btn').forEach(b => b.style.display = 'inline-flex');
  document.querySelectorAll('#pay-panel-itinerary .spot-row.skipped .add-btn')
    .forEach(b => b.style.display = 'none');
  trackerRenderAllLogs();
  freeStripsShow();
  freeRenderAllDayLogs();
}

/* ══════════════════════════════════════
   6. Dashboard 渲染
   ══════════════════════════════════════ */
function trackerRenderDashboard() {
  const container = document.getElementById('tracker-cards');
  if (!container) return;
  container.innerHTML = Object.entries(CAPS())
    .filter(([, cfg]) => !cfg.noRebate)
    .map(([key, cfg]) => {
      const u       = trackerUsed[key] || 0;
      const pct     = cfg.unlimited ? 0 : Math.min(100, (u / cfg.cap) * 100);
      const barCls  = cfg.unlimited ? 'ok' : (pct >= 100 ? 'full' : pct >= 70 ? 'warn' : 'ok');
      const cardCls = cfg.unlimited ? '' : (pct >= 100 ? 'exhausted' : pct >= 70 ? 'warning' : '');
      const pctLbl  = cfg.unlimited ? '無上限' : (pct >= 100 ? '已用盡' : `${Math.round(pct)}%`);
      const rateLbl = key === 'rich' ? '淨1.8%' : `${(cfg.rate * 100).toFixed(1)}%`;
      return `
      <div class="tracker-card ${cardCls}" id="tc-${key}">
        <div class="tc-head">
          <span class="tc-name">${cfg.label} <span style="font-size:0.58rem;opacity:0.7;">${rateLbl}</span></span>
          <span class="tc-pct ${barCls}">${pctLbl}</span>
        </div>
        ${!cfg.unlimited ? `
        <div class="tc-bar-track"><div class="tc-bar-fill ${barCls}" id="tbar-${key}" style="width:${pct}%"></div></div>
        <div class="tc-amounts">
          <span class="tc-used">已用 NT$${u.toFixed(0)}</span>
          <span class="tc-cap">上限 NT$${cfg.cap}</span>
        </div>` : `
        <div style="font-size:0.62rem;color:#555;margin-top:0.25rem;font-family:'DM Mono',monospace;">無回饋上限 · 已記 NT$${u.toFixed(0)}</div>`}
      </div>`;
    }).join('');
}

function trackerUpdateDashboard(key) {
  const cfg    = CAPS()[key];
  const u      = trackerUsed[key] || 0;
  const pct    = cfg.unlimited ? 0 : Math.min(100, (u / cfg.cap) * 100);
  const barCls = cfg.unlimited ? 'ok' : (pct >= 100 ? 'full' : pct >= 70 ? 'warn' : 'ok');
  const pctLbl = cfg.unlimited ? '無上限' : (pct >= 100 ? '已用盡' : `${Math.round(pct)}%`);
  const card   = document.getElementById(`tc-${key}`);
  if (!card) return;
  card.className = `tracker-card ${cfg.unlimited ? '' : (pct >= 100 ? 'exhausted' : pct >= 70 ? 'warning' : '')}`;
  card.querySelector('.tc-pct').textContent = pctLbl;
  card.querySelector('.tc-pct').className   = `tc-pct ${barCls}`;
  const bar  = document.getElementById(`tbar-${key}`);
  if (bar) { bar.style.width = pct + '%'; bar.className = `tc-bar-fill ${barCls}`; }
  const used = card.querySelector('.tc-used');
  if (used) used.textContent = `已用 NT$${u.toFixed(0)}`;
}

/* ══════════════════════════════════════
   7. 據點狀態
   ══════════════════════════════════════ */
function trackerGetEffectivePay(spotId) {
  const s = SPOTS()[spotId];
  if (!s) return null;
  const pri = CAPS()[s.primary];
  if (!pri.unlimited && (trackerUsed[s.primary] || 0) >= pri.cap) {
    const fb = CAPS()[s.fallback];
    if (!fb.unlimited && (trackerUsed[s.fallback] || 0) >= fb.cap) {
      return { pay: 'rich', primaryExhausted: true, fallbackExhausted: true };
    }
    return { pay: s.fallback, primaryExhausted: true, fallbackExhausted: false };
  }
  return { pay: s.primary, primaryExhausted: false, fallbackExhausted: false };
}

function trackerRenderSpotStatus(spotId) {
  const s   = SPOTS()[spotId];
  if (!s) return;
  const col = document.getElementById(`paycol-${spotId}`);
  if (!col) return;
  const eff        = trackerGetEffectivePay(spotId);
  const priCfg     = CAPS()[s.primary];
  const u          = trackerUsed[s.primary] || 0;
  const rebateLeft = priCfg.unlimited ? Infinity : Math.max(0, priCfg.cap - u);
  const spendTWD   = priCfg.unlimited ? Infinity : Math.round(rebateLeft / priCfg.rate);
  const spendJPY   = priCfg.unlimited ? Infinity : Math.round(spendTWD / TRACKER_JPY_TWD_LIVE);

  let statusHtml = '', fallbackHtml = '';
  if (eff.primaryExhausted) {
    statusHtml = `<span class="pay-status-chip chip-exhausted">額度已用盡</span>`;
    const fbCfg  = CAPS()[s.fallback];
    const fbRate = s.fallback === 'rich' ? '淨1.8%' : '5%';
    fallbackHtml = `<div class="fallback-pay show">↪ 改用 ${fbCfg.label}<br><span style="font-family:'DM Mono',monospace;font-weight:700;color:#b8860b;">${fbRate}</span></div>`;
  } else {
    const pct     = priCfg.unlimited ? 0 : (u / priCfg.cap) * 100;
    const chipCls = pct >= 70 ? 'chip-warn' : 'chip-ok';
    statusHtml = priCfg.unlimited
      ? `<span class="pay-status-chip chip-ok">無上限</span>`
      : `<span class="pay-status-chip ${chipCls}" title="回饋剩餘 NT$${rebateLeft.toFixed(0)}｜可刷 NT$${spendTWD.toLocaleString()}">
           <span style="font-size:0.72rem;opacity:0.75;display:block;line-height:1.2;">還能刷</span>
           <span style="font-size:1rem;font-weight:900;font-family:'DM Mono',monospace;line-height:1.2;">¥${spendJPY.toLocaleString()}</span>
         </span>`;
  }

  // 保留原始 .pb / .pb-rate 標籤
  let pbHtml = '';
  col.querySelectorAll('.pb:not(.pay-status-chip), .pb-rate').forEach(el => pbHtml += el.outerHTML);
  col.innerHTML = pbHtml + statusHtml + fallbackHtml;
}

function trackerRenderAllSpotStatuses() {
  Object.keys(SPOTS()).forEach(id => trackerRenderSpotStatus(id));
}

/* ══════════════════════════════════════
   8. Log 渲染
   ══════════════════════════════════════ */
function trackerRenderLogs(spotId) {
  const el = document.getElementById(`logs-${spotId}`);
  if (!el) return;
  const entries = trackerLogs[spotId] || [];
  if (entries.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = entries.map((e, i) => `
    <div class="log-entry">
      <span>¥${e.jpy.toLocaleString()}</span>
      <span>→</span>
      <span class="log-amt">NT$${e.twd.toFixed(0)}</span>
      <span class="log-rebate">回饋 NT$${e.rebate.toFixed(1)}</span>
      <span style="font-size:0.58rem;color:#aaa;">(${CAPS()[e.payUsed]?.label || e.payUsed})</span>
      <button class="log-del" onclick="trackerDeleteLog('${spotId}',${i})" title="刪除">✕</button>
    </div>`).join('');
  const btn = document.getElementById(`btn-${spotId}`);
  if (btn) { btn.classList.add('logged'); btn.textContent = `＋ 記帳 (${entries.length}筆)`; }
}

function trackerRenderAllLogs() {
  Object.keys(trackerLogs).forEach(id => trackerRenderLogs(id));
}

/* ══════════════════════════════════════
   9. Modal — 開啟 / 預覽 / 確認 / 關閉
   ══════════════════════════════════════ */
function trackerGetSelectedPayKey() {
  return trackerSelectedPay ||
    (trackerPendingSpot ? trackerGetEffectivePay(trackerPendingSpot).pay : null);
}

function trackerRenderPaySelector(recommendedKey) {
  const container = document.getElementById('tracker-pay-selector');
  if (!container) return;
  const activeKey = trackerSelectedPay || recommendedKey;
  container.innerHTML = Object.entries(CAPS()).map(([key, cfg]) => {
    const isRec    = key === recommendedKey;
    const isActive = key === activeKey;
    let rateLabel;
    if (cfg.noRebate)        rateLabel = '無回饋';
    else if (key === 'rich') rateLabel = '淨1.8%';
    else if (key === 'kuma') rateLabel = '8.5%⚠';
    else                     rateLabel = `${(cfg.rate * 100).toFixed(1)}%`;
    const tooltip = key === 'kuma'
      ? '⚠ 須滿足：① 完成活動登錄 ② 指定商店通路 ③ 持實體卡刷（非玉山Wallet）'
      : (cfg.feeNote || '');
    return `<button
      class="pay-sel-btn${isActive ? ` active-${key}` : ''}${isRec ? ' recommended' : ''}"
      onclick="trackerSelectPay('${key}')"
      title="${tooltip}"
    >${cfg.label} ${rateLabel}${isRec ? ' ★' : ''}</button>`;
  }).join('');
}

function trackerSelectPay(key) {
  trackerSelectedPay = key;
  trackerRenderPaySelector(trackerGetEffectivePay(trackerPendingSpot).pay);
  trackerUpdatePreview();
}

function trackerOpenModal(spotId) {
  if (!trackerActive) { trackerActivate(); }
  trackerPendingSpot  = spotId;
  trackerSelectedPay  = null;
  const s   = SPOTS()[spotId];
  const eff = trackerGetEffectivePay(spotId);
  document.getElementById('tracker-modal-title').textContent = s.name;
  document.getElementById('tracker-modal-sub').innerHTML =
    eff.primaryExhausted
      ? `<span style="color:var(--red);font-size:0.72rem;">⚠ ${CAPS()[s.primary].label} 額度已用盡，推薦已自動切換</span>`
      : '';
  trackerRenderPaySelector(eff.pay);
  document.getElementById('tracker-modal-amount').value = '';
  trackerUpdatePreview();
  document.getElementById('tracker-modal').classList.add('open');
  setTimeout(() => document.getElementById('tracker-modal-amount').focus(), 100);
}

function trackerUpdatePreview() {
  if (!trackerPendingSpot) return;
  const selectedKey = trackerGetSelectedPayKey();
  const payCfg      = CAPS()[selectedKey];
  const jpy         = parseFloat(document.getElementById('tracker-modal-amount').value) || 0;
  const twd         = jpy * TRACKER_JPY_TWD_LIVE;

  if (payCfg.noRebate) {
    document.getElementById('tracker-modal-preview').innerHTML = jpy === 0
      ? `<span style="color:#888;font-size:0.72rem;">此支付方式無回饋，僅記錄支出金額</span>`
      : `消費 ¥${jpy.toLocaleString()} ≒ NT$${Math.round(twd).toLocaleString()}<br>
         <span style="color:#aaa;font-size:0.72rem;">無回饋 · 僅作支出記帳</span>`;
    return;
  }

  const maxRebate  = payCfg.unlimited ? Infinity : Math.max(0, payCfg.cap - (trackerUsed[selectedKey] || 0));
  const rebate     = Math.min(twd * payCfg.rate, maxRebate);
  const newTotal   = (trackerUsed[selectedKey] || 0) + rebate;
  const pctAfter   = payCfg.unlimited ? 0 : Math.min(100, (newTotal / payCfg.cap) * 100);
  const rebateLeft = payCfg.unlimited ? Infinity : Math.max(0, payCfg.cap - (trackerUsed[selectedKey] || 0));
  const spendLeftJPY = payCfg.unlimited ? null : Math.round((rebateLeft / payCfg.rate) / TRACKER_JPY_TWD_LIVE);

  const remainHtml = payCfg.unlimited
    ? `<span style="color:#6ec88a;font-size:0.72rem;">無上限</span>`
    : `還能刷 <strong>¥${spendLeftJPY.toLocaleString()}</strong>（回饋剩 NT$${rebateLeft.toFixed(0)}）`;

  const kumaWarn = selectedKey === 'kuma'
    ? `<div style="font-size:0.68rem;color:#b8680b;margin-top:0.3rem;line-height:1.5;">
         ⚠ 須：① 完成活動登錄 ② 指定商店通路 ③ 持實體卡刷（非玉山Wallet）</div>` : '';

  let warnHtml = '';
  if (!payCfg.unlimited && pctAfter >= 100) {
    warnHtml = `<div class="prev-warn">⚠ 此筆後 ${payCfg.label} 額度將用盡</div>`;
  } else if (!payCfg.unlimited && pctAfter >= 70) {
    const afterLeft = Math.max(0, payCfg.cap - newTotal);
    const afterJPY  = Math.round((afterLeft / payCfg.rate) / TRACKER_JPY_TWD_LIVE);
    warnHtml = `<div class="prev-warn">⚠ 此筆後還能刷約 <strong>¥${afterJPY.toLocaleString()}</strong>（回饋剩 NT$${afterLeft.toFixed(0)}）</div>`;
  }

  document.getElementById('tracker-modal-preview').innerHTML = jpy === 0
    ? `<span style="color:#888;font-size:0.78rem;">${remainHtml}<br>輸入日幣金額預覽回饋</span>${kumaWarn}`
    : `消費 ¥${jpy.toLocaleString()} ≒ NT$${Math.round(twd).toLocaleString()}<br>
       回饋率 <span class="prev-rate">${(payCfg.rate * 100).toFixed(1)}%</span>　
       預估回饋 <span class="prev-rebate">NT$${rebate.toFixed(1)}</span><br>
       ${remainHtml}${warnHtml}${kumaWarn}`;
}

function trackerCloseModal() {
  document.getElementById('tracker-modal').classList.remove('open');
  trackerPendingSpot = null;
  trackerSelectedPay = null;
}

function trackerConfirmLog() {
  const jpy = parseFloat(document.getElementById('tracker-modal-amount').value);
  if (!jpy || jpy <= 0 || !trackerPendingSpot) return;
  const selectedKey = trackerGetSelectedPayKey();
  const payCfg      = CAPS()[selectedKey];
  const twd         = jpy * TRACKER_JPY_TWD_LIVE;
  let rebate = 0;
  if (!payCfg.noRebate) {
    const max = payCfg.unlimited ? twd * payCfg.rate : Math.max(0, payCfg.cap - (trackerUsed[selectedKey] || 0));
    rebate = Math.min(twd * payCfg.rate, max);
    if (!trackerUsed[selectedKey]) trackerUsed[selectedKey] = 0;
    trackerUsed[selectedKey] += rebate;
  }
  if (!trackerLogs[trackerPendingSpot]) trackerLogs[trackerPendingSpot] = [];
  trackerLogs[trackerPendingSpot].push({ jpy, twd, rebate, payUsed: selectedKey });
  trackerSaveState();
  const spot = trackerPendingSpot;
  trackerCloseModal();
  if (!payCfg.noRebate) trackerUpdateDashboard(selectedKey);
  trackerRenderAllSpotStatuses();
  trackerRenderLogs(spot);
}

function trackerDeleteLog(spotId, idx) {
  const e   = trackerLogs[spotId]?.[idx];
  if (!e) return;
  const cfg = CAPS()[e.payUsed];
  if (!cfg?.noRebate) trackerUsed[e.payUsed] = Math.max(0, (trackerUsed[e.payUsed] || 0) - e.rebate);
  trackerLogs[spotId].splice(idx, 1);
  if (trackerLogs[spotId].length === 0) delete trackerLogs[spotId];
  trackerSaveState();
  if (!cfg?.noRebate) trackerUpdateDashboard(e.payUsed);
  trackerRenderAllSpotStatuses();
  trackerRenderLogs(spotId);
  if (document.getElementById('ledger-overlay').classList.contains('open')) ledgerRender();
}

/* ══════════════════════════════════════
   10. 重置確認
   ══════════════════════════════════════ */
function resetConfirmOpen()  { document.getElementById('reset-confirm-overlay').classList.add('open'); }
function resetConfirmClose() { document.getElementById('reset-confirm-overlay').classList.remove('open'); }
function resetConfirmDo()    { resetConfirmClose(); trackerResetAll(); }

function trackerResetAll() {
  // 依 CAPS 初始化各 key
  trackerUsed = Object.fromEntries(Object.keys(CAPS()).map(k => [k, 0]));
  trackerLogs = {};
  freeLogs    = {};
  trackerSaveState();
  freeLogsSave();
  trackerRenderDashboard();
  trackerRenderAllSpotStatuses();
  document.querySelectorAll('.log-list').forEach(el => el.innerHTML = '');
  document.querySelectorAll('.add-btn').forEach(b => {
    b.classList.remove('logged');
    b.textContent = '＋ 記帳';
  });
  document.querySelectorAll('#pay-panel-itinerary .spot-row.skipped .add-btn')
    .forEach(b => b.style.display = 'none');
  freeRenderAllDayLogs();
}

/* ══════════════════════════════════════
   11. 消費明細（Ledger）
   ══════════════════════════════════════ */
function getSpotDay(spotId) {
  const prefix = spotId.slice(0, 2);
  const labels = TC().dayLabels;
  return labels[prefix] || '其他';
}

function ledgerOpen()  { ledgerRender(); document.getElementById('ledger-overlay').classList.add('open'); }
function ledgerClose() { document.getElementById('ledger-overlay').classList.remove('open'); }

function ledgerRender() {
  const body = document.getElementById('ledger-body');

  // 收集所有記帳
  let all = [];
  Object.entries(trackerLogs).forEach(([spotId, entries]) =>
    entries.forEach((e, idx) => all.push({
      spotId, idx, ...e,
      day: getSpotDay(spotId),
      spotName: SPOTS()[spotId]?.name || spotId,
      isFree: false
    }))
  );
  Object.entries(freeLogs).forEach(([day, entries]) =>
    entries.forEach((e, idx) => all.push({
      spotId: `free-${day}`, idx, ...e,
      day: getSpotDay(day),
      spotName: e.name,
      isFree: true
    }))
  );

  if (all.length === 0) {
    body.innerHTML = `<div class="ledger-empty">📭 尚無記帳記錄<br><span style="font-size:0.7rem;">按各據點的「＋ 記帳」開始記錄</span></div>`;
    return;
  }

  const totalJPY    = all.reduce((s, e) => s + e.jpy,    0);
  const totalTWD    = all.reduce((s, e) => s + e.twd,    0);
  const totalRebate = all.reduce((s, e) => s + e.rebate, 0);

  // 各卡回饋小計
  const cardRebate = {};
  all.forEach(e => { if (e.rebate > 0) cardRebate[e.payUsed] = (cardRebate[e.payUsed] || 0) + e.rebate; });

  let summaryHtml = `
    <div class="ledger-summary-bar">
      <div class="ledger-sum-card">
        <div class="ledger-sum-label">總消費（日圓）</div>
        <div class="ledger-sum-val">¥${totalJPY.toLocaleString()}</div>
        <div class="ledger-sum-sub">≒ NT$${Math.round(totalTWD).toLocaleString()}</div>
      </div>
      <div class="ledger-sum-card">
        <div class="ledger-sum-label">累積回饋</div>
        <div class="ledger-sum-val" style="color:#27ae60;">NT$${totalRebate.toFixed(1)}</div>
        <div class="ledger-sum-sub">共 ${all.length} 筆消費</div>
      </div>
    </div>
    <div class="ledger-card-breakdown">
      ${Object.entries(cardRebate).map(([key, val]) => {
        const cfg = CAPS()[key];
        return `<span class="ledger-card-chip" style="${CHIPS()[key] || ''}">${cfg?.label || key} 回饋 NT$${val.toFixed(1)}</span>`;
      }).join('')}
    </div>`;

  // 按天分組
  const dayOrder = TC().dayOrder;
  const byDay    = {};
  all.forEach(e => { (byDay[e.day] = byDay[e.day] || []).push(e); });

  let daysHtml = '';
  dayOrder.forEach(day => {
    const entries = byDay[day];
    if (!entries) return;
    const dayJPY    = entries.reduce((s, e) => s + e.jpy,    0);
    const dayRebate = entries.reduce((s, e) => s + e.rebate, 0);

    const rowsHtml = entries.map(e => {
      const cfg         = CAPS()[e.payUsed];
      const rebateDisp  = (cfg?.noRebate || e.rebate === 0)
        ? `<span style="color:#bbb;font-size:0.65rem;">無回饋</span>`
        : `<span class="ledger-rebate">+NT$${e.rebate.toFixed(1)}</span>`;
      const freeTag     = e.isFree
        ? `<span style="font-family:'DM Mono',monospace;font-size:0.55rem;color:#aaa;background:#f5f0ea;padding:0.1em 0.4em;border-radius:3px;margin-left:0.3rem;">自由記帳</span>` : '';
      const delFn       = e.isFree
        ? `freeDeleteEntry('${e.spotId.replace('free-', '')}',${e.idx})`
        : `ledgerDeleteEntry('${e.spotId}',${e.idx})`;
      return `<div class="ledger-row">
        <div>
          <div class="ledger-spot">${e.spotName}${freeTag}</div>
          <div class="ledger-spot-pay" style="${CHIPS()[e.payUsed] || ''}; padding:0.1em 0.4em; border-radius:3px; display:inline-block; margin-top:0.15rem;">${cfg?.label || e.payUsed}</div>
        </div>
        <div class="ledger-jpy">¥${e.jpy.toLocaleString()}</div>
        ${rebateDisp}
        <button class="ledger-del" onclick="${delFn}" title="刪除此筆">✕</button>
      </div>`;
    }).join('');

    daysHtml += `<div class="ledger-day-block">
      <div class="ledger-day-label">${day}</div>
      ${rowsHtml}
      <div class="ledger-day-total">
        <span>小計</span>
        <span>¥${dayJPY.toLocaleString()} &nbsp;｜&nbsp; 回饋 NT$${dayRebate.toFixed(1)}</span>
      </div>
    </div>`;
  });

  body.innerHTML = summaryHtml + daysHtml;
}

function ledgerDeleteEntry(spotId, idx) {
  if (!trackerLogs[spotId]?.[idx]) return;
  const e   = trackerLogs[spotId][idx];
  const cfg = CAPS()[e.payUsed];
  if (!cfg?.noRebate) trackerUsed[e.payUsed] = Math.max(0, (trackerUsed[e.payUsed] || 0) - e.rebate);
  trackerLogs[spotId].splice(idx, 1);
  if (trackerLogs[spotId].length === 0) delete trackerLogs[spotId];
  trackerSaveState();
  if (!cfg?.noRebate) trackerUpdateDashboard(e.payUsed);
  trackerRenderAllSpotStatuses();
  trackerRenderLogs(spotId);
  ledgerRender();
}

/* ══════════════════════════════════════
   12. 自由記帳
   ══════════════════════════════════════ */
function freeModalOpen(day) {
  if (!trackerActive) trackerActivate();
  freePendingDay  = day;
  freeSelectedPay = 'eco';
  document.getElementById('free-modal-name').value   = '';
  document.getElementById('free-modal-amount').value = '';
  freeRenderPaySelector();
  freeModalUpdatePreview();
  document.getElementById('free-modal').classList.add('open');
  setTimeout(() => document.getElementById('free-modal-name').focus(), 100);
}
function freeModalClose() {
  document.getElementById('free-modal').classList.remove('open');
  freePendingDay = null;
}
function freeRenderPaySelector() {
  const container = document.getElementById('free-pay-selector');
  if (!container) return;
  container.innerHTML = Object.entries(CAPS()).map(([key, cfg]) => {
    const isActive = key === freeSelectedPay;
    let rateLabel;
    if (cfg.noRebate)        rateLabel = '無回饋';
    else if (key === 'rich') rateLabel = '淨1.8%';
    else if (key === 'kuma') rateLabel = '8.5%⚠';
    else                     rateLabel = `${(cfg.rate * 100).toFixed(1)}%`;
    return `<button
      class="pay-sel-btn${isActive ? ` active-${key}` : ''}"
      onclick="freeSelectPay('${key}')"
      title="${cfg.feeNote || ''}"
    >${cfg.label} ${rateLabel}</button>`;
  }).join('');
}
function freeSelectPay(key) {
  freeSelectedPay = key;
  freeRenderPaySelector();
  freeModalUpdatePreview();
}
function freeModalUpdatePreview() {
  const jpy     = parseFloat(document.getElementById('free-modal-amount').value) || 0;
  const cfg     = CAPS()[freeSelectedPay];
  const preview = document.getElementById('free-modal-preview');
  if (!cfg || jpy === 0) { preview.innerHTML = ''; return; }
  const twd = jpy * TRACKER_JPY_TWD_LIVE;
  if (cfg.noRebate) {
    preview.innerHTML = `≒ NT$${Math.round(twd).toLocaleString()} · 無回饋`;
    return;
  }
  const maxRebate = cfg.unlimited ? Infinity : Math.max(0, cfg.cap - (trackerUsed[freeSelectedPay] || 0));
  const rebate    = Math.min(twd * cfg.rate, maxRebate);
  const kumaWarn  = freeSelectedPay === 'kuma'
    ? `<div style="font-size:0.65rem;color:#b8680b;margin-top:0.2rem;">⚠ 須登錄＋指定通路＋實體卡刷</div>` : '';
  preview.innerHTML = `≒ NT$${Math.round(twd).toLocaleString()} · 回饋 <strong style="color:#27ae60;">NT$${rebate.toFixed(1)}</strong>${kumaWarn}`;
}
function freeModalConfirm() {
  const name = document.getElementById('free-modal-name').value.trim() || '其他消費';
  const jpy  = parseFloat(document.getElementById('free-modal-amount').value);
  if (!jpy || jpy <= 0 || !freePendingDay) return;
  const cfg = CAPS()[freeSelectedPay];
  const twd = jpy * TRACKER_JPY_TWD_LIVE;
  let rebate = 0;
  if (!cfg.noRebate) {
    const max = cfg.unlimited ? twd * cfg.rate : Math.max(0, cfg.cap - (trackerUsed[freeSelectedPay] || 0));
    rebate = Math.min(twd * cfg.rate, max);
    trackerUsed[freeSelectedPay] = (trackerUsed[freeSelectedPay] || 0) + rebate;
    trackerSaveState();
    trackerUpdateDashboard(freeSelectedPay);
    trackerRenderAllSpotStatuses();
  }
  if (!freeLogs[freePendingDay]) freeLogs[freePendingDay] = [];
  freeLogs[freePendingDay].push({ name, jpy, twd, rebate, payUsed: freeSelectedPay });
  freeLogsSave();
  const day = freePendingDay;
  freeModalClose();
  freeRenderDayLogs(day);
}
function freeRenderDayLogs(day) {
  const container = document.getElementById(`free-logs-${day}`);
  if (!container) return;
  const entries = freeLogs[day] || [];
  const btn     = document.getElementById(`free-btn-${day}`);
  if (entries.length === 0) {
    container.innerHTML = '';
    if (btn) { btn.classList.remove('has-logs'); btn.textContent = '＋ 新增消費'; }
    return;
  }
  container.innerHTML = entries.map((e, i) => {
    const cfg        = CAPS()[e.payUsed];
    const rebateHtml = (cfg?.noRebate || e.rebate === 0)
      ? `<span class="fle-norebate">無回饋</span>`
      : `<span class="fle-rebate">+NT$${e.rebate.toFixed(1)}</span>`;
    const chipStyle  = CHIPS()[e.payUsed] || '';
    return `<div class="free-log-entry">
      <span class="fle-name">${e.name}</span>
      <span style="${chipStyle}; padding:0.1em 0.4em; border-radius:3px; font-family:'DM Mono',monospace; font-size:0.58rem; font-weight:700;">${cfg?.label || e.payUsed}</span>
      <span class="fle-jpy">¥${e.jpy.toLocaleString()}</span>
      ${rebateHtml}
      <button class="log-del" onclick="freeDeleteEntry('${day}',${i})" title="刪除">✕</button>
    </div>`;
  }).join('');
  if (btn) { btn.classList.add('has-logs'); btn.textContent = `＋ 新增消費（${entries.length}筆）`; }
}
function freeDeleteEntry(day, idx) {
  if (!freeLogs[day]?.[idx]) return;
  const e   = freeLogs[day][idx];
  const cfg = CAPS()[e.payUsed];
  if (!cfg?.noRebate) {
    trackerUsed[e.payUsed] = Math.max(0, (trackerUsed[e.payUsed] || 0) - e.rebate);
    trackerSaveState();
    trackerUpdateDashboard(e.payUsed);
    trackerRenderAllSpotStatuses();
  }
  freeLogs[day].splice(idx, 1);
  freeLogsSave();
  freeRenderDayLogs(day);
  if (document.getElementById('ledger-overlay').classList.contains('open')) ledgerRender();
}
function freeRenderAllDayLogs() {
  (TC().freeDays || []).forEach(d => freeRenderDayLogs(d));
}
function freeStripsShow() {
  document.querySelectorAll('.free-log-strip').forEach(el => el.classList.add('tracker-on'));
}

/* ══════════════════════════════════════
   13. 行程略過標記（Skip）
   ══════════════════════════════════════ */
function skipInjectButtons() {
  document.querySelectorAll('#pay-panel-itinerary .spot-row').forEach((row, i) => {
    const body  = row.querySelector('.spot-body');
    if (!body || body.querySelector('.skip-btn')) return;
    const spotId = body.getAttribute('data-spot') || `generic-row-${i}`;
    row.setAttribute('data-skip-id', spotId);
    const btn    = document.createElement('button');
    btn.className = 'skip-btn';
    btn.setAttribute('data-skip-id', spotId);
    btn.onclick = () => skipToggle(spotId);
    body.appendChild(btn);
  });
}
function skipApplyAll() {
  document.querySelectorAll('#pay-panel-itinerary .spot-row[data-skip-id]').forEach(row => {
    skipApply(row, row.getAttribute('data-skip-id'));
  });
}
function skipApply(row, id) {
  const isSkipped = !!skipState[id];
  const btn = row.querySelector('.skip-btn');
  if (isSkipped) {
    row.classList.add('skipped');
    row.querySelectorAll('.add-btn').forEach(b => b.style.display = 'none');
    if (btn) btn.textContent = '↩ 恢復此行程';
    const body = row.querySelector('.spot-body');
    if (body && !body.querySelector('.skip-badge')) {
      const badge = document.createElement('span');
      badge.className   = 'skip-badge';
      badge.textContent = '未執行';
      body.appendChild(badge);
    }
  } else {
    row.classList.remove('skipped');
    if (trackerActive) row.querySelectorAll('.add-btn').forEach(b => b.style.display = 'inline-flex');
    if (btn) btn.textContent = '✕ 略過此行程';
    row.querySelector('.skip-badge')?.remove();
  }
}
function skipToggle(id) {
  skipState[id] = !skipState[id];
  skipSave();
  const row = document.querySelector(`#pay-panel-itinerary .spot-row[data-skip-id="${id}"]`);
  if (row) skipApply(row, id);
}
function skipSetPanelClass(active) {
  const panel = document.getElementById('pay-panel-itinerary');
  if (!panel) return;
  panel.classList.toggle('tracker-on', active);
}

/* ══════════════════════════════════════
   14. 鍵盤 / 點擊關閉事件
   ══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('free-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) freeModalClose();
  });
  document.getElementById('free-modal-amount')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') freeModalConfirm();
  });
  document.getElementById('tracker-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) trackerCloseModal();
  });
  document.getElementById('tracker-modal-amount')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') trackerConfirmLog();
  });
  document.getElementById('reset-confirm-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) resetConfirmClose();
  });
  document.getElementById('ledger-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) ledgerClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      trackerCloseModal();
      resetConfirmClose();
      ledgerClose();
      freeModalClose();
    }
  });
});

/* ══════════════════════════════════════
   15. 頁面載入後自動還原狀態
   ══════════════════════════════════════ */
window.addEventListener('load', () => {
  fetchBOTRate();
  freeLogsLoad();
  skipLoad();
  const hasFree = Object.values(freeLogs).some(arr => arr.length > 0);
  try {
    const saved  = localStorage.getItem(`${TC().storageKey}_tracker_used`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Object.values(parsed).some(v => v > 0) || hasFree) { trackerActivate(); return; }
    } else if (hasFree) { trackerActivate(); return; }
  } catch(e) {}
  document.querySelectorAll('.add-btn').forEach(b => { b.style.display = 'none'; });
  if (Object.keys(skipState).length > 0) { skipInjectButtons(); skipApplyAll(); }
});
