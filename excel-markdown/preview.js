/* 預覽頁邏輯 */

const renderedEl = document.getElementById('rendered');
const sourceEl = document.getElementById('source');
const tabRendered = document.getElementById('tabRendered');
const tabSource = document.getElementById('tabSource');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');

let markdown = '';

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function load() {
  chrome.storage.local.get('previewMarkdown', (data) => {
    markdown = (data && data.previewMarkdown) || '';
    if (!markdown) {
      renderedEl.innerHTML = '<div class="empty">沒有可預覽的內容，請先在套件視窗轉換表格。</div>';
      sourceEl.textContent = '';
      return;
    }
    renderedEl.innerHTML = renderMarkdown(markdown);
    sourceEl.textContent = markdown;
  });
}

function showTab(which) {
  const rendered = which === 'rendered';
  renderedEl.hidden = !rendered;
  sourceEl.hidden = rendered;
  tabRendered.classList.toggle('active', rendered);
  tabSource.classList.toggle('active', !rendered);
}

async function copyMarkdown() {
  if (!markdown) return;
  try {
    await navigator.clipboard.writeText(markdown);
    setStatus('已複製 Markdown 到剪貼簿。');
  } catch (err) {
    setStatus('複製失敗，請改用原始碼分頁手動選取。');
  }
}

function downloadMarkdown() {
  if (!markdown) return;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
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

tabRendered.addEventListener('click', () => showTab('rendered'));
tabSource.addEventListener('click', () => showTab('source'));
copyBtn.addEventListener('click', copyMarkdown);
downloadBtn.addEventListener('click', downloadMarkdown);

load();
