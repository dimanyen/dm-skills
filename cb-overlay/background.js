// background.js — 點擊 extension icon → 通知當前 tab 切換 overlay 顯隱
const TAG = '[CB-Overlay:bg]';

chrome.action.onClicked.addListener(async (tab) => {
  console.log(TAG, 'action clicked, tab:', tab?.id, tab?.url);
  if (!tab || !tab.id) return;

  // 非原站台頁面 → 設提示旗標後導向原站台（content script 載入後會顯示引導提示）
  if (!/^https:\/\/booking\.cathayholdings\.com\//.test(tab.url || '')) {
    console.log(TAG, '非原站台頁面，導向原站台');
    await chrome.storage.local.set({ cb_needs_hint: true });
    chrome.tabs.update(tab.id, { url: 'https://booking.cathayholdings.com/' });
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'CB_TOGGLE_OVERLAY' });
  } catch (err) {
    console.warn(TAG, 'sendMessage 失敗（可能 content script 未注入，請重新整理）:', err.message);
  }
});
