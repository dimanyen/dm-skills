/* 表格 → Markdown 轉換邏輯（popup 與 preview 共用） */

/* 將單一儲存格內容清理成 Markdown 表格可安全使用的字串 */
function cellToMd(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/ /g, ' ')        // 不換行空白 → 一般空白
    .replace(/\s*\n\s*/g, '<br>')   // 儲存格內換行 → <br>
    .replace(/\|/g, '\\|')          // 跳脫直線，避免破壞表格欄位
    .trim();
}

/* 解析 HTML 中的第一個 <table> 為二維陣列；找不到表格回傳 null */
function htmlTableToMatrix(html) {
  if (!html) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const rows = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach((cell) => {
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
      const text = cell.innerText !== undefined ? cell.innerText : cell.textContent;
      cells.push(text);
      // Markdown 不支援合併欄，colspan 以空白欄補齊以維持對齊
      for (let i = 1; i < colspan; i++) cells.push('');
    });
    if (cells.length) rows.push(cells);
  });
  return rows.length ? rows : null;
}

/* 解析有引號的分隔文字（TSV/CSV），支援引號內換行與跳脫引號 */
function parseDelimited(text, delim) {
  if (!text) return null;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // 去掉全空的行
  const cleaned = rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
  return cleaned.length ? cleaned : null;
}

/* 將二維陣列轉成對齊美觀的 Markdown 表格 */
function matrixToMarkdown(matrix, opts) {
  opts = opts || {};
  if (!matrix || !matrix.length) return '';
  const headerFirst = opts.headerFirstRow !== false;

  const cols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  if (!cols) return '';

  // 正規化：清理每格、補齊欄數
  const norm = matrix.map((r) => {
    const c = r.map(cellToMd);
    while (c.length < cols) c.push('');
    return c;
  });

  let header;
  let body;
  if (headerFirst) {
    header = norm[0];
    body = norm.slice(1);
  } else {
    header = Array.from({ length: cols }, (_, j) => '欄位 ' + (j + 1));
    body = norm;
  }

  // 計算每欄寬度（讓輸出對齊、好讀）
  const widths = [];
  for (let j = 0; j < cols; j++) {
    let w = header[j].length;
    for (const r of body) w = Math.max(w, r[j].length);
    widths[j] = Math.max(3, w);
  }

  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
  const lines = [];
  lines.push('| ' + header.map((c, j) => pad(c, widths[j])).join(' | ') + ' |');
  lines.push('| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |');
  for (const r of body) {
    lines.push('| ' + r.map((c, j) => pad(c, widths[j])).join(' | ') + ' |');
  }
  return lines.join('\n');
}

/* 主入口：給定剪貼簿的 html 與純文字，回傳 Markdown 字串 */
function convertClipboardToMarkdown(html, plain, opts) {
  let matrix = htmlTableToMatrix(html);
  if (!matrix) matrix = parseDelimited(plain, '\t');   // Excel / Sheets 預設 TSV
  if (!matrix) matrix = parseDelimited(plain, ',');     // 退回 CSV
  if (!matrix) return '';
  return matrixToMarkdown(matrix, opts);
}

// 同時支援瀏覽器全域與（測試用）CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cellToMd,
    htmlTableToMatrix,
    parseDelimited,
    matrixToMarkdown,
    convertClipboardToMarkdown,
  };
}
