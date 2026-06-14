/**
 * firebase-editor.js — 美食／交通／飯店／景點／小筆記／航班 編輯器（所有行程頁共用）
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  每個行程頁需在載入本檔案「之前」先定義 TRIP_CONFIG：          │
 * │                                                             │
 * │  TRIP_CONFIG.storageKey  → localStorage key 前綴            │
 * │  TRIP_CONFIG.firebase    → { collection: 'trip_xxx' }       │
 * │  TRIP_CONFIG.editorOptions → {                              │
 * │    days:  ['D1','D2','D3','D4','D5','—'],                  │
 * │    areas: ['京都','名古屋','—'],                             │
 * │  }                                                          │
 * │                                                             │
 * │  行程頁 HTML 還需保留：                                       │
 * │  · Firebase CDN <script> 標籤                               │
 * │  · 各頁籤的 HTML 結構（tbody, thead, toolbar 等）            │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 依賴載入順序：
 *   1. Firebase CDN (firebase-app-compat.js + firebase-firestore-compat.js)
 *   2. 行程 HTML 內的 TRIP_CONFIG 定義（含 firebase.collection）
 *   3. 本檔案 firebase-editor.js
 *   4. tracker.js、export.js、tabs.js
 */

/* ══════════════════════════════════════════════════════════════
   0. Firebase 初始化（共用，只初始化一次）
   ══════════════════════════════════════════════════════════════ */
// firebase-editor.js 不自行初始化 Firebase
// db 由行程 HTML 的 Firebase init script 提供（在本檔案載入之前執行）
// 行程 HTML 需在本檔案前載入 Firebase CDN + 執行 firebase.initializeApp()
// 並宣告 const db = firebase.firestore();

/* ══════════════════════════════════════════════════════════════
   0b. 從 TRIP_CONFIG 取得 editor 設定
   ══════════════════════════════════════════════════════════════ */
function EC() {
  const tc = window.TRIP_CONFIG || {};
  const col = tc.firebase?.collection || tc.storageKey || 'unknown';
  const sk  = tc.storageKey || col;
  const opt = tc.editorOptions || {};
  return {
    col,
    sk,
    days:  opt.days  || ['D1','D2','D3','D4','D5','—'],
    areas: opt.areas || ['—'],
    doc: (name) => (window.db && col) ? window.db.collection(col).doc(name) : null,
    lsKey: (name) => sk + '_' + name,
  };
}

/* ══════════════════════════════════════════════════════════════
   共用工具
   ══════════════════════════════════════════════════════════════ */
function formatTimeRange(val) {
  const digits = val.replace(/\D/g, '');
  if (!digits.length) return val;
  const fmt = s => s.slice(0,2) + ':' + s.slice(2,4);
  if (digits.length === 8) return fmt(digits.slice(0,4)) + '-' + fmt(digits.slice(4,8));
  if (digits.length === 7) return fmt(digits.slice(0,3).padStart(4,'0')) + '-' + fmt(digits.slice(3,7));
  if (digits.length === 6) return fmt((digits.slice(0,2)+'00').slice(0,4)) + '-' + fmt(digits.slice(2,6));
  if (digits.length === 5) return fmt(('0'+digits[0]+'00').slice(0,4)) + '-' + fmt(digits.slice(1,5));
  return fmt(digits.padStart(4,'0'));
}

function setStatus(elId, msg, color) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = msg; el.style.color = color || 'var(--muted)'; }
}

async function pushToFirebase(docRef, data, statusId, lsKey) {
  setStatus(statusId, '💾 儲存中…', '#b8860b');
  try {
    await docRef.set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    try { localStorage.setItem(lsKey, JSON.stringify(data[Object.keys(data)[0]])); } catch(_) {}
    setStatus(statusId, '✓ 已儲存並同步', '#27ae60');
    return true;
  } catch(e) {
    try { localStorage.setItem(lsKey, JSON.stringify(data[Object.keys(data)[0]])); } catch(_) {}
    setStatus(statusId, '⚠ 雲端失敗，已存本機', '#c0392b');
    return false;
  }
}

function savedBtnFeedback(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const prev = { text: btn.textContent, color: btn.style.color,
                 bg: btn.style.background, border: btn.style.borderColor };
  btn.textContent = '✓ 已儲存'; btn.style.color = '#27ae60'; btn.style.borderColor = '#27ae60';
  setTimeout(() => {
    btn.textContent = prev.text; btn.style.color = prev.color;
    btn.style.background = prev.bg; btn.style.borderColor = prev.border;
  }, 2000);
}

function dayOrderSort(rows, dayArr) {
  return rows
    .map((r, i) => ({ ...r, _orig: i }))
    .sort((a, b) => {
      if (a._new && !b._new) return 1;
      if (!a._new && b._new) return -1;
      const ai = dayArr.indexOf(a.day) === -1 ? 99 : dayArr.indexOf(a.day);
      const bi = dayArr.indexOf(b.day) === -1 ? 99 : dayArr.indexOf(b.day);
      return ai - bi;
    });
}

/* ══════════════════════════════════════════════════════════════
   1. 美食清單
   ══════════════════════════════════════════════════════════════ */
var foodRows = [];
var foodEditMode = false;
var foodSyncing = false;

const PAY_OPTIONS = ['信用卡','行動支付','只收現金','Suica/ICOCA','不限'];

async function foodLoad() {
  const e = EC();
  const doc = e.doc('food');
  if (!doc) return;
  setStatus('food-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    foodRows = (snap.exists && Array.isArray(snap.data().rows)) ? snap.data().rows : [];
    console.log('[firebase-editor] foodLoad: snap.exists=', snap.exists, 'rows=', foodRows.length);
    setStatus('food-sync-status', '✓ 已同步', '#27ae60');
  } catch(_) {
    setStatus('food-sync-status', '📭 暫無資料', '#c0392b');
    try { const s = localStorage.getItem(e.lsKey('food_rows')); if (s) foodRows = JSON.parse(s); } catch(_) {}
  }
  foodRows.forEach(r => {
    if (r.booked === '□' || !r.booked) r.booked = '不可訂位';
    else if (r.booked === '✅') r.booked = '已訂位';
  });
  foodRender();
}

async function foodPushToFirebase() {
  if (foodSyncing) return; foodSyncing = true;
  const e = EC();
  const doc = e.doc('food');
  if (!doc) { foodSyncing = false; return; }
  await pushToFirebase(doc, { rows: foodRows }, 'food-sync-status', e.lsKey('food_rows'));
  foodSyncing = false;
}

function foodCalcTotal() {
  const sum = foodRows.reduce((s,r) => s+(parseInt(r.priceA)||0)+(parseInt(r.priceB)||0)+(parseInt(r.priceC)||0), 0);
  const el = document.getElementById('food-total');
  if (el) el.textContent = sum > 0 ? sum.toLocaleString() : '—';
}

