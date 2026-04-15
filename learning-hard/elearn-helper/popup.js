const statusMsg = document.getElementById('status-msg');

// 狀態追蹤
const state = {
  popup: false,
  autoplay: false,
};

function setStatus(msg, color = '#6b7280') {
  statusMsg.textContent = msg;
  statusMsg.style.color = color;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 攔截彈出視窗按鈕
document.getElementById('btn-popup').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const btn = document.getElementById('btn-popup');
  const dot = document.getElementById('dot-popup');

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['scripts/intercept-popup.js'],
      world: 'MAIN',
    });

    state.popup = true;
    btn.classList.add('active');
    dot.classList.add('on');
    setStatus('✅ 彈出視窗攔截已啟用', '#60a5fa');
  } catch (e) {
    setStatus('❌ 注入失敗：' + e.message, '#f87171');
    console.error(e);
  }
});

// 自動播放按鈕
document.getElementById('btn-autoplay').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const btn = document.getElementById('btn-autoplay');
  const dot = document.getElementById('dot-autoplay');

  try {
    if (state.autoplay) {
      // 再次點擊 → 停止
      await chrome.runtime.sendMessage({ action: 'stopAutoplay', tabId: tab.id });
      // 通知頁面停止
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => {
          window.__elearnAutoplayRunning = false;
          try {
            const s = JSON.parse(window.name || '{}');
            s.__elearnDone = true;
            window.name = JSON.stringify(s);
          } catch (e) {}
        },
      });
      state.autoplay = false;
      btn.classList.remove('active');
      dot.classList.remove('on');
      setStatus('⏹ 自動播放已停止', '#6b7280');
    } else {
      // 啟動
      await chrome.runtime.sendMessage({ action: 'startAutoplay', tabId: tab.id });
      state.autoplay = true;
      btn.classList.add('active');
      dot.classList.add('on');
      setStatus('▶ 自動播放已啟動', '#34d399');
    }
  } catch (e) {
    setStatus('❌ 失敗：' + e.message, '#f87171');
    console.error(e);
  }
});
