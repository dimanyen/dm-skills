/* popup 互動邏輯 */

const dropzone = document.getElementById('dropzone');
const output = document.getElementById('output');
const headerToggle = document.getElementById('headerToggle');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const previewBtn = document.getElementById('previewBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const dimEl = document.getElementById('dim');

let lastHtml = '';
let lastPlain = '';

function setStatus(msg, isError) {
  statusEl.textContent = msg || '';
  statusEl.classList.toggle('error', !!isError);
}

function setButtonsEnabled(enabled) {
  copyBtn.disabled = !enabled;
  downloadBtn.disabled = !enabled;
  previewBtn.disabled = !enabled;
}

function updateDim(md) {
  if (!md) { dimEl.textContent = ''; return; }
  const rows = md.split('\n').filter((l) => l.trim().startsWith('|')).length;
  const dataRows = Math.max(0, rows - 2); // 扣掉標題列與分隔列
  const cols = (md.split('\n')[0].match(/\|/g) || []).length - 1;
  dimEl.textContent = cols > 0 ? `${dataRows} 列 × ${cols} 欄` : '';
}

/* 用目前選項重新轉換最近一次貼上的資料 */
function rerender() {
  if (!lastHtml && !lastPlain) return;
  const md = convertClipboardToMarkdown(lastHtml, lastPlain, {
    headerFirstRow: headerToggle.checked,
  });
  if (md) {
    output.value = md;
    setButtonsEnabled(true);
    updateDim(md);
  }
}

function handlePaste(e) {
  const cd = e.clipboardData || window.clipboardData;
  if (!cd) return;
  const html = cd.getData('text/html');
  const plain = cd.getData('text/plain');

  if (!html && !plain) {
    setStatus('剪貼簿沒有可用的表格內容。', true);
    return;
  }

  e.preventDefault();
  lastHtml = html;
  lastPlain = plain;

  const md = convertClipboardToMarkdown(html, plain, {
    headerFirstRow: headerToggle.checked,
  });

  if (!md) {
    setStatus('找不到表格結構，請確認是從 Excel 或 Google Sheets 複製整個表格。', true);
    return;
  }

  // 在貼上區顯示原始表格預覽（若有 HTML），否則顯示純文字
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    dropzone.innerHTML = '';
    dropzone.appendChild(table ? table.cloneNode(true) : document.createTextNode(plain));
  } else {
    dropzone.textContent = plain;
  }
  dropzone.classList.add('has-content');

  output.value = md;
  setButtonsEnabled(true);
  updateDim(md);
  setStatus('已轉換完成，可複製、下載或預覽。');
}

async function copyMarkdown() {
  const text = output.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('已複製 Markdown 到剪貼簿。');
  } catch (err) {
    // 後備：用 textarea 選取複製
    output.select();
    document.execCommand('copy');
    setStatus('已複製 Markdown 到剪貼簿。');
  }
}

function downloadMarkdown() {
  const text = output.value;
  if (!text) return;
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'table.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('已開始下載 table.md。');
}

function openPreview() {
  const text = output.value;
  if (!text) return;
  chrome.storage.local.set({ previewMarkdown: text }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('preview.html') });
  });
}

function clearAll() {
  lastHtml = '';
  lastPlain = '';
  output.value = '';
  dropzone.innerHTML = '<span class="placeholder">從 Excel / Google Sheets 複製表格後，按 <kbd>⌘/Ctrl + V</kbd> 貼上</span>';
  dropzone.classList.remove('has-content');
  setButtonsEnabled(false);
  updateDim('');
  setStatus('');
  dropzone.focus();
}

// 全頁面監聽貼上，方便使用者直接按 Cmd+V
document.addEventListener('paste', handlePaste);
headerToggle.addEventListener('change', rerender);
copyBtn.addEventListener('click', copyMarkdown);
downloadBtn.addEventListener('click', downloadMarkdown);
previewBtn.addEventListener('click', openPreview);
clearBtn.addEventListener('click', clearAll);
output.addEventListener('input', () => updateDim(output.value));

// 開啟時聚焦貼上區
dropzone.focus();