function foodRender() {
  console.log('[firebase-editor] foodRender called, foodRows.length=', foodRows.length);
  const tbody = document.getElementById('food-tbody');
  if (!tbody) return;
  const e = EC();
  const delCol     = document.getElementById('food-del-col');
  const delColFoot = document.getElementById('food-del-col-foot');
  if (delCol)     delCol.style.display     = foodEditMode ? '' : 'none';
  if (delColFoot) delColFoot.style.display = foodEditMode ? '' : 'none';

  if (!foodRows.length) {
    tbody.innerHTML = `<tr><td colspan="15" style="color:var(--muted);font-style:italic;text-align:center;padding:1.5rem;">— 美食清單待補充 —<br><span style="font-size:0.75rem;">點擊右上角「✏ 編輯」按鈕開始新增</span></td></tr>`;
    foodCalcTotal(); return;
  }

  const sorted = dayOrderSort(foodRows, e.days);

  function bookedTag(state) {
    if (state === '已訂位') return `<span style="display:inline-block;background:#d4edda;color:#1a6632;font-size:0.68rem;font-family:'DM Mono',monospace;padding:0.18em 0.55em;border-radius:3px;font-weight:700;white-space:nowrap;">✅ 已訂位</span>`;
    if (state === '可訂位') return `<span style="display:inline-block;background:#fff3cd;color:#856404;font-size:0.68rem;font-family:'DM Mono',monospace;padding:0.18em 0.55em;border-radius:3px;font-weight:700;white-space:nowrap;">📋 可訂位</span>`;
    return `<span style="display:inline-block;background:#f0f0f0;color:#aaa;font-size:0.68rem;font-family:'DM Mono',monospace;padding:0.18em 0.55em;border-radius:3px;white-space:nowrap;">— 不可訂</span>`;
  }

  tbody.innerHTML = sorted.map(r => {
    const i = r._orig;
    const delBtn = foodEditMode
      ? `<td style="text-align:center;padding:0.3rem;"><button onclick="foodDeleteRow(${i})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#c0392b;padding:0.2rem 0.4rem;" title="刪除">✕</button></td>`
      : '<td style="display:none"></td>';

    if (foodEditMode) {
      const dayOpts = e.days.map(d => `<option value="${d}" ${r.day===d?'selected':''}>${d}</option>`).join('');
      const payOpts = PAY_OPTIONS.map(p => `<option value="${p}" ${r.pay===p?'selected':''}>${p}</option>`).join('');
      const bkOpts  = ['不可訂位','可訂位','已訂位'].map(b => `<option value="${b}" ${r.booked===b?'selected':''}>${b}</option>`).join('');
      const inp = (f, v, ph) => `<input value="${(v||'').replace(/"/g,'&quot;')}" onchange="foodEdit(${i},'${f}',this.value)" placeholder="${ph}" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;">`;
      const num = (f, v) => `<input type="number" value="${v||''}" onchange="foodEdit(${i},'${f}',this.value)" placeholder="0" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;text-align:right;font-family:'DM Mono',monospace;box-sizing:border-box;">`;
      const sel = (f, opts) => `<select onchange="foodEdit(${i},'${f}',this.value)" style="width:100%;font-size:0.75rem;border:1px solid #ddd;border-radius:3px;padding:0.15rem;box-sizing:border-box;">${opts}</select>`;
      return `<tr class="${r.booked==='已訂位'?'booked-row':''}" data-idx="${i}">
        <td>${sel('day',dayOpts)}</td>
        <td class="food-name">${inp('name',r.name,'店名')}</td>
        <td class="food-hours">${inp('hours',r.hours,'13001500')}</td>
        <td>${sel('pay',payOpts)}</td>
        <td>${sel('booked',bkOpts)}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('menu',r.menu,'https://')}</td>
        <td style="padding:0.35rem 0.4rem;border-left:2px solid #e8d5a0;">${inp('itemA',r.itemA,'餐點名稱')}</td>
        <td class="col-price" style="padding:0.35rem 0.4rem;">${num('priceA',r.priceA)}</td>
        <td style="padding:0.35rem 0.4rem;border-left:2px solid #e8d5a0;">${inp('itemB',r.itemB,'餐點名稱')}</td>
        <td class="col-price" style="padding:0.35rem 0.4rem;">${num('priceB',r.priceB)}</td>
        <td style="padding:0.35rem 0.4rem;border-left:2px solid #e8d5a0;">${inp('itemC',r.itemC,'餐點名稱')}</td>
        <td class="col-price" style="padding:0.35rem 0.4rem;">${num('priceC',r.priceC)}</td>
        <td style="padding:0.35rem 0.4rem;border-left:2px solid #e8d5a0;">${inp('note',r.note,'備註')}</td>
        <td class="col-price total-price" style="font-family:'DM Mono',monospace;">${((parseInt(r.priceA)||0)+(parseInt(r.priceB)||0)+(parseInt(r.priceC)||0))||'—'}</td>
        ${delBtn}</tr>`;
    } else {
      const payTag = {'信用卡':`<span class="pay-tag pay-card">信用卡</span>`,'行動支付':`<span class="pay-tag pay-mobile">行動支付</span>`,'只收現金':`<span class="pay-tag pay-cash" style="color:var(--red);font-weight:700;">🔴 現金</span>`,'Suica/ICOCA':`<span class="pay-tag pay-suica">🃏 ICOCA</span>`}[r.pay] || `<span style="color:var(--muted);font-size:0.75rem;">${r.pay||'—'}</span>`;
      const menuIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
      return `<tr class="${r.booked==='已訂位'?'booked-row':''}">
        <td style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);text-align:center;">${r.day||'—'}</td>
        <td class="food-name">${r.name||''}</td>
        <td class="food-hours">${r.hours||'—'}</td>
        <td>${payTag}</td>
        <td style="text-align:center;">${bookedTag(r.booked)}</td>
        <td style="padding:0.6rem 0.5rem;text-align:center;">${r.menu?`<a href="${r.menu.startsWith('http')?r.menu:'https://'+r.menu}" target="_blank" style="display:inline-flex;align-items:center;color:#c0392b;text-decoration:none;">${menuIconSvg}</a>`:'<span style="color:#ddd;">—</span>'}</td>
        <td>${r.itemA||'—'}</td>
        <td class="col-price" style="padding-right:1rem;">${r.priceA?parseInt(r.priceA).toLocaleString():'—'}</td>
        <td style="border-left:2px solid #f0e8dc;">${r.itemB||'—'}</td>
        <td class="col-price" style="padding-right:1rem;">${r.priceB?parseInt(r.priceB).toLocaleString():'—'}</td>
        <td style="border-left:2px solid #f0e8dc;">${r.itemC||'—'}</td>
        <td class="col-price" style="padding-right:1rem;">${r.priceC?parseInt(r.priceC).toLocaleString():'—'}</td>
        <td style="font-size:0.75rem;color:var(--muted);border-left:2px solid #f0e8dc;">${r.note||''}</td>
        <td class="col-price total-price">${((parseInt(r.priceA)||0)+(parseInt(r.priceB)||0)+(parseInt(r.priceC)||0))>0?((parseInt(r.priceA)||0)+(parseInt(r.priceB)||0)+(parseInt(r.priceC)||0)).toLocaleString():'—'}</td>
        <td style="display:none"></td></tr>`;
    }
  }).join('');
  foodCalcTotal();
}

function foodEdit(idx, field, value) {
  if (!foodRows[idx]) return;
  if (field === 'hours') {
    value = formatTimeRange(value);
    const row = document.querySelector(`#food-tbody tr[data-idx="${idx}"]`);
    if (row) { const hi = row.querySelector('td:nth-child(3) input'); if (hi && hi.value !== value) hi.value = value; }
  }
  foodRows[idx][field] = value;
  const total = (parseInt(foodRows[idx].priceA)||0)+(parseInt(foodRows[idx].priceB)||0)+(parseInt(foodRows[idx].priceC)||0);
  document.querySelectorAll(`#food-tbody tr[data-idx="${idx}"] .total-price`).forEach(c => c.textContent = total > 0 ? total.toLocaleString() : '—');
  foodCalcTotal();
}

