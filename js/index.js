/**
 * index.js — 旅遊首頁（index.html）專用 JavaScript
 *
 * 功能：
 *   - 「新增旅程」Modal 開關
 *   - 顏色 Swatch 選擇
 *   - 產生新行程 HTML 模板並下載
 */

/* ── Modal 開關 ── */
function openModal() {
  document.getElementById('tripModal').classList.add('open');
}
function closeModal() {
  document.getElementById('tripModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  // 點選 overlay 背景關閉
  document.getElementById('tripModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Swatch 選色
  document.getElementById('swatches')?.addEventListener('click', function(e) {
    const sw = e.target.closest('.swatch');
    if (!sw) return;
    this.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
  });

  // ESC 關閉
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

/* ── 日期格式化 ── */
function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${y} / ${m} / ${day}`;
}

function calcNights(start, end) {
  if (!start || !end) return { days: '?', nights: '?' };
  const diff = (new Date(end) - new Date(start)) / 86400000;
  return { days: diff + 1, nights: diff };
}

/* ── 產生並下載行程 HTML ── */
function createTrip() {
  const dest    = document.getElementById('f-dest').value.trim();
  const sub     = document.getElementById('f-sub').value.trim();
  const start   = document.getElementById('f-start').value;
  const end     = document.getElementById('f-end').value;
  const country = document.getElementById('f-country').value.trim() || '日本';
  const flag    = document.getElementById('f-flag').value.trim()    || '🌍';
  const tagsRaw = document.getElementById('f-tags').value.trim();
  const grad    = document.querySelector('#swatches .swatch.selected')?.dataset.grad
                  || 'linear-gradient(90deg,#c0392b,#e67e22)';

  if (!dest) { alert('請填寫目的地名稱'); return; }

  const tags         = tagsRaw ? tagsRaw.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [country];
  const { days, nights } = calcNights(start, end);
  const year         = start ? start.split('-')[0] : new Date().getFullYear();
  const filename     = `${year}_${dest.replace(/\s+/g, '_')}.html`;
  const tagsHtml     = tags.map(t => `            <span class="day-badge">${t}</span>`).join('\n');
  const dateDisplay  = start && end
    ? `${formatDate(start)} – ${formatDate(end).slice(-8)}`
    : '待定';

  // ── 新行程 HTML 模板 ──
  // 引用共用的 css/ 與 js/ 檔案，不再內嵌 CSS
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${dest} · 旅遊記錄</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@400;600;900&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/trip-page.css">
<style>
  /* ── 本旅程專屬：Header 背景文字 ── */
  header::before {
    content: '${dest.slice(0, 2)}';
    position: absolute;
    font-size: 18rem;
    font-weight: 900;
    opacity: 0.04;
    top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    white-space: nowrap;
    pointer-events: none;
  }
  /* ── 本旅程主色調（Banner 漸層） ── */
  header::after {
    content: '';
    position: absolute; inset: 0;
    background: ${grad};
    opacity: 0.15;
  }
</style>
</head>
<body>

<header>
  <div class="date-tag">${flag} ${country} · ${dateDisplay}</div>
  <h1>${dest}</h1>
  <p>${sub || '行程記錄'}</p>
</header>
<div class="divider"></div>

<div class="tab-nav">
  <button class="tab-btn active" onclick="switchTab('itinerary',this)">📅 行程總覽</button>
</div>

<!-- ══ TAB: 行程總覽 ══ -->
<div id="itinerary" class="tab-panel active">
<main>
  <a class="back-link" href="index.html" style="display:inline-flex;align-items:center;gap:0.4rem;font-family:'DM Mono',monospace;font-size:0.7rem;letter-spacing:0.1em;color:var(--gold);text-decoration:none;margin-bottom:2rem;opacity:0.8;">← 返回旅遊首頁</a>

  <div class="tags-row" style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-bottom:2rem;">
${tagsHtml}
  </div>

  <!-- ── DAY 1 ── -->
  <div class="day-block">
    <div class="day-header">
      <div class="day-label">D1</div>
      <div class="day-sub">${start ? formatDate(start) : '第一天'} · 出發・抵達</div>
    </div>
    <div class="period">
      <div class="period-title">早上・出發</div>
      <div class="event">
        <div class="event-type"><span class="tag tag-transport">交通</span></div>
        <div class="event-body">
          <div class="event-name">✈ 出發</div>
          <div class="event-note">從台灣出發，前往${country}。</div>
        </div>
      </div>
    </div>
    <div class="period">
      <div class="period-title">下午・抵達</div>
      <div class="event">
        <div class="event-type"><span class="tag tag-spot">景點</span></div>
        <div class="event-body">
          <div class="event-name">抵達・Check-in</div>
          <div class="event-note">抵達目的地，辦理入住手續。</div>
        </div>
      </div>
    </div>
    <div class="period">
      <div class="period-title">晚上</div>
      <div class="event">
        <div class="event-type"><span class="tag tag-meal">餐飲</span></div>
        <div class="event-body">
          <div class="event-name">晚餐</div>
          <div class="event-note">探索當地餐廳，享用第一頓在地美食。</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 複製上方 .day-block 區塊，修改 Day 數字與內容 -->

</main>
</div>

<footer>
  Travel / ${filename} &nbsp;·&nbsp; ${dest} &nbsp;·&nbsp; ${year}
</footer>

<script src="js/tabs.js"><\/script>
</body>
</html>`;

  // ── 下載 ──
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  closeModal();
  alert(`✅ 已產生 ${filename}！\n請將檔案放入 Travel/ 資料夾，並手動將此旅程加入 index.html 的卡片列表。`);
}
