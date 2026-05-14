/**
 * tabs.js — Tab 切換邏輯（所有行程頁共用）
 *
 * 使用方式（HTML 內）：
 *   <button class="tab-btn active" onclick="switchTab('itinerary', this)">📅 行程總覽</button>
 *
 * 如果頁面有 Tracker（消費追蹤器），switchTab 會在離開 payment 頁籤時
 * 自動隱藏 tracker-bar，回到 payment 時重新顯示。
 */

/**
 * 主 Tab 切換
 * @param {string} id   - tab-panel 的 id
 * @param {HTMLElement} btn - 被點擊的 .tab-btn 元素
 */
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');

  // 若 tracker 存在，離開 payment 時隱藏 tracker-bar
  const bar = document.getElementById('tracker-bar');
  if (bar) {
    if (id !== 'payment') {
      bar.classList.remove('visible');
    } else if (typeof trackerActive !== 'undefined' && trackerActive) {
      bar.classList.add('visible');
    }
  }
}

/**
 * 支付子 Tab 切換
 * @param {string} name  - pay-sub-panel 的後綴名稱（如 'itinerary'、'cards'、'tips'）
 * @param {HTMLElement} btn
 */
function switchPayTab(name, btn) {
  document.querySelectorAll('.pay-sub-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pay-sub-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pay-panel-' + name).classList.add('active');
  btn.classList.add('active');

  // 只在 itinerary 子頁籤顯示 tracker-bar
  const bar = document.getElementById('tracker-bar');
  if (bar) {
    if (name === 'itinerary' && typeof trackerActive !== 'undefined' && trackerActive) {
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  }
}

// staggered 入場動畫（每個 .event 卡片）
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.event').forEach((el, i) => {
    el.style.animationDelay = (i * 0.04) + 's';
  });
});