function foodAddRow() {
  const e = EC();
  foodRows.push({ day: e.days[0]||'D1', name:'', hours:'', pay:'信用卡', booked:'不可訂位', itemA:'', priceA:'', itemB:'', priceB:'', itemC:'', priceC:'', note:'', menu:'' });
  foodRender();
  document.getElementById('food-tbody')?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function foodDeleteRow(idx) {
  if (!confirm(`確定刪除「${foodRows[idx].name||'此列'}」？`)) return;
  foodRows.splice(idx, 1); foodRender();
}

async function foodSave() {
  await foodPushToFirebase();
  savedBtnFeedback('food-edit-btn');
}

async function foodToggleEdit() {
  foodEditMode = !foodEditMode;
  const btn = document.getElementById('food-edit-btn');
  const toolbar = document.getElementById('food-edit-toolbar');
  if (foodEditMode) {
    if (btn) { btn.textContent = '✓ 完成'; btn.style.background = 'var(--ink)'; btn.style.color = '#f0c040'; }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    await foodPushToFirebase();
    if (btn) { btn.textContent = '✏ 編輯'; btn.style.background = 'transparent'; btn.style.color = 'var(--ink)'; }
    if (toolbar) toolbar.style.display = 'none';
  }
  foodRender();
}

/* ══════════════════════════════════════════════════════════════
   2. 交通清單
   ══════════════════════════════════════════════════════════════ */
var transRows = [];
var transEditMode = false;
var transSyncing = false;

async function transLoad() {
  const e = EC();
  const doc = e.doc('transport');
  if (!doc) return;
  setStatus('trans-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    transRows = (snap.exists && Array.isArray(snap.data().rows)) ? snap.data().rows : [];
    setStatus('trans-sync-status', '✓ 已同步', '#27ae60');
  } catch(_) {
    setStatus('trans-sync-status', '📭 暫無資料', '#c0392b');
    try { const s = localStorage.getItem(e.lsKey('trans_rows')); if (s) transRows = JSON.parse(s); } catch(_) {}
  }
  transRender();
}

async function transPushToFirebase() {
  if (transSyncing) return; transSyncing = true;
  const e = EC();
  const doc = e.doc('transport');
  if (!doc) { transSyncing = false; return; }
  await pushToFirebase(doc, { rows: transRows }, 'trans-sync-status', e.lsKey('trans_rows'));
  transSyncing = false;
}

function transCalcTotal() {
  const sum = transRows.reduce((s,r) => s+(parseInt(r.fare)||0), 0);
  const el = document.getElementById('trans-total');
  if (el) el.textContent = sum > 0 ? sum.toLocaleString() : '—';
}

function transRender() {
  const tbody = document.getElementById('trans-tbody');
  if (!tbody) return;
  const e = EC();
  ['trans-del-col','trans-del-col-foot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = transEditMode ? '' : 'none';
  });

  if (!transRows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--muted);font-style:italic;text-align:center;padding:1.5rem;">— 交通資訊待補充 —<br><span style="font-size:0.75rem;">點擊右上角「✏ 編輯」按鈕開始新增</span></td></tr>`;
    transCalcTotal(); return;
  }

  const sorted = dayOrderSort(transRows, e.days).sort((a, b) => {
    // 同天再依發車時間排序（dayOrderSort 已排好天，這裡補時間）
    const ai = e.days.indexOf(a.day) === -1 ? 99 : e.days.indexOf(a.day);
    const bi = e.days.indexOf(b.day) === -1 ? 99 : e.days.indexOf(b.day);
    if (ai !== bi) return ai - bi;
    return (a.depart||'').localeCompare(b.depart||'');
  });

  tbody.innerHTML = sorted.map(r => {
    const i = r._orig;
    const delBtn = transEditMode
      ? `<td style="text-align:center;padding:0.3rem;"><button onclick="transDeleteRow(${i})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#c0392b;padding:0.2rem 0.4rem;">✕</button></td>`
      : `<td style="display:none"></td>`;

    if (transEditMode) {
      const dayOpts = e.days.map(d => `<option value="${d}" ${r.day===d?'selected':''}>${d}</option>`).join('');
      const sel = (f, opts) => `<select onchange="transEdit(${i},'${f}',this.value)" style="width:100%;font-size:0.75rem;border:1px solid #ddd;border-radius:3px;padding:0.15rem;box-sizing:border-box;">${opts}</select>`;
      const inp = (f, v, ph) => `<input value="${(v||'').replace(/"/g,'&quot;')}" onchange="transEdit(${i},'${f}',this.value)" placeholder="${ph}" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;">`;
      const num = (f, v) => `<input type="number" value="${v||''}" onchange="transEdit(${i},'${f}',this.value)" placeholder="0" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;text-align:right;font-family:'DM Mono',monospace;box-sizing:border-box;">`;
      const time = (f, v) => `<input value="${v||''}" onchange="transEdit(${i},'${f}',this.value)" placeholder="0900" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;text-align:center;font-family:'DM Mono',monospace;box-sizing:border-box;">`;
      return `<tr data-idx="${i}" style="border-bottom:1px solid #f0e8dc;">
        <td style="padding:0.35rem 0.4rem;">${sel('day',dayOpts)}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('dest',r.dest,'目的地')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('line',r.line,'路線名稱')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('route',r.route,'起站 → 迄站')}</td>
        <td style="padding:0.35rem 0.4rem;">${time('depart',r.depart)}</td>
        <td style="padding:0.35rem 0.4rem;">${time('arrive',r.arrive)}</td>
        <td style="padding:0.35rem 0.4rem;">${num('fare',r.fare)}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('note',r.note,'備註')}</td>
        ${delBtn}</tr>`;
    } else {
      const fmtTime = t => { if (!t) return '—'; const d = t.replace(/\D/g,''); return d.length >= 4 ? d.slice(0,2)+':'+d.slice(2,4) : t; };
      return `<tr style="border-bottom:1px solid #f0e8dc;">
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);text-align:center;">${r.day||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-weight:700;">${r.dest||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;">${r.line||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;color:var(--muted);">${r.route||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.8rem;font-weight:700;text-align:center;">${fmtTime(r.depart)}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.8rem;font-weight:700;text-align:center;">${fmtTime(r.arrive)}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.78rem;text-align:center;">${(parseInt(r.fare)||0)>0?(parseInt(r.fare)).toLocaleString():'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.75rem;color:var(--muted);">${r.note||''}</td>
        <td style="display:none"></td></tr>`;
    }
  }).join('');
  transCalcTotal();
}

function transEdit(idx, field, value) {
  if (!transRows[idx]) return;
  if ((field==='depart'||field==='arrive') && value) {
    value = formatTimeRange(value);
    const row = document.querySelector(`#trans-tbody tr[data-idx="${idx}"]`);
    if (row) { const col = field==='depart'?5:6; const inp = row.querySelector(`td:nth-child(${col}) input`); if (inp && inp.value !== value) inp.value = value; }
  }
  if (transRows[idx]._new) delete transRows[idx]._new;
  transRows[idx][field] = value; transCalcTotal();
}

function transAddRow() {
  const e = EC();
  transRows.push({ day: e.days[0]||'D1', dest:'', line:'', route:'', depart:'', arrive:'', fare:'', note:'', _new:true });
  transRender();
  document.getElementById('trans-tbody')?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function transDeleteRow(idx) {
  if (!confirm('確定刪除此路線？')) return;
  transRows.splice(idx, 1); transRender();
}

async function transSave() {
  await transPushToFirebase();
  savedBtnFeedback('trans-edit-btn');
}

async function transToggleEdit() {
  transEditMode = !transEditMode;
  const btn = document.getElementById('trans-edit-btn');
  const toolbar = document.getElementById('trans-edit-toolbar');
  if (transEditMode) {
    if (btn) { btn.textContent = '✓ 完成'; btn.style.background = 'var(--ink)'; btn.style.color = '#f0c040'; }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    await transPushToFirebase();
    if (btn) { btn.textContent = '✏ 編輯'; btn.style.background = 'transparent'; btn.style.color = 'var(--ink)'; }
    if (toolbar) toolbar.style.display = 'none';
  }
  transRender();
}

/* ══════════════════════════════════════════════════════════════
   3. 飯店詢價
   ══════════════════════════════════════════════════════════════ */
var hotelRows = [];
var hotelEditMode = false;
var hotelSyncing = false;
var _jpyRate = null, _jpyRateTime = 0;

async function hotelLoad() {
  const e = EC();
  const doc = e.doc('hotel');
  if (!doc) return;
  setStatus('hotel-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    hotelRows = (snap.exists && Array.isArray(snap.data().rows)) ? snap.data().rows : [];
    setStatus('hotel-sync-status', '✓ 已同步', '#27ae60');
  } catch(_) {
    setStatus('hotel-sync-status', '📭 暫無資料', '#c0392b');
    try { const s = localStorage.getItem(e.lsKey('hotel_rows')); if (s) hotelRows = JSON.parse(s); } catch(_) {}
  }
  hotelRender();
}

async function hotelPushToFirebase() {
  if (hotelSyncing) return; hotelSyncing = true;
  const e = EC();
  const doc = e.doc('hotel');
  if (!doc) { hotelSyncing = false; return; }
  await pushToFirebase(doc, { rows: hotelRows }, 'hotel-sync-status', e.lsKey('hotel_rows'));
  hotelSyncing = false;
}

function hotelCalcTotal() {
  const sel = hotelRows.filter(r => r.selected);
  const sJpy = sel.reduce((s,r) => s+(parseInt(r.cost)||0), 0);
  const sTwd = sel.reduce((s,r) => s+(parseInt(r.twd)||0), 0);
  const j = document.getElementById('hotel-total');
  const t = document.getElementById('hotel-total-twd');
  if (j) j.textContent = sJpy > 0 ? sJpy.toLocaleString() : '—';
  if (t) t.textContent = sTwd > 0 ? 'NT$ ' + sTwd.toLocaleString() : '—';
}

function hotelRender() {
  const tbody = document.getElementById('hotel-tbody');
  if (!tbody) return;
  ['hotel-del-col','hotel-del-col-foot'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = hotelEditMode ? '' : 'none';
  });
  if (!hotelRows.length) {
    tbody.innerHTML = `<tr><td colspan="15" style="color:var(--muted);font-style:italic;text-align:center;padding:1.5rem;">— 尚無飯店詢價紀錄 —<br><span style="font-size:0.75rem;">點擊右上角「✏ 編輯」按鈕開始新增</span></td></tr>`;
    hotelCalcTotal(); return;
  }
  tbody.innerHTML = hotelRows.map((r, i) => {
    const sel = !!r.selected;
    const rowBg = sel ? 'background:#f0fff4;' : '';
    const chk = `<input type="checkbox" ${sel?'checked':''} onchange="hotelEdit(${i},'selected',this.checked)" style="width:1rem;height:1rem;cursor:pointer;accent-color:#27ae60;">`;
    const delBtn = hotelEditMode
      ? `<td style="text-align:center;padding:0.3rem;"><button onclick="hotelDeleteRow(${i})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#c0392b;padding:0.2rem 0.4rem;">✕</button></td>`
      : `<td style="display:none"></td>`;
    if (hotelEditMode) {
      const ta  = (f,v,ph) => `<textarea onchange="hotelEdit(${i},'${f}',this.value)" placeholder="${ph}" rows="2" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;resize:vertical;font-family:inherit;">${(v||'').replace(/</g,'&lt;')}</textarea>`;
      const inp = (f,v,ph) => `<input value="${(v||'').replace(/"/g,'&quot;')}" onchange="hotelEdit(${i},'${f}',this.value)" placeholder="${ph}" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;">`;
      const num = (f,v) => `<input type="number" value="${v||''}" onchange="hotelEdit(${i},'${f}',this.value)" placeholder="0" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;text-align:right;font-family:'DM Mono',monospace;box-sizing:border-box;">`;
      const dt  = (f,v) => `<input type="date" value="${v||''}" onchange="hotelEdit(${i},'${f}',this.value)" style="width:100%;font-size:0.72rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem;box-sizing:border-box;font-family:'DM Mono',monospace;">`;
      return `<tr data-idx="${i}" style="${rowBg}border-bottom:1px solid #f0e8dc;">
        <td style="padding:0.35rem 0.4rem;text-align:center;">${chk}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('area',r.area,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${ta('name',r.name,'飯店名稱')}</td>
        <td style="padding:0.35rem 0.4rem;">${ta('roomtype',r.roomtype,'房型')}</td>
        <td style="padding:0.35rem 0.4rem;">${num('sqm',r.sqm)}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('note',r.note,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${num('cost',r.cost)}</td>
        <td style="padding:0.35rem 0.4rem;"><div style="display:flex;gap:0.2rem;align-items:center;">${num('twd',r.twd)}<button onclick="hotelConvertToTwd(${i})" title="依匯率換算台幣" style="flex-shrink:0;background:#e8f4fd;color:#2c7be5;border:1px solid #bee3f8;border-radius:3px;padding:0.15rem 0.3rem;cursor:pointer;font-size:0.65rem;white-space:nowrap;line-height:1.2;">¥→$</button></div></td>
        <td style="padding:0.35rem 0.4rem;">${inp('source',r.source,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('pricedate',r.pricedate,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('payment',r.payment,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('paydate',r.paydate,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('canceldate',r.canceldate,'')}</td>
        <td style="padding:0.35rem 0.4rem;">${dt('checkin',r.checkin)}</td>
        <td style="padding:0.35rem 0.4rem;">${dt('checkout',r.checkout)}</td>
        ${delBtn}</tr>`;
    } else {
      const nl = s => (s||'').replace(/\n/g,'<br>');
      const fd = d => d ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$2/$3') : '—';
      return `<tr style="${rowBg}border-bottom:1px solid #f0e8dc;">
        <td style="padding:0.6rem 0.5rem;text-align:center;">${chk}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;color:var(--muted);">${r.area||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-weight:700;line-height:1.5;">${nl(r.name)||''}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;line-height:1.5;">${nl(r.roomtype)||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.78rem;text-align:center;color:var(--muted);">${r.sqm?r.sqm+'㎡':'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.75rem;color:var(--muted);">${r.note||''}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.85rem;font-weight:700;text-align:right;color:${sel?'var(--red)':'var(--ink)'};">${(parseInt(r.cost)||0)>0?(parseInt(r.cost)).toLocaleString():'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.82rem;font-weight:${sel?'700':'400'};text-align:right;color:${sel?'#27ae60':'var(--muted)'};">${r.twd?'NT$'+parseInt(r.twd).toLocaleString():'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.75rem;color:#c0392b;">${r.source||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--muted);">${r.pricedate||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;">${r.payment||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--muted);">${r.paydate||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:${r.canceldate?'#c0392b':'var(--muted)'};">${r.canceldate||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--muted);">${fd(r.checkin)}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.75rem;text-align:center;color:var(--muted);">${fd(r.checkout)}</td>
        <td style="display:none"></td></tr>`;
    }
  }).join('');
  hotelCalcTotal();
}

