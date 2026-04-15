// 攔截 window.open，改為在新 tab 開啟
(function interceptWindowOpen() {
  if (window.__elearnPopupIntercepted) {
    console.log('ℹ️ window.open 攔截已啟用（跳過重複注入）');
    return;
  }
  window.__elearnPopupIntercepted = true;

  const _originalOpen = window.open.bind(window);

  window.open = function intercepted(url, target, features) {
    if (url) {
      // 移除彈出視窗特徵，改為新分頁
      return _originalOpen(url, '_blank');
    }
    return _originalOpen(url, target, features);
  };

  console.log('✅ window.open 已攔截，將改為在新 tab 開啟');
})();
