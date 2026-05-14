/**
 * export.js — Excel（.xlsx）匯出功能（所有行程頁共用）
 *
 * 依賴：
 *   - ExcelJS（CDN 載入：cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js）
 *   - tracker.js（trackerLogs、freeLogs、TRACKER_JPY_TWD_LIVE、TRIP_CONFIG）
 *
 * 使用：在 HTML 的匯出按鈕上呼叫 exportXLSX()
 */

function exportXLSX() {
  if (typeof ExcelJS === 'undefined') {
    alert('Excel 匯出程式庫尚未載入，請確認網路連線後重試。');
    return;
  }

  const rate     = TRACKER_JPY_TWD_LIVE;
  const now      = new Date();
  const dateStr  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const FONT     = 'Microsoft JhengHei';
  const CAPS     = TRIP_CONFIG.TRACKER_CAPS;
  const SPOTS    = TRIP_CONFIG.TRACKER_SPOTS;
  const dayLbls  = TRIP_CONFIG.dayLabels;
  const name     = TRIP_CONFIG.exportName;

  // ── 收集資料 ──
  const dataRows = [];

  Object.entries(trackerLogs).forEach(([spotId, entries]) => {
    const dayKey   = spotId.slice(0, 2);
    const spotName = SPOTS[spotId]?.name || spotId;
    entries.forEach(e => {
      const cfg = CAPS[e.payUsed];
      dataRows.push({
        day:    dayLbls[dayKey] || dayKey,
        name:   spotName,
        pay:    (cfg?.label || e.payUsed).replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim(),
        jpy:    e.jpy,
        twd:    Math.round(e.twd),
        rebate: Math.round(e.rebate),
        type:   '行程據點'
      });
    });
  });

  Object.entries(freeLogs).forEach(([day, entries]) => {
    entries.forEach(e => {
      const cfg = CAPS[e.payUsed];
      dataRows.push({
        day:    dayLbls[day] || day,
        name:   e.name,
        pay:    (cfg?.label || e.payUsed).replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim(),
        jpy:    e.jpy,
        twd:    Math.round(e.twd),
        rebate: Math.round(e.rebate),
        type:   '自由記帳'
      });
    });
  });

  if (dataRows.length === 0) {
    alert('目前沒有任何記帳資料可以匯出。');
    return;
  }

  const totalJPY    = dataRows.reduce((s, r) => s + r.jpy,    0);
  const totalTWD    = dataRows.reduce((s, r) => s + r.twd,    0);
  const totalRebate = dataRows.reduce((s, r) => s + r.rebate, 0);

  // ── 建立 Workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = name;
  wb.created = now;

  // ── 共用樣式 ──
  const hdrFill    = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1A1209'} };
  const altFill    = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF5F1EA'} };
  const whtFill    = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFFFF'} };
  const totFill    = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEDE4D0'} };
  const bdrThin    = { style:'thin',   color:{argb:'FFE0D8CC'} };
  const bdrMedGold = { style:'medium', color:{argb:'FFB8860B'} };
  const bdrThinGold= { style:'thin',   color:{argb:'FFC8B88A'} };
  const bdrThinDark= { style:'thin',   color:{argb:'FF444444'} };
  const dataBorder = { top:bdrThin,     bottom:bdrThin,     left:bdrThin,     right:bdrThin     };
  const hdrBorder  = { top:bdrThinDark, bottom:bdrMedGold,  left:bdrThinDark, right:bdrThinDark };
  const totBorder  = { top:bdrMedGold,  bottom:bdrThinGold, left:bdrThinGold, right:bdrThinGold };
  const ctr = { horizontal:'center', vertical:'middle' };
  const lft = { horizontal:'left',   vertical:'middle' };

  // ════════════════════════════
  //  工作表 1：消費明細
  // ════════════════════════════
  const ws = wb.addWorksheet('消費明細');
  ws.columns = [
    { key:'day',    width:11 },
    { key:'name',   width:30 },
    { key:'pay',    width:15 },
    { key:'jpy',    width:14 },
    { key:'twd',    width:14 },
    { key:'rebate', width:13 },
    { key:'type',   width:11 },
  ];

  const hdrRow = ws.addRow(['日次','據點 / 說明','支付方式','消費（日圓）','換算（台幣）','回饋（台幣）','類型']);
  hdrRow.height = 22;
  hdrRow.eachCell((cell, c) => {
    cell.font      = { bold:true, color:{argb:'FFFFFFFF'}, name:FONT, size:11 };
    cell.fill      = hdrFill;
    cell.alignment = c === 2 ? lft : ctr;
    cell.border    = hdrBorder;
  });

  dataRows.forEach((row, i) => {
    const exRow  = ws.addRow([row.day, row.name, row.pay, row.jpy, row.twd, row.rebate, row.type]);
    const fill   = i % 2 === 1 ? altFill : whtFill;
    const isGrn  = row.rebate > 0;
    exRow.eachCell({ includeEmpty:true }, (cell, c) => {
      cell.fill   = fill;
      cell.border = dataBorder;
      cell.font   = { name:FONT, size:10 };
      if (c === 2)      { cell.alignment = lft; }
      else if (c === 4 || c === 5) { cell.numFmt = '0'; cell.alignment = ctr; }
      else if (c === 6) { cell.numFmt = '0'; cell.alignment = ctr; cell.font = { name:FONT, size:10, color:{argb: isGrn ? 'FF1E8449' : 'FF999999'} }; }
      else              { cell.alignment = ctr; }
    });
  });

  ws.addRow([]);
  const totRow = ws.addRow(['','合計','',totalJPY,totalTWD,totalRebate,'']);
  totRow.eachCell({ includeEmpty:true }, (cell, c) => {
    cell.fill   = totFill;
    cell.border = totBorder;
    if (c === 2)      { cell.font = { bold:true, name:FONT, size:10 }; cell.alignment = lft; }
    else if (c === 4 || c === 5) { cell.numFmt = '0'; cell.font = { bold:true, name:FONT, size:10 }; cell.alignment = ctr; }
    else if (c === 6) { cell.numFmt = '0'; cell.font = { bold:true, name:FONT, size:11, color:{argb:'FF1E8449'} }; cell.alignment = ctr; }
    else              { cell.font = { bold:true, name:FONT, size:10 }; cell.alignment = ctr; }
  });

  const rateRow = ws.addRow(['',`匯率基準：¥100 = NT$${(rate * 100).toFixed(2)}`,'','','','','']);
  rateRow.getCell(2).font      = { italic:true, color:{argb:'FFAAAAAA'}, name:FONT, size:9 };
  rateRow.getCell(2).alignment = lft;
  const timeRow = ws.addRow(['',`匯出時間：${now.toLocaleString('zh-TW')}`,'','','','','']);
  timeRow.getCell(2).font      = { italic:true, color:{argb:'FFAAAAAA'}, name:FONT, size:9 };
  timeRow.getCell(2).alignment = lft;

  // ════════════════════════════
  //  工作表 2：各卡回饋彙總
  // ════════════════════════════
  const ws2 = wb.addWorksheet('各卡回饋彙總');
  ws2.columns = [
    { key:'pay',    width:16 },
    { key:'count',  width:8  },
    { key:'jpy',    width:16 },
    { key:'twd',    width:16 },
    { key:'rebate', width:16 },
  ];

  const s2Hdr = ws2.addRow(['支付方式','筆數','消費日圓合計','消費台幣合計','回饋台幣合計']);
  s2Hdr.height = 22;
  s2Hdr.eachCell((cell, c) => {
    cell.font      = { bold:true, color:{argb:'FFFFFFFF'}, name:FONT, size:11 };
    cell.fill      = hdrFill;
    cell.alignment = c === 1 ? lft : ctr;
    cell.border    = hdrBorder;
  });

  const byCard = {};
  dataRows.forEach(r => {
    if (!byCard[r.pay]) byCard[r.pay] = { count:0, jpy:0, twd:0, rebate:0 };
    byCard[r.pay].count++;
    byCard[r.pay].jpy    += r.jpy;
    byCard[r.pay].twd    += r.twd;
    byCard[r.pay].rebate += r.rebate;
  });
  Object.entries(byCard).forEach(([pay, d], i) => {
    const r    = ws2.addRow([pay, d.count, d.jpy, d.twd, d.rebate]);
    const fill = i % 2 === 1 ? altFill : whtFill;
    r.eachCell({ includeEmpty:true }, (cell, c) => {
      cell.fill      = fill;
      cell.font      = { name:FONT, size:10 };
      cell.border    = dataBorder;
      cell.alignment = c === 1 ? lft : ctr;
      if (c >= 3) cell.numFmt = '0';
    });
  });

  ws2.addRow([]);
  const s2Tot = ws2.addRow(['合計', dataRows.length, totalJPY, totalTWD, totalRebate]);
  s2Tot.eachCell({ includeEmpty:true }, (cell, c) => {
    cell.fill   = totFill;
    cell.border = totBorder;
    cell.font   = c === 5
      ? { bold:true, name:FONT, size:11, color:{argb:'FF1E8449'} }
      : { bold:true, name:FONT, size:10 };
    cell.alignment = c === 1 ? lft : ctr;
    if (c >= 3) cell.numFmt = '0';
  });

  // ── 下載 ──
  wb.xlsx.writeBuffer().then(buf => {
    const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${name}_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