function hotelEdit(idx, field, value) {
  if (!hotelRows[idx]) return;
  hotelRows[idx][field] = value; hotelCalcTotal();
}

async function hotelGetJpyRate() {
  if (_jpyRate && Date.now() - _jpyRateTime < 3600000) return _jpyRate;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await res.json();
    _jpyRate = data.rates?.TWD || null; _jpyRateTime = Date.now(); return _jpyRate;
  } catch(_) { return null; }
}

async function hotelShowRate() {
  const el = document.getElementById('hotel-rate-display');
  if (el) el.textContent = '載入中…';
  const rate = await hotelGetJpyRate();
  if (el) el.textContent = rate ? `📊 ¥1 ≈ NT$ ${rate.toFixed(4)}（即時匯率）` : '⚠ 無法取得匯率';
}

async function hotelConvertToTwd(idx) {
  const cost = parseInt(hotelRows[idx]?.cost);
  if (!cost) { alert('請先填入小計(¥)金額！'); return; }
  const btn = document.querySelector(`#hotel-tbody tr[data-idx="${idx}"] button[title="依匯率換算台幣"]`);
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  const rate = await hotelGetJpyRate();
  if (!rate) { alert('無法取得匯率，請手動輸入。'); if (btn) { btn.textContent = '¥→$'; btn.disabled = false; } return; }
  const twd = Math.round(cost * rate);
  hotelRows[idx].twd = twd;
  const row = document.querySelector(`#hotel-tbody tr[data-idx="${idx}"]`);
  if (row) { const inp = row.querySelectorAll('td')[7]?.querySelector('input[type="number"]'); if (inp) inp.value = twd; }
  hotelCalcTotal();
  if (btn) {
    btn.textContent = '✓'; btn.style.background = '#d4edda'; btn.style.color = '#1a6632';
    setTimeout(() => { btn.textContent = '¥→$'; btn.style.background = '#e8f4fd'; btn.style.color = '#2c7be5'; btn.disabled = false; }, 1500);
  }
}

