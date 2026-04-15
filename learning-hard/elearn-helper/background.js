// background.js — service worker，跨頁面維持自動播放狀態

const LOG = (...args) => console.log('[eLH-bg]', ...args);

// 從 window.name 讀取狀態（在 MAIN world 執行）
function readWindowName(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      try { return JSON.parse(window.name || '{}'); } catch (e) { return {}; }
    },
  }).then(results => results?.[0]?.result || {}).catch(() => ({}));
}

// 注入自動播放腳本
async function injectAutoplay(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['scripts/autoplay.js'],
      world: 'MAIN',
    });
    LOG(`注入 autoplay.js → tab ${tabId}`);
  } catch (e) {
    LOG('注入失敗：', e.message);
  }
}

// tab 頁面載入完成時，檢查是否需要重新注入
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;

  const { autoplayTabs = [] } = await chrome.storage.session.get('autoplayTabs');
  if (!autoplayTabs.includes(tabId)) return;

  // 讀取 window.name 確認是否還要繼續
  const state = await readWindowName(tabId);

  if (state.__elearnDone) {
    LOG(`tab ${tabId} 標記為完成，停止追蹤`);
    const tabs = autoplayTabs.filter(id => id !== tabId);
    await chrome.storage.session.set({ autoplayTabs: tabs });
    return;
  }

  LOG(`tab ${tabId} 頁面載入完成，重新注入 autoplay`);
  await injectAutoplay(tabId);
});

// 處理 popup 送來的訊息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const { autoplayTabs = [] } = await chrome.storage.session.get('autoplayTabs');

    if (msg.action === 'startAutoplay') {
      const tabId = msg.tabId;
      if (!autoplayTabs.includes(tabId)) {
        autoplayTabs.push(tabId);
        await chrome.storage.session.set({ autoplayTabs });
      }
      LOG(`開始追蹤 tab ${tabId}`);
      await injectAutoplay(tabId);
      sendResponse({ ok: true });

    } else if (msg.action === 'stopAutoplay') {
      const tabId = msg.tabId;
      const tabs = autoplayTabs.filter(id => id !== tabId);
      await chrome.storage.session.set({ autoplayTabs: tabs });
      LOG(`停止追蹤 tab ${tabId}`);
      sendResponse({ ok: true });

    } else if (msg.action === 'isAutoplayActive') {
      sendResponse({ active: autoplayTabs.includes(msg.tabId) });
    }
  })();
  return true; // 保持非同步 sendResponse
});
