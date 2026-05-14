/* ══════════════════════════════════════════════════════
   trip-page.css — 行程頁共用版面樣式
   適用於：2026_tokyo.html、202610_Kobe.html 及所有未來行程頁
   依賴：base.css
   ══════════════════════════════════════════════════════ */

/* ── HEADER ── */
header {
  background: var(--ink);
  color: var(--paper);
  padding: 3rem 2rem 2.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}
/* 各頁面以 header::before 設定背景文字（城市名），在行程頁 <style> 內個別定義 */
header .date-tag {
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}
header h1 {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 900;
  letter-spacing: 0.05em;
  line-height: 1.1;
}
header p {
  margin-top: 0.75rem;
  color: #aaa;
  font-size: 0.9rem;
  letter-spacing: 0.1em;
}

/* ── LEGEND ── */
.legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
  padding: 1.25rem 2rem;
  background: var(--cream);
  border-bottom: 1px solid #ddd;
  font-size: 0.78rem;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-transport { background: #aaa; }
.dot-walk      { background: #7ba7bc; }
.dot-spot      { background: var(--sage); }
.dot-meal      { background: var(--red); }

/* ── TAB NAV ── */
.tab-nav {
  display: flex;
  gap: 0;
  background: var(--cream);
  border-bottom: 2px solid var(--ink);
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;
  overflow-x: auto;
}
.tab-btn {
  background: none;
  border: none;
  font-family: 'Noto Serif TC', serif;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  padding: 0.9rem 1.5rem;
  cursor: pointer;
  color: var(--muted);
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  white-space: nowrap;
}
.tab-btn.active {
  color: var(--ink);
  border-bottom-color: var(--ink);
  font-weight: 700;
}
.tab-panel { display: none; }
.tab-panel.active { display: block; }

/* ── EMPTY NOTICE ── */
.empty-notice {
  background: var(--cream);
  border: 1.5px dashed #ccc;
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  font-size: 0.85rem;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.03em;
}

/* ── MAIN LAYOUT ── */
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

/* ── DAY BLOCK ── */
.day-block {
  margin-bottom: 3.5rem;
}
.day-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  border-bottom: 3px solid var(--ink);
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
}
.day-label {
  font-size: 2.5rem;
  font-weight: 900;
  line-height: 1;
  color: var(--ink);
}
.day-sub {
  font-size: 0.85rem;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.05em;
}

/* ── PERIOD ── */
.period {
  margin-bottom: 1.5rem;
}
.period-title {
  font-size: 0.7rem;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.75rem;
  padding-left: 0.5rem;
  border-left: 2px solid #ccc;
}

/* ── EVENT CARD ── */
.event {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 0 1rem;
  margin-bottom: 0.6rem;
  animation: fadeUp 0.4s ease both;
}
.event-type {
  display: flex;
  align-items: flex-start;
  padding-top: 0.1rem;
  justify-content: flex-end;
}
.tag {
  font-size: 0.68rem;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.05em;
  padding: 0.2em 0.6em;
  border-radius: 2px;
  white-space: nowrap;
  font-weight: 500;
}
.tag-transport { background: #e0e0e0; color: #555; }
.tag-walk      { background: #d4e9f0; color: #2c5d70; }
.tag-spot      { background: #dde8d8; color: #3d5c33; }
.tag-meal      { background: #f5ddd8; color: #8b2c22; }

.event-body {
  background: white;
  border: 1px solid #e8e0d4;
  border-radius: 4px;
  padding: 0.7rem 1rem;
  position: relative;
}
.event-body.must::after {
  content: '必';
  position: absolute;
  top: 0.4rem; right: 0.6rem;
  font-size: 0.65rem;
  color: var(--red);
  font-weight: 700;
}
.event-body.booked::after {
  content: '已訂位';
  position: absolute;
  top: 0.4rem; right: 0.6rem;
  font-size: 0.65rem;
  color: var(--blue);
  font-weight: 600;
}
.event-name {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.4;
}
.event-name.alt { color: var(--red); }
.event-note {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.25rem;
  line-height: 1.5;
}
.event-note .replaceable { color: var(--sage); font-weight: 600; }
.event-note .minus24     { color: var(--red);  font-weight: 600; }

/* ── CONNECTOR ── */
.connector {
  width: 1px;
  height: 12px;
  background: #d0c8bc;
  margin: 0 0 0 calc(90px + 0.5rem + 45px);
  margin-bottom: 0;
}

/* ── MINI CARD (隨身小卡) ── */
#card-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem 4rem;
}
#card-section h2 {
  font-size: 1.1rem;
  font-weight: 700;
  border-bottom: 2px solid var(--ink);
  padding-bottom: 0.5rem;
  margin-bottom: 1.5rem;
  letter-spacing: 0.1em;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 1.5rem;
}
.mini-card {
  border: 2px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
  background: white;
  font-size: 0.82rem;
  break-inside: avoid;
}
.mini-card-header {
  background: var(--ink);
  color: var(--paper);
  padding: 0.65rem 1rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.mini-card-header .day-big {
  font-size: 1.4rem;
  font-family: 'Noto Serif TC', serif;
  font-weight: 900;
  line-height: 1;
}
.mini-card-header .day-info {
  text-align: right;
  line-height: 1.5;
}
.mini-card-body { padding: 0.75rem 1rem; }
.mini-card-period {
  font-size: 0.65rem;
  font-family: 'DM Mono', monospace;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
  border-left: 2px solid #ccc;
  padding-left: 0.4rem;
  margin: 0.6rem 0 0.4rem;
}
.mini-card-period:first-child { margin-top: 0; }
.mini-card-body .item {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin-bottom: 0.35rem;
  line-height: 1.45;
}
.mini-card-body .item-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.45rem;
}
.mini-card-body .item-text { flex: 1; }
.mini-card-body .item-sub {
  font-size: 0.68rem;
  color: var(--muted);
  line-height: 1.3;
}
.mini-card-body .badge {
  font-size: 0.6rem;
  padding: 0.1em 0.4em;
  border-radius: 2px;
  font-family: 'DM Mono', monospace;
  vertical-align: middle;
  margin-left: 0.3em;
}
.badge-booked { background: #d4e0f5; color: #2c4a7c; }
.badge-must   { background: #f5ddd8; color: #8b2c22; }
.badge-swap   { background: #dde8d8; color: #3d5c33; }
.badge-late   { background: #fde8e8; color: #c0392b; }

/* ── TRANSPORT TAB ── */
.transport-day { margin-bottom: 2.5rem; }
.transport-day-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.transport-day-label {
  background: var(--ink);
  color: var(--paper);
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 0.25em 0.7em;
  border-radius: 3px;
  white-space: nowrap;
}
.transport-day-sub {
  font-size: 0.82rem;
  color: var(--muted);
  letter-spacing: 0.03em;
}
.transport-table-wrap {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid #e0d8cc;
}
.transport-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  background: white;
}
.transport-table thead tr { background: var(--ink); color: var(--paper); }
.transport-table th {
  padding: 0.6rem 0.75rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
}
.transport-table tbody tr {
  border-bottom: 1px solid #f0e8dc;
  transition: background 0.15s;
}
.transport-table tbody tr:hover { background: #fdf8f2; }
.transport-table tbody tr:last-child { border-bottom: none; }
.transport-table td {
  padding: 0.6rem 0.75rem;
  vertical-align: middle;
  line-height: 1.5;
}
.transport-table td.route {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  color: var(--blue);
  white-space: nowrap;
}
.transport-table td.time {
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  white-space: nowrap;
  color: var(--ink);
  font-weight: 600;
}
.transport-table td.suica {
  font-family: 'DM Mono', monospace;
  font-size: 0.72rem;
  text-align: center;
  color: var(--sage);
  font-weight: 600;
}
.transport-table tr.backup-row td          { background: #f8f6f2; color: #aaa; }
.transport-table tr.backup-row td.route    { color: #bbb; }
.transport-table tr.backup-row td.time     { color: #bbb; }
.transport-table tr.backup-row td.suica    { color: #bbb; }
.backup-tag {
  display: inline-block;
  font-size: 0.58rem;
  font-family: 'DM Mono', monospace;
  background: #e8e0d4;
  color: #999;
  padding: 0.1em 0.45em;
  border-radius: 2px;
  margin-left: 0.3em;
  vertical-align: middle;
  letter-spacing: 0.03em;
}
.line-name {
  display: inline-block;
  background: #e8f0fa;
  color: var(--blue);
  font-size: 0.65rem;
  font-family: 'DM Mono', monospace;
  padding: 0.1em 0.5em;
  border-radius: 2px;
  margin-left: 0.3em;
  vertical-align: middle;
  font-weight: 600;
}

/* ── PAYMENT TAB 通用 ── */
.pay-section-label {
  font-family: 'DM Mono', monospace; font-size: 0.63rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem;
}
.pay-trip-badge {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--ink); color: var(--paper);
  font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.06em;
  padding: 0.4rem 0.9rem; border-radius: 4px; margin-bottom: 1.5rem;
}
.pay-trip-badge .q-badge {
  background: #b8860b; color: #fff; font-size: 0.6rem;
  padding: 0.1em 0.5em; border-radius: 3px; font-weight: 700;
}
.pay-sub-tabs {
  display: flex; gap: 0; border-bottom: 2px solid #e0d8cc; margin-bottom: 1.5rem; overflow-x: auto;
}
.pay-sub-btn {
  background: none; border: none; font-family: 'Noto Serif TC', serif;
  font-size: 0.82rem; padding: 0.65rem 1.2rem; cursor: pointer;
  color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -2px;
  transition: all 0.2s; white-space: nowrap;
}
.pay-sub-btn.active { color: var(--ink); border-bottom-color: var(--ink); font-weight: 700; }
.pay-sub-panel { display: none; }
.pay-sub-panel.active { display: block; }

.pay-venue-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.6rem; margin-bottom: 1.2rem;
}
.pay-venue-btn {
  background: white; border: 1.5px solid #ddd5c8; border-radius: 6px;
  padding: 0.7rem 0.3rem; text-align: center; cursor: pointer; transition: all 0.18s;
  font-size: 0.78rem;
}
.pay-venue-btn .icon { font-size: 1.3rem; display: block; margin-bottom: 0.2rem; }
.pay-venue-btn:hover { border-color: var(--blue); }
.pay-venue-btn.active { border-color: var(--ink); background: var(--ink); color: #f0c040; }
.pay-analyze-btn {
  background: var(--ink); color: #f0c040;
  font-family: 'DM Mono', monospace; font-size: 0.75rem; letter-spacing: 0.07em;
  text-transform: uppercase; padding: 0.65rem 1.4rem; border: none; cursor: pointer;
  border-radius: 4px; transition: all 0.18s;
}
.pay-analyze-btn:hover { background: #2a1e22; transform: translateY(-1px); }

.pay-ai-box {
  background: var(--ink); color: var(--paper); border-radius: 8px;
  padding: 1.3rem 1.6rem; margin: 1rem 0; position: relative; overflow: hidden;
}
.pay-ai-box::before { content: '✦'; font-size: 5rem; color: rgba(255,255,255,0.04); position: absolute; right: 1rem; top: -0.5rem; pointer-events: none; }
.pay-ai-title { font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: #f0c040; margin-bottom: 0.6rem; }
.pay-ai-best { font-size: 1.05rem; font-weight: 900; margin-bottom: 0.4rem; }
.pay-ai-reason { font-size: 0.8rem; color: rgba(255,255,255,0.72); line-height: 1.7; }
.pay-shimmer {
  height: 3px; background: linear-gradient(90deg, #f0c040, #c0392b, #f0c040);
  background-size: 200%; animation: payShimmer 1.5s infinite; border-radius: 2px; margin: 0.8rem 0;
}
@keyframes payShimmer { 0%{background-position:200%} 100%{background-position:-200%} }
.pay-shimmer-text { font-family: 'DM Mono', monospace; font-size: 0.7rem; color: var(--muted); text-align: center; }

.pay-rank-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.pay-rank-table th {
  font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--muted); text-align: left;
  padding: 0.5rem 0.75rem; border-bottom: 2px solid #e0d8cc; white-space: nowrap;
}
.pay-rank-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f0e8dc; vertical-align: middle; }
.pay-rank-table tr:last-child td { border-bottom: none; }
.pay-rank-table tr:hover td { background: #fdf8f2; }
.pay-rank-1 td:first-child { border-left: 3px solid #b8860b; }
.pay-rank-2 td:first-child { border-left: 3px solid #aaa; }
.pay-rank-3 td:first-child { border-left: 3px solid #cd7f32; }

.pay-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.pay-card-promo { background: white; border: 1.5px solid #ddd5c8; border-radius: 8px; padding: 1.1rem 1.3rem; transition: border-color 0.18s; }
.pay-card-promo:hover { border-color: var(--blue); }
.pay-card-issuer { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.3rem; }
.pay-card-name { font-weight: 900; font-size: 0.95rem; margin-bottom: 0.6rem; }
.pay-promo-list { list-style: none; }
.pay-promo-list li { display: flex; justify-content: space-between; align-items: baseline; padding: 0.3rem 0; border-bottom: 1px dashed #e0d8cc; font-size: 0.8rem; gap: 0.5rem; }
.pay-promo-list li:last-child { border-bottom: none; }
.pay-promo-desc { color: var(--muted); flex: 1; line-height: 1.4; }
.pay-promo-rate { font-family: 'DM Mono', monospace; font-weight: 700; color: var(--red); white-space: nowrap; }
.pay-promo-cap { font-family: 'DM Mono', monospace; font-size: 0.62rem; color: var(--muted); margin-top: 0.6rem; line-height: 1.7; }
.pay-tip-box { background: linear-gradient(135deg, #fff8e7, #faf7f0); border: 1.5px solid #e0d8cc; border-radius: 8px; padding: 1.1rem 1.3rem; font-size: 0.82rem; line-height: 2; color: var(--muted); }
.pay-tip-box strong { color: var(--ink); }
.pay-badge { font-family: 'DM Mono', monospace; font-size: 0.6rem; padding: 0.15rem 0.5rem; border-radius: 20px; }
.pay-badge-gold  { background: #f0c040; color: var(--ink); }
.pay-badge-green { background: #27ae60; color: #fff; }
.pay-badge-gray  { background: #e0d8cc; color: var(--muted); }

/* ── FOOD TABLE ── */
.food-table-wrap {
  overflow-x: auto;
  border-radius: 6px;
  border: 1px solid #e0d8cc;
  width: 100%;
}
.food-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  background: white;
  table-layout: fixed;
}
.food-table thead tr { background: var(--ink); color: var(--paper); }
.food-table th {
  padding: 0.6rem 0.4rem;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  font-weight: 500;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.food-table tbody tr { border-bottom: 1px solid #f0e8dc; transition: background 0.15s; }
.food-table tbody tr:hover { background: #fdf8f2; }
.food-table tbody tr:last-child { border-bottom: none; }
.food-table td {
  padding: 0.5rem 0.4rem;
  vertical-align: middle;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── ITINERARY PAYMENT PANEL ── */
.period-lbl {
  font-family: 'DM Mono', monospace; font-size: 0.63rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem;
}
.spot-row {
  display: grid; grid-template-columns: 22px 1fr 100px;
  gap: 0 0.75rem; margin-bottom: 0.5rem; align-items: start; position: relative;
}
.spot-ico { font-size: 0.95rem; padding-top: 0.1rem; }
.spot-body {
  background: #fff; border: 1.5px solid #e0d8cc; border-radius: 5px;
  padding: 0.5rem 0.85rem; position: relative; transition: opacity 0.2s, border-color 0.2s;
}

/* ── 略過狀態 ── */
.spot-row.skipped .spot-body   { opacity: 0.38; border-color: #ccc; background: #f8f6f3; }
.spot-row.skipped .spot-ico    { opacity: 0.3; }
.spot-row.skipped .pay-col     { opacity: 0.3; pointer-events: none; }
.spot-row.skipped .spot-body::after {
  content: '';
  position: absolute; inset: 0; border-radius: 4px;
  background: repeating-linear-gradient(-52deg, transparent, transparent 7px, rgba(0,0,0,0.055) 7px, rgba(0,0,0,0.055) 8.5px);
  pointer-events: none;
}
.skip-badge {
  position: absolute; top: 0.3rem; right: 0.5rem;
  font-family: 'DM Mono', monospace; font-size: 0.58rem; font-weight: 700;
  letter-spacing: 0.06em; color: #aaa; background: #f0ece6;
  border: 1px solid #ccc; border-radius: 3px;
  padding: 0.1em 0.45em; pointer-events: none;
}
.skip-btn {
  display: none;
  font-family: 'DM Mono', monospace; font-size: 0.55rem; letter-spacing: 0.04em;
  background: none; border: 1px dashed #ccc; color: #bbb;
  padding: 0.15rem 0.45rem; border-radius: 3px; cursor: pointer;
  transition: all 0.15s; white-space: nowrap; margin-top: 0.3rem; line-height: 1.5;
}
.skip-btn:hover { border-color: #999; color: #777; background: #f8f5f0; }
.skip-btn.active { border-color: #27ae60; color: #27ae60; background: rgba(39,174,96,0.07); }
.tracker-on .skip-btn { display: inline-block; }
.spot-row.skipped .skip-btn { display: inline-block; color: #27ae60; border-color: #27ae60; background: rgba(39,174,96,0.07); }

.spot-name  { font-size: 0.86rem; font-weight: 700; line-height: 1.4; }
.spot-note  { font-size: 0.72rem; color: var(--muted); margin-top: 0.12rem; line-height: 1.45; }
.spot-alert { color: var(--red); font-weight: 700; }
.pay-col { display: flex; flex-direction: column; gap: 0.28rem; align-items: flex-end; padding-top: 0.4rem; position: relative; }

/* ── CARD CHIPS ── */
.pb {
  font-family: 'DM Mono', monospace; font-size: 0.6rem; font-weight: 700;
  padding: 0.18em 0.55em; border-radius: 3px; white-space: nowrap; letter-spacing: 0.02em;
}
.pb-kuma  { background: #fff0d4; color: #b8680b; border: 1px solid #e8c080; }
.pb-eco   { background: #d4f0e0; color: #2e7d52; border: 1px solid #80c8a0; }
.pb-rich  { background: #d4e4f5; color: #2c5f8a; border: 1px solid #80a8d8; }
.pb-pay   { background: #ffe0e0; color: #cc0033; border: 1px solid #f0a0a0; }
.pb-suica { background: #d8f0dc; color: #3a8a4a; border: 1px solid #88cc90; }
.pb-cash  { background: #f0ebe5; color: #999;    border: 1px solid #ccc; }
.pb-rate  { font-family: 'DM Mono', monospace; font-size: 0.7rem; font-weight: 900; }
.pb-rate.gold  { color: #b8680b; }
.pb-rate.green { color: #2e7d52; }
.pb-rate.blue  { color: #cc0033; }
.pb-rate.gray  { color: #999; }

/* ── ITIN BOXES ── */
.itin-note-box {
  background: linear-gradient(135deg,#fff8e7,white);
  border: 1.5px solid #e0d8cc; border-radius: 8px;
  padding: 1rem 1.2rem; font-size: 0.8rem; line-height: 1.9; color: var(--muted);
  margin-bottom: 1rem;
}
.itin-note-box strong { color: var(--ink); }
.itin-alert-box {
  background: #fff0f0; border: 1.5px solid #e88; border-radius: 8px;
  padding: 1rem 1.2rem; font-size: 0.8rem; line-height: 1.85; margin-bottom: 1rem;
}
.itin-summary-table { width:100%; border-collapse:collapse; font-size:0.81rem; margin-top:0.5rem; }
.itin-summary-table th { font-family:'DM Mono',monospace; font-size:0.6rem; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); padding:0.5rem 0.7rem; border-bottom:2px solid #e0d8cc; text-align:left; white-space:nowrap; }
.itin-summary-table td { padding:0.62rem 0.7rem; border-bottom:1px solid #f0e8dc; vertical-align:middle; }
.itin-summary-table tr:last-child td { border-bottom:none; }
.itin-summary-table tr:hover td { background:rgba(0,0,0,0.015); }
.cat-row td { background:var(--cream); font-weight:700; font-size:0.75rem; color:var(--muted); letter-spacing:0.04em; padding:0.4rem 0.7rem; }

/* ── ITIN DAY (追蹤器支付面板) ── */
.itin-day { margin-bottom: 2rem; }
.itin-day-head {
  display: flex; align-items: flex-start; gap: 0.75rem;
  background: var(--cream); border-radius: 6px;
  padding: 0.65rem 1rem; margin-bottom: 0.6rem;
}
.itin-day-num {
  font-family: 'DM Mono', monospace; font-size: 1.5rem; font-weight: 900;
  line-height: 1; color: var(--ink); min-width: 2.2rem;
}
.itin-day-title { font-size: 0.9rem; font-weight: 700; line-height: 1.4; }
.itin-day-sub   { font-size: 0.72rem; color: var(--muted); line-height: 1.55; margin-top: 0.15rem; }

/* ── PRINT ── */
@media print {
  header::before { display: none; }
  .day-block { page-break-inside: avoid; }
}