function hotelAddRow() {
  hotelRows.push({ selected:false, area:'', name:'', roomtype:'', sqm:'', note:'', cost:'', twd:'', source:'', pricedate:'', payment:'', paydate:'', canceldate:'', checkin:'', checkout:'' });
  hotelRender();
  document.getElementById('hotel-tbody')?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function hotelDeleteRow(idx) {
  if (!confirm(`確定刪除「${hotelRows[idx].name||'此飯店'}」？`)) return;
  hotelRows.splice(idx, 1); hotelRender();
}

async function hotelSave() {
  await hotelPushToFirebase();
  savedBtnFeedback('hotel-edit-btn');
}

async function hotelToggleEdit() {
  hotelEditMode = !hotelEditMode;
  const btn = document.getElementById('hotel-edit-btn');
  const toolbar = document.getElementById('hotel-edit-toolbar');
  if (hotelEditMode) {
    if (btn) { btn.textContent = '✓ 完成'; btn.style.background = 'var(--ink)'; btn.style.color = '#f0c040'; }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    await hotelPushToFirebase();
    if (btn) { btn.textContent = '✏ 編輯'; btn.style.background = 'transparent'; btn.style.color = 'var(--ink)'; }
    if (toolbar) toolbar.style.display = 'none';
  }
  hotelRender();
}

/* ══════════════════════════════════════════════════════════════
   4. 小筆記
   ══════════════════════════════════════════════════════════════ */
var notesData = [];
var notesEditIdx = -1;

const NOTE_COLORS = {
  '行程': { bg:'#fffde7', border:'#f9a825', icon:'🗓' },
  '交通': { bg:'#e3f2fd', border:'#1e88e5', icon:'🚆' },
  '美食': { bg:'#fce4ec', border:'#e91e63', icon:'🍽' },
};
const NOTE_DEFAULT_COLOR = { bg:'#f3e5f5', border:'#9c27b0', icon:'📝' };

async function notesLoad() {
  const e = EC();
  const doc = e.doc('notes');
  if (!doc) return;
  setStatus('notes-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    notesData = (snap.exists && Array.isArray(snap.data().items)) ? snap.data().items : [];
    setStatus('notes-sync-status', '✓ 已同步', '#27ae60');
  } catch(_) {
    setStatus('notes-sync-status', '📭 暫無資料', '#c0392b');
    try { const s = localStorage.getItem(e.lsKey('notes')); if (s) notesData = JSON.parse(s); } catch(_) {}
  }
  notesRender();
}

async function notesPush() {
  const e = EC();
  const doc = e.doc('notes');
  if (!doc) return;
  await pushToFirebase(doc, { items: notesData }, 'notes-sync-status', e.lsKey('notes'));
}

function notesRender() {
  const grid  = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  if (!grid) return;
  Array.from(grid.children).forEach(el => { if (el.id !== 'notes-empty') el.remove(); });
  if (!notesData.length) { if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  notesData.forEach((note, idx) => {
    const c = NOTE_COLORS[note.cat] || NOTE_DEFAULT_COLOR;
    const date = note.ts ? new Date(note.ts).toLocaleDateString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
    const card = document.createElement('div');
    card.style.cssText = `background:${c.bg};border:1.5px solid ${c.border};border-radius:8px;padding:1rem 1.1rem 0.85rem;position:relative;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:box-shadow 0.15s;`;
    card.onmouseenter = () => card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    card.onmouseleave = () => card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;">
        <span style="font-size:0.68rem;font-family:'DM Mono',monospace;font-weight:700;letter-spacing:0.1em;color:${c.border};background:white;padding:0.15em 0.55em;border-radius:3px;border:1px solid ${c.border};">${c.icon} ${note.cat||'筆記'}</span>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="font-size:0.65rem;color:#aaa;font-family:'DM Mono',monospace;">${date}</span>
          <button onclick="notesOpenModal(${idx})" title="編輯" style="background:none;border:none;cursor:pointer;color:#bbb;font-size:0.85rem;line-height:1;padding:0.1rem 0.3rem;border-radius:3px;transition:color 0.15s;" onmouseenter="this.style.color='#2c7be5'" onmouseleave="this.style.color='#bbb'">✏</button>
          <button onclick="notesDelete(${idx})" title="刪除" style="background:none;border:none;cursor:pointer;color:#ccc;font-size:1rem;line-height:1;padding:0.1rem 0.2rem;border-radius:3px;transition:color 0.15s;" onmouseenter="this.style.color='#c0392b'" onmouseleave="this.style.color='#ccc'">✕</button>
        </div>
      </div>
      <div style="font-size:0.85rem;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:var(--ink);">${note.text||''}</div>`;
    grid.appendChild(card);
  });
}

function notesOpenModal(idx) {
  const modal = document.getElementById('notes-modal');
  const ta    = document.getElementById('notes-modal-text');
  const cnt   = document.getElementById('notes-modal-count');
  const cat   = document.getElementById('notes-modal-cat');
  const title = document.getElementById('notes-modal-title');
  const btn   = document.getElementById('notes-modal-submit');
  notesEditIdx = (idx !== undefined) ? idx : -1;
  if (notesEditIdx >= 0) {
    const n = notesData[notesEditIdx];
    if (cat) cat.value = n.cat || '行程';
    if (ta)  ta.value  = n.text || '';
    if (cnt) cnt.textContent = (n.text||'').length + ' / 500';
    if (title) title.textContent = '✏ 編輯筆記';
    if (btn)   btn.textContent   = '更新筆記';
  } else {
    if (cat) cat.value = '行程';
    if (ta)  ta.value  = '';
    if (cnt) cnt.textContent = '0 / 500';
    if (title) title.textContent = '📝 新增小筆記';
    if (btn)   btn.textContent   = '儲存筆記';
  }
  try { notesClearImage(); } catch(_) {}
  if (modal) modal.style.display = 'flex';
  setTimeout(() => { if (ta) ta.focus(); }, 150);
}

function notesClearImage() {
  ['notes-img-preview','notes-img-zone','notes-img-label','notes-img-input','notes-ocr-status'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'notes-img-preview') el.style.display = 'none';
    else if (id === 'notes-img-zone') el.style.display = '';
    else if (id === 'notes-img-label') el.textContent = '📷 點擊或拖曳上傳圖片，由 AI 辨識轉文字';
    else if (id === 'notes-img-input') el.value = '';
    else if (id === 'notes-ocr-status') { el.style.display = 'none'; el.textContent = ''; }
  });
}

async function notesHandleImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const thumb = document.getElementById('notes-img-thumb');
  const preview = document.getElementById('notes-img-preview');
  const zone = document.getElementById('notes-img-zone');
  const status = document.getElementById('notes-ocr-status');
  const ta = document.getElementById('notes-modal-text');
  const cnt = document.getElementById('notes-modal-count');
  const reader = new FileReader();
  reader.onload = async (ev) => {
    const b64full = ev.target.result;
    if (thumb) thumb.src = b64full;
    if (preview) preview.style.display = 'block';
    if (zone) zone.style.display = 'none';
    if (status) { status.style.display = 'block'; status.textContent = '🤖 AI 辨識中…'; status.style.color = '#b8860b'; }
    let b64 = b64full.split(',')[1];
    try { b64 = await notesCompressImage(b64full, file.type); } catch(_) {}
    try {
      const res = await fetch('https://vision.googleapis.com/v1/images:annotate?key=AIzaSyCLPHCRr1uwioawNl0UXYrFNa_ftMdI3PU', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ requests: [{ image:{content:b64}, features:[{type:'DOCUMENT_TEXT_DETECTION',maxResults:1}], imageContext:{languageHints:['zh-Hant','ja','en']} }] })
      });
      const data = await res.json();
      const text = data.responses?.[0]?.fullTextAnnotation?.text?.trim() || data.responses?.[0]?.textAnnotations?.[0]?.description?.trim() || '';
      if (text && ta) {
        const ex = ta.value.trim();
        ta.value = (ex ? ex + '\n\n' : '') + text;
        if (ta.value.length > 500) ta.value = ta.value.slice(0, 500);
        if (cnt) cnt.textContent = ta.value.length + ' / 500';
        if (status) { status.textContent = '✓ 辨識完成'; status.style.color = '#27ae60'; }
      } else {
        if (status) { status.textContent = '⚠ 未偵測到文字'; status.style.color = '#c0392b'; }
      }
    } catch(err) {
      if (status) { status.textContent = `⚠ 辨識失敗`; status.style.color = '#c0392b'; }
    }
  };
  reader.readAsDataURL(file);
}

function notesCompressImage(dataUrl, mimeType) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 2048;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h*MAX/w); w = MAX; } else { w = Math.round(w*MAX/h); h = MAX; } }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(mimeType === 'image/png' ? 'image/png' : 'image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject; img.src = dataUrl;
  });
}

function notesCloseModal() {
  const modal = document.getElementById('notes-modal');
  if (modal) modal.style.display = 'none';
  notesEditIdx = -1;
}

async function notesSubmit() {
  const cat  = document.getElementById('notes-modal-cat')?.value || '行程';
  const text = document.getElementById('notes-modal-text')?.value?.trim() || '';
  if (!text) { alert('請輸入筆記內容！'); return; }
  if (notesEditIdx >= 0) {
    notesData[notesEditIdx] = { ...notesData[notesEditIdx], cat, text, edited: Date.now() };
  } else {
    notesData.unshift({ cat, text, ts: Date.now() });
  }
  notesEditIdx = -1;
  notesCloseModal(); notesRender(); await notesPush();
}

async function notesDelete(idx) {
  const note = notesData[idx];
  const preview = (note.text||'').slice(0,20) + ((note.text||'').length > 20 ? '…' : '');
  if (!confirm(`確定刪除這則「${note.cat}」筆記？\n\n「${preview}」`)) return;
  notesData.splice(idx, 1); notesRender(); await notesPush();
}

/* ══════════════════════════════════════════════════════════════
   5. 景點清單（含拖拉排序）
   ══════════════════════════════════════════════════════════════ */
var spotsRows = [];
var spotsEditMode = false;
var spotsSyncing = false;
var _dragSrcIdx = null, _dragSrcDay = null, _dragTargetTr = null;

const SPOTS_PRIO_OPTIONS = ['✅ 必去','⭐ 推薦','□ 備選'];

async function spotsLoad() {
  const e = EC();
  const doc = e.doc('spots');
  if (!doc) return;
  setStatus('spots-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    spotsRows = (snap.exists && Array.isArray(snap.data().rows)) ? snap.data().rows : [];
    setStatus('spots-sync-status', '✓ 已同步', '#27ae60');
  } catch(_) {
    setStatus('spots-sync-status', '📭 暫無資料', '#c0392b');
    try { const s = localStorage.getItem(e.lsKey('spots_rows')); if (s) spotsRows = JSON.parse(s); } catch(_) {}
  }
  spotsRender();
}

async function spotsPushToFirebase() {
  if (spotsSyncing) return; spotsSyncing = true;
  const e = EC();
  const doc = e.doc('spots');
  if (!doc) { spotsSyncing = false; return; }
  await pushToFirebase(doc, { rows: spotsRows }, 'spots-sync-status', e.lsKey('spots_rows'));
  spotsSyncing = false;
}

function spotsRender() {
  const tbody = document.getElementById('spots-tbody');
  if (!tbody) return;
  const e = EC();
  const delCol  = document.getElementById('spots-del-col');
  const dragCol = document.getElementById('spots-drag-col');
  if (delCol)  delCol.style.display  = spotsEditMode ? '' : 'none';
  if (dragCol) dragCol.style.display = spotsEditMode ? '' : 'none';

  if (!spotsRows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="color:var(--muted);font-style:italic;text-align:center;padding:1.5rem;">— 景點清單待補充 —<br><span style="font-size:0.75rem;">點擊右上角「✏ 編輯」按鈕開始新增</span></td></tr>`;
    return;
  }

  const sorted = dayOrderSort(spotsRows, e.days);
  const webIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

  tbody.innerHTML = sorted.map(r => {
    const i = r._orig;
    const isMust = r.prio === '✅ 必去';
    const rowBg  = isMust ? 'background:#fef9f0;' : '';
    const delBtn = spotsEditMode
      ? `<td style="text-align:center;padding:0.3rem;"><button onclick="spotsDeleteRow(${i})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#c0392b;padding:0.2rem 0.4rem;">✕</button></td>`
      : `<td style="display:none"></td>`;

    if (spotsEditMode) {
      const dayOpts  = e.days.map(d => `<option value="${d}" ${r.day===d?'selected':''}>${d}</option>`).join('');
      const prioOpts = SPOTS_PRIO_OPTIONS.map(p => `<option value="${p}" ${r.prio===p?'selected':''}>${p}</option>`).join('');
      const sel = (f, opts) => `<select onchange="spotsEdit(${i},'${f}',this.value)" style="width:100%;font-size:0.75rem;border:1px solid #ddd;border-radius:3px;padding:0.15rem;box-sizing:border-box;">${opts}</select>`;
      const inp = (f, v, ph) => `<input value="${(v||'').replace(/"/g,'&quot;')}" onchange="spotsEdit(${i},'${f}',this.value)" placeholder="${ph}" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;">`;
      const num = (f, v) => `<input type="number" value="${v||''}" onchange="spotsEdit(${i},'${f}',this.value)" placeholder="0" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;text-align:right;font-family:'DM Mono',monospace;box-sizing:border-box;">`;
      return `<tr data-idx="${i}" draggable="true" data-day="${r.day||'—'}"
          style="${rowBg}border-bottom:1px solid #f0e8dc;cursor:grab;"
          ondragstart="spotsDragStart(event,${i})"
          ondragover="spotsDragOver(event)"
          ondrop="spotsDrop(event,${i})"
          ondragend="spotsDragEnd(event)">
        <td style="padding:0.35rem 0.3rem;text-align:center;color:#bbb;font-size:1rem;cursor:grab;user-select:none;" title="拖拉調整同天內順序">⠿</td>
        <td style="padding:0.35rem 0.4rem;">${sel('day',dayOpts)}</td>
        <td style="padding:0.35rem 0.4rem;"><input value="${(r.name||'').replace(/"/g,'&quot;')}" onchange="spotsEdit(${i},'name',this.value)" placeholder="景點名稱" style="width:100%;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;"></td>
        <td style="padding:0.35rem 0.4rem;"><div style="display:flex;gap:0.3rem;align-items:center;"><input value="${(r.website||'').replace(/"/g,'&quot;')}" onchange="spotsEdit(${i},'website',this.value)" placeholder="https://" id="website-inp-${i}" style="flex:1;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.3rem;box-sizing:border-box;min-width:0;"><button onclick="spotsAutoFetchWebsite(${i},spotsRows[${i}].name)" title="Google 搜尋官網" style="flex-shrink:0;background:#4285f4;color:white;border:none;border-radius:3px;padding:0.15rem 0.3rem;cursor:pointer;font-size:0.65rem;line-height:1;white-space:nowrap;">🔍</button></div></td>
        <td style="padding:0.35rem 0.4rem;">${sel('prio',prioOpts)}</td>
        <td style="padding:0.35rem 0.4rem;"><input value="${(r.hours||'').replace(/"/g,'&quot;')}" onchange="spotsEdit(${i},'hours',this.value)" placeholder="09001700" style="width:100%;font-size:0.7rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.25rem;box-sizing:border-box;"></td>
        <td style="padding:0.35rem 0.4rem;">${num('fee',r.fee)}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('note',r.note,'備註')}</td>
        <td style="padding:0.35rem 0.4rem;">${inp('address',r.address,'貼上 Google Maps 連結或地址')}</td>
        <td style="padding:0.35rem 0.4rem;text-align:center;">${r.address?`<a href="${/maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(r.address)?r.address:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent((r.name||'')+' '+r.address)}" target="_blank" style="display:inline-block;background:#4285f4;color:white;font-family:'DM Mono',monospace;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;padding:0.25em 0.5em;border-radius:3px;text-decoration:none;">MAP</a>`:'—'}</td>
        ${delBtn}</tr>`;
    } else {
      const prioStyle = isMust ? 'color:#27ae60;font-weight:700;' : r.prio==='⭐ 推薦'?'color:#b8860b;':'color:var(--muted);';
      function buildMapUrl(name, addr) {
        if (!addr) return '';
        const a = addr.trim();
        if (/maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(a)) return a;
        if (/^https?:\/\//i.test(a)) return a;
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name?name+' '+a:a)}`;
      }
      const mapUrl = buildMapUrl(r.name, r.address);
      const webCell = r.website ? `<a href="${r.website.startsWith('http')?r.website:'https://'+r.website}" target="_blank" style="display:inline-flex;align-items:center;color:#2c7be5;text-decoration:none;">${webIcon}</a>` : '<span style="color:#ddd;">—</span>';
      return `<tr style="${rowBg}border-bottom:1px solid #f0e8dc;">
        <td style="display:none"></td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--muted);text-align:center;">${r.day||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-weight:700;">${r.name||''}</td>
        <td style="padding:0.6rem 0.5rem;text-align:center;">${webCell}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;${prioStyle}">${r.prio||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.78rem;color:var(--muted);">${r.hours||'—'}</td>
        <td style="padding:0.6rem 0.5rem;font-family:'DM Mono',monospace;font-size:0.78rem;text-align:center;">${(parseInt(r.fee)||0)>0?(parseInt(r.fee)).toLocaleString():'免費'}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.75rem;color:var(--muted);">${r.note||''}</td>
        <td style="padding:0.6rem 0.5rem;font-size:0.72rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(r.address||'').replace(/"/g,'&quot;')}">${r.address||'—'}</td>
        <td style="padding:0.6rem 0.5rem;text-align:center;">${mapUrl?`<a href="${mapUrl}" target="_blank" style="display:inline-block;background:#4285f4;color:white;font-family:'DM Mono',monospace;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;padding:0.25em 0.55em;border-radius:3px;text-decoration:none;white-space:nowrap;">MAP</a>`:'—'}</td>
        <td style="display:none"></td></tr>`;
    }
  }).join('');
}

// 景點拖拉排序
function spotsDragStart(e, idx) {
  _dragSrcIdx = idx; _dragSrcDay = spotsRows[idx]?.day || null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(idx));
  e.currentTarget.style.opacity = '0.45';
}
function spotsDragOver(e) {
  e.preventDefault();
  const tr = e.currentTarget;
  const targetIdx = parseInt(tr.dataset.idx);
  const targetDay = spotsRows[targetIdx]?.day || null;
  if (targetDay !== _dragSrcDay) { e.dataTransfer.dropEffect = 'none'; tr.style.borderTop = ''; return; }
  e.dataTransfer.dropEffect = 'move';
  if (_dragTargetTr && _dragTargetTr !== tr) _dragTargetTr.style.borderTop = '';
  _dragTargetTr = tr; tr.style.borderTop = '2.5px solid var(--gold)';
}
function spotsDrop(e, targetIdx) {
  e.preventDefault();
  if (_dragTargetTr) _dragTargetTr.style.borderTop = '';
  if (_dragSrcIdx === null || _dragSrcIdx === targetIdx) return;
  if ((spotsRows[targetIdx]?.day||null) !== _dragSrcDay) return;
  const moved = spotsRows.splice(_dragSrcIdx, 1)[0];
  const newTarget = _dragSrcIdx < targetIdx ? targetIdx - 1 : targetIdx;
  spotsRows.splice(newTarget, 0, moved);
  _dragSrcIdx = null; _dragSrcDay = null;
  spotsRender(); spotsPushToFirebase();
}
function spotsDragEnd(e) {
  e.currentTarget.style.opacity = '';
  if (_dragTargetTr) { _dragTargetTr.style.borderTop = ''; _dragTargetTr = null; }
  _dragSrcIdx = null; _dragSrcDay = null;
}

function spotsEdit(idx, field, value) {
  if (!spotsRows[idx]) return;
  if (field === 'hours') {
    value = formatTimeRange(value);
    const row = document.querySelector(`#spots-tbody tr[data-idx="${idx}"]`);
    if (row) { const inp = row.querySelector('td:nth-child(6) input'); if (inp && inp.value !== value) inp.value = value; }
  }
  if (spotsRows[idx]._new) delete spotsRows[idx]._new;
  spotsRows[idx][field] = value;
}

function spotsAutoFetchWebsite(idx, name) {
  window.open(`https://www.google.com/search?q=${encodeURIComponent((name||'')+ ' 公式サイト OR official site')}`, '_blank');
}

function spotsAddRow() {
  const e = EC();
  spotsRows.push({ day: e.days[0]||'D1', name:'', prio:'⭐ 推薦', area: e.areas[0]||'—', hours:'', fee:'', note:'', address:'', website:'', _new:true });
  spotsRender();
  document.getElementById('spots-tbody')?.lastElementChild?.scrollIntoView({ behavior:'smooth', block:'center' });
}

function spotsDeleteRow(idx) {
  if (!confirm(`確定刪除「${spotsRows[idx].name||'此景點'}」？`)) return;
  spotsRows.splice(idx, 1); spotsRender();
}

async function spotsSave() {
  await spotsPushToFirebase();
  savedBtnFeedback('spots-edit-btn');
}

async function spotsToggleEdit() {
  spotsEditMode = !spotsEditMode;
  const btn = document.getElementById('spots-edit-btn');
  const toolbar = document.getElementById('spots-edit-toolbar');
  if (spotsEditMode) {
    if (btn) { btn.textContent = '✓ 完成'; btn.style.background = 'var(--ink)'; btn.style.color = '#f0c040'; }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    await spotsPushToFirebase();
    if (btn) { btn.textContent = '✏ 編輯'; btn.style.background = 'transparent'; btn.style.color = 'var(--ink)'; }
    if (toolbar) toolbar.style.display = 'none';
  }
  spotsRender();
}

/* ══════════════════════════════════════════════════════════════
   6. 行程總覽（Firebase 驅動）
   ══════════════════════════════════════════════════════════════ */
var itineraryData = [];   // [ { day, sub, periods: [ { title, events: [ { type, name, note } ] } ] } ]
var itineraryEditMode = false;
var itinerarySyncing  = false;

const ITIN_TYPES = ['交通','景點','餐飲','住宿','其他'];
const ITIN_TYPE_CLASS = { '交通':'tag-transport','景點':'tag-spot','餐飲':'tag-meal','住宿':'tag-hotel','其他':'tag-other' };

/* ── 從靜態 HTML 掃描初始資料（首次載入、Firebase 無資料時使用） ── */
function itineraryReadStatic() {
  const days = [];
  document.querySelectorAll('#itinerary-static-data .day-block[data-static]').forEach(block => {
    const day = block.querySelector('.day-label')?.textContent?.trim() || '';
    const sub = block.querySelector('.day-sub')?.textContent?.trim() || '';
    const periods = [];
    block.querySelectorAll('.period').forEach(p => {
      const title = p.querySelector('.period-title')?.textContent?.trim() || '';
      const events = [];
      p.querySelectorAll('.event').forEach(ev => {
        const tagEl = ev.querySelector('.tag');
        const tagClass = tagEl ? [...tagEl.classList].find(c => c.startsWith('tag-') && c !== 'tag') : '';
        const type = (Object.entries(ITIN_TYPE_CLASS).find(([k,v]) => v === tagClass) || ['其他'])[0];
        const name  = ev.querySelector('.event-name')?.textContent?.trim() || '';
        const note  = ev.querySelector('.event-note')?.textContent?.trim() || '';
        events.push({ type: type||'其他', name, note });
      });
      periods.push({ title, events });
    });
    days.push({ day, sub, periods });
  });
  return days;
}

async function itineraryLoad() {
  const e = EC();
  const doc = e.doc('itinerary');
  if (!doc) { itineraryRender(); return; }
  setStatus('itin-sync-status', '⏳ 同步中…', '#b8860b');
  try {
    const snap = await doc.get();
    if (snap.exists && Array.isArray(snap.data().days) && snap.data().days.length) {
      itineraryData = snap.data().days;
      setStatus('itin-sync-status', '✓ 已同步', '#27ae60');
    } else {
      // 首次：從靜態 HTML 讀入
      itineraryData = itineraryReadStatic();
      setStatus('itin-sync-status', '✓ 已同步', '#27ae60');
    }
  } catch(_) {
    itineraryData = itineraryReadStatic();
    setStatus('itin-sync-status', '📭 離線模式', '#c0392b');
  }
  itineraryRender();
}

async function itineraryPush() {
  if (itinerarySyncing) return; itinerarySyncing = true;
  const e = EC();
  const doc = e.doc('itinerary');
  if (!doc) { itinerarySyncing = false; return; }
  await pushToFirebase(doc, { days: itineraryData }, 'itin-sync-status', e.lsKey('itinerary'));
  itinerarySyncing = false;
}

function itineraryRender() {
  const container = document.getElementById('itinerary-main');
  if (!container) return;

  if (!itineraryData.length) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--muted);font-style:italic;">— 行程待補充 —</div>`;
    return;
  }

  container.innerHTML = itineraryData.map((day, di) => {
    const periods = (day.periods || []).map((p, pi) => {
      const events = (p.events || []).map((ev, ei) => {
        const tagClass = ITIN_TYPE_CLASS[ev.type] || 'tag-other';
        if (itineraryEditMode) {
          const typeOpts = ITIN_TYPES.map(t => `<option value="${t}" ${ev.type===t?'selected':''}>${t}</option>`).join('');
          return `<div class="event" data-di="${di}" data-pi="${pi}" data-ei="${ei}" style="display:flex;gap:0.6rem;align-items:flex-start;padding:0.5rem 0;border-bottom:1px dashed #eee;">
            <div class="event-type" style="flex-shrink:0;padding-top:0.1rem;">
              <select onchange="itinEdit(${di},${pi},${ei},'type',this.value)"
                style="font-size:0.72rem;border:1px solid #ddd;border-radius:3px;padding:0.15rem;background:white;">
                ${typeOpts}
              </select>
            </div>
            <div class="event-body" style="flex:1;display:flex;flex-direction:column;gap:0.3rem;">
              <input value="${(ev.name||'').replace(/"/g,'&quot;')}"
                onchange="itinEdit(${di},${pi},${ei},'name',this.value)"
                placeholder="事件名稱"
                style="width:100%;font-size:0.82rem;font-weight:600;border:1px solid #ddd;border-radius:3px;padding:0.25rem 0.4rem;box-sizing:border-box;">
              <input value="${(ev.note||'').replace(/"/g,'&quot;')}"
                onchange="itinEdit(${di},${pi},${ei},'note',this.value)"
                placeholder="補充說明（可留空）"
                style="width:100%;font-size:0.76rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.4rem;box-sizing:border-box;color:#666;">
            </div>
            <button onclick="itinDeleteEvent(${di},${pi},${ei})"
              style="flex-shrink:0;background:none;border:none;cursor:pointer;font-size:0.9rem;color:#c0392b;padding:0.2rem 0.35rem;margin-top:0.1rem;" title="刪除">✕</button>
          </div>`;
        } else {
          return `<div class="event" style="display:flex;gap:0.6rem;align-items:flex-start;padding:0.45rem 0;">
            <div class="event-type"><span class="tag ${tagClass}">${ev.type}</span></div>
            <div class="event-body">
              <div class="event-name">${ev.name||''}</div>
              ${ev.note ? `<div class="event-note">${ev.note}</div>` : ''}
            </div>
          </div>`;
        }
      }).join('');

      const addEventBtn = itineraryEditMode
        ? `<button onclick="itinAddEvent(${di},${pi})"
            style="margin-top:0.4rem;font-size:0.72rem;font-family:'DM Mono',monospace;background:transparent;border:1px dashed #bbb;border-radius:3px;padding:0.2rem 0.6rem;cursor:pointer;color:var(--muted);">＋ 新增事件</button>`
        : '';

      const periodTitle = itineraryEditMode
        ? `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
            <input value="${(p.title||'').replace(/"/g,'&quot;')}"
              onchange="itinEditPeriod(${di},${pi},'title',this.value)"
              style="font-size:0.78rem;font-weight:700;color:var(--muted);border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.4rem;background:white;">
            <button onclick="itinDeletePeriod(${di},${pi})"
              style="background:none;border:none;cursor:pointer;font-size:0.8rem;color:#c0392b;" title="刪除時段">✕</button>
          </div>`
        : `<div class="period-title">${p.title||''}</div>`;

      return `<div class="period" data-di="${di}" data-pi="${pi}">
        ${periodTitle}
        ${events}
        ${addEventBtn}
      </div>`;
    }).join('');

    const addPeriodBtn = itineraryEditMode
      ? `<button onclick="itinAddPeriod(${di})"
          style="margin-top:0.5rem;font-size:0.72rem;font-family:'DM Mono',monospace;background:transparent;border:1px dashed #bbb;border-radius:4px;padding:0.25rem 0.8rem;cursor:pointer;color:var(--muted);">＋ 新增時段</button>`
      : '';

    const dayHeader = itineraryEditMode
      ? `<div class="day-header" style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
          <input value="${(day.day||'').replace(/"/g,'&quot;')}"
            onchange="itinEditDay(${di},'day',this.value)"
            style="font-family:'DM Mono',monospace;font-size:0.9rem;font-weight:700;width:3.5rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.4rem;text-align:center;">
          <input value="${(day.sub||'').replace(/"/g,'&quot;')}"
            onchange="itinEditDay(${di},'sub',this.value)"
            style="font-size:0.82rem;flex:1;min-width:12rem;border:1px solid #ddd;border-radius:3px;padding:0.2rem 0.4rem;color:#555;">
          <button onclick="itinDeleteDay(${di})"
            style="background:none;border:1px solid #c0392b;border-radius:3px;cursor:pointer;font-size:0.75rem;color:#c0392b;padding:0.15rem 0.5rem;" title="刪除此天">✕ 刪除整天</button>
        </div>`
      : `<div class="day-header">
          <div class="day-label">${day.day||''}</div>
          <div class="day-sub">${day.sub||''}</div>
        </div>`;

    return `<div class="day-block" data-di="${di}">
      ${dayHeader}
      ${periods}
      ${addPeriodBtn}
    </div>`;
  }).join('');
}

/* ── 資料操作 ── */
function itinEdit(di, pi, ei, field, value) {
  if (itineraryData[di]?.periods[pi]?.events[ei]) {
    itineraryData[di].periods[pi].events[ei][field] = value;
  }
}
function itinEditPeriod(di, pi, field, value) {
  if (itineraryData[di]?.periods[pi]) itineraryData[di].periods[pi][field] = value;
}
function itinEditDay(di, field, value) {
  if (itineraryData[di]) itineraryData[di][field] = value;
}

function itinAddEvent(di, pi) {
  itineraryData[di]?.periods[pi]?.events.push({ type:'景點', name:'', note:'' });
  itineraryRender();
}
function itinDeleteEvent(di, pi, ei) {
  itineraryData[di]?.periods[pi]?.events.splice(ei, 1);
  itineraryRender();
}
function itinAddPeriod(di) {
  itineraryData[di]?.periods.push({ title:'新時段', events:[{ type:'景點', name:'', note:'' }] });
  itineraryRender();
}
function itinDeletePeriod(di, pi) {
  if (!confirm('確定刪除此時段及其所有事件？')) return;
  itineraryData[di]?.periods.splice(pi, 1);
  itineraryRender();
}
function itinAddDay() {
  itineraryData.push({ day:`D${itineraryData.length+1}`, sub:'', periods:[{ title:'全日', events:[{ type:'景點', name:'', note:'' }] }] });
  itineraryRender();
  document.querySelector('#itinerary-main .day-block:last-child')?.scrollIntoView({ behavior:'smooth', block:'start' });
}
function itinDeleteDay(di) {
  if (!confirm(`確定刪除「${itineraryData[di]?.day||'此天'}」的所有行程？`)) return;
  itineraryData.splice(di, 1);
  itineraryRender();
}

async function itinerarySave() {
  await itineraryPush();
  savedBtnFeedback('itin-edit-btn');
}

async function itineraryToggleEdit() {
  itineraryEditMode = !itineraryEditMode;
  const btn     = document.getElementById('itin-edit-btn');
  const toolbar = document.getElementById('itin-edit-toolbar');
  if (itineraryEditMode) {
    if (btn)     { btn.textContent = '✓ 完成'; btn.style.background = 'var(--ink)'; btn.style.color = '#f0c040'; }
    if (toolbar) toolbar.style.display = 'flex';
  } else {
    await itineraryPush();
    if (btn)     { btn.textContent = '✏ 編輯'; btn.style.background = 'transparent'; btn.style.color = 'var(--ink)'; }
    if (toolbar) toolbar.style.display = 'none';
  }
  itineraryRender();
}

/* ══════════════════════════════════════════════════════════════
   7. 航班資訊
   ══════════════════════════════════════════════════════════════ */
var flightEditMode = false;

function flightToggleEdit() {
  flightEditMode = !flightEditMode;
  const panel   = document.getElementById('flight-edit-panel');
  const display = document.getElementById('flight-display');
  const btn     = document.getElementById('flight-edit-btn');
  if (flightEditMode) {
    ['out-num','out-dep','out-dep-ap','out-arr','out-arr-ap','ret-num','ret-dep','ret-dep-ap','ret-arr','ret-arr-ap'].forEach(k => {
      const inp = document.getElementById('ei-' + k);
      const src = document.getElementById('f-' + k);
      if (inp && src) inp.value = src.textContent.trim();
    });
    const oi = document.getElementById('ei-out-info'); const os = document.getElementById('f-out-info');
    if (oi && os) oi.value = os.innerHTML.replace(/<br>/g, '\n').trim();
    const ri = document.getElementById('ei-ret-info'); const rs = document.getElementById('f-ret-info');
    if (ri && rs) ri.value = rs.innerHTML.replace(/<br>/g, '\n').trim();
    if (panel) panel.style.display = 'block';
    if (display) display.style.display = 'none';
    if (btn) { btn.textContent = '✕ 取消'; btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; }
  } else {
    if (panel) panel.style.display = 'none';
    if (display) display.style.display = 'grid';
    if (btn) { btn.textContent = '✏ 編輯'; btn.style.color = 'var(--ink)'; btn.style.borderColor = 'var(--ink)'; }
  }
}

function flightSave() {
  ['out-num','out-dep','out-arr','ret-num','ret-dep','ret-arr'].forEach(k => {
    const src = document.getElementById('ei-' + k);
    const dst = document.getElementById('f-' + k);
    if (src && dst) dst.textContent = src.value.trim() || '—';
  });
  ['out-dep-ap','out-arr-ap','ret-dep-ap','ret-arr-ap'].forEach(k => {
    const src = document.getElementById('ei-' + k);
    const dst = document.getElementById('f-' + k);
    if (src && dst) dst.textContent = src.value.trim().toUpperCase() || '—';
  });
  ['out-info','ret-info'].forEach(k => {
    const src = document.getElementById('ei-' + k);
    const dst = document.getElementById('f-' + k);
    if (src && dst) dst.innerHTML = src.value.trim().replace(/\n/g, '<br>');
  });
  const data = {};
  ['out-num','out-dep','out-dep-ap','out-arr','out-arr-ap','ret-num','ret-dep','ret-dep-ap','ret-arr','ret-arr-ap'].forEach(k => {
    data[k.replace(/-/g,'_')] = document.getElementById('f-' + k)?.textContent;
  });
  data.out_info = document.getElementById('f-out-info')?.innerHTML;
  data.ret_info = document.getElementById('f-ret-info')?.innerHTML;
  try { localStorage.setItem(EC().lsKey('flight'), JSON.stringify(data)); } catch(_) {}
  flightEditMode = true; flightToggleEdit();
}

function flightLoad() {
  try {
    const saved = localStorage.getItem(EC().lsKey('flight'));
    if (!saved) return;
    const d = JSON.parse(saved);
    ['out-num','out-dep','out-dep-ap','out-arr','out-arr-ap','ret-num','ret-dep','ret-dep-ap','ret-arr','ret-arr-ap'].forEach(k => {
      const key = k.replace(/-/g,'_');
      const el = document.getElementById('f-' + k);
      if (d[key] && el) el.textContent = d[key];
    });
    if (d.out_info) { const el = document.getElementById('f-out-info'); if (el) el.innerHTML = d.out_info; }
    if (d.ret_info) { const el = document.getElementById('f-ret-info'); if (el) el.innerHTML = d.ret_info; }
  } catch(_) {}
}

/* ══════════════════════════════════════════════════════════════
   7. 頁面載入：初始化所有 editors
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  // 小筆記 modal 點背景關閉
  document.getElementById('notes-modal')?.addEventListener('click', function(e) {
    if (e.target === this) notesCloseModal();
  });

  // 載入所有 editors
  flightLoad();
  foodLoad();
  transLoad();
  hotelLoad();
  notesLoad();
  spotsLoad();
  itineraryLoad();
});
