// 自動播放 — 單次執行，由 background.js 在每次頁面載入後重新注入
(async function autoPlayOne() {
  if (window.__elearnAutoplayRunning) {
    console.log('[eLH] 已在執行中，跳過重複注入');
    return;
  }
  window.__elearnAutoplayRunning = true;

  const LOG = (...args) => console.log('[eLH]', ...args);
  const LOG_W = (...args) => console.warn('[eLH]', ...args);

  // ── window.name 狀態讀寫 ────────────────────────────
  // window.name 在同 tab 頁面導航時會保留，用來跨頁傳遞輪次

  function loadState() {
    try { return JSON.parse(window.name || '{}'); } catch (e) { return {}; }
  }

  function saveState(patch) {
    const s = loadState();
    window.name = JSON.stringify({ ...s, ...patch });
  }

  function markDone() {
    saveState({ __elearnDone: true, __elearnRound: undefined });
  }

  // ── 懸浮狀態面板 ──────────────────────────────────

  function createPanel(round) {
    const el = document.createElement('div');
    el.id = '__elearn_panel';
    el.innerHTML = `
      <div id="__ep_header">
        <span id="__ep_title">▶ 自動播放中</span>
        <button id="__ep_close" title="停止並關閉">✕</button>
      </div>
      <div id="__ep_body">
        <div id="__ep_round">第 ${round} 個影片</div>
        <div id="__ep_status">等待影片載入...</div>
        <div id="__ep_time">— / —</div>
        <div id="__ep_bar_wrap"><div id="__ep_bar"></div></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #__elearn_panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 260px;
        background: rgba(15, 15, 30, 0.93);
        border: 1px solid #4c1d95;
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        color: #e0e0e0;
        overflow: hidden;
        backdrop-filter: blur(8px);
      }
      #__ep_header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(109, 40, 217, 0.35);
        border-bottom: 1px solid #4c1d95;
        cursor: grab;
        user-select: none;
      }
      #__ep_header:active { cursor: grabbing; }
      #__ep_title { font-weight: 600; color: #c4b5fd; font-size: 12px; }
      #__ep_close {
        background: none; border: none; color: #9ca3af;
        cursor: pointer; font-size: 12px; padding: 0 2px; line-height: 1;
      }
      #__ep_close:hover { color: #f87171; }
      #__ep_body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
      #__ep_round { font-weight: 600; color: #a78bfa; font-size: 13px; }
      #__ep_status { color: #d1d5db; font-size: 11px; min-height: 16px; }
      #__ep_time { color: #6b7280; font-size: 11px; font-variant-numeric: tabular-nums; margin-top: 2px; }
      #__ep_bar_wrap { margin-top: 6px; height: 4px; background: #1f2937; border-radius: 2px; overflow: hidden; }
      #__ep_bar {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, #7c3aed, #a78bfa);
        border-radius: 2px; transition: width 0.5s linear;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(el);

    // 關閉 → 停止整個流程（包含跨頁追蹤）
    document.getElementById('__ep_close').addEventListener('click', () => {
      window.__elearnAutoplayRunning = false;
      markDone();
      el.remove();
      style.remove();
      LOG('使用者手動停止');
    });

    // 拖曳
    const header = document.getElementById('__ep_header');
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === '__ep_close') return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      el.style.bottom = 'auto'; el.style.right = 'auto';
      el.style.top = rect.top + 'px'; el.style.left = rect.left + 'px';
      ox = e.clientX - rect.left; oy = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - el.offsetWidth)) + 'px';
      el.style.top = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - el.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    return {
      setStatus: (msg) => { document.getElementById('__ep_status').textContent = msg; },
      setTime: (cur, tot) => {
        document.getElementById('__ep_time').textContent = `${fmt(cur)} / ${fmt(tot)}`;
        const pct = tot > 0 ? Math.min((cur / tot) * 100, 100) : 0;
        document.getElementById('__ep_bar').style.width = pct + '%';
      },
      setDone: (msg) => {
        document.getElementById('__ep_title').textContent = '✅ 播放完成';
        document.getElementById('__ep_status').textContent = msg;
        document.getElementById('__ep_bar').style.width = '100%';
        document.getElementById('__ep_bar').style.background = '#10b981';
      },
      setError: (msg) => {
        document.getElementById('__ep_title').textContent = '❌ 發生錯誤';
        document.getElementById('__ep_status').textContent = msg;
        document.getElementById('__ep_bar').style.background = '#ef4444';
      },
    };
  }

  // ── 工具函式 ──────────────────────────────────────

  function findVideo(win, depth) {
    if (depth > 5) return null;
    try {
      const vids = win.document.querySelectorAll('video');
      if (vids.length > 0) return vids[0];
      for (const f of win.document.querySelectorAll('iframe')) {
        try { const r = findVideo(f.contentWindow, depth + 1); if (r) return r; } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  function waitForVideo(timeout = 60000) {
    LOG('waitForVideo 開始...');
    let lastLog = '';
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const v = findVideo(window, 0);
        if (!v) { if (lastLog !== 'novid') { LOG('  poll: 尚未找到 <video>'); lastLog = 'novid'; } return; }
        const src = v.currentSrc || v.src || '(無src)';
        const key = `${src}|${v.readyState}|${v.ended}`;
        if (key !== lastLog) {
          LOG(`  poll: readyState=${v.readyState} ended=${v.ended} duration=${v.duration?.toFixed(1)} src=${src}`);
          lastLog = key;
        }
        if (v.readyState >= 3 && v.duration > 0 && !v.ended) {
          clearInterval(timer);
          LOG(`waitForVideo 完成`);
          resolve(v);
        }
        if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error('等待影片逾時'));
        }
      }, 1000);
    });
  }

  function waitForEnd(video, panel) {
    return new Promise((resolve) => {
      if (video.ended) { LOG('影片已 ended，直接繼續'); resolve(); return; }
      const ticker = setInterval(() => {
        if (!window.__elearnAutoplayRunning) { clearInterval(ticker); resolve(); return; }
        panel.setTime(video.currentTime, video.duration);
      }, 500);
      video.addEventListener('ended', () => {
        clearInterval(ticker);
        LOG('收到 ended 事件');
        resolve();
      }, { once: true });
    });
  }

  function findNextBtn(win, depth) {
    if (depth > 5) return null;
    try {
      const btn = win.document.querySelector('button[onclick="javascript:goNext()"]');
      if (btn) return { btn, win };
      for (const f of win.document.querySelectorAll('iframe')) {
        try { const r = findNextBtn(f.contentWindow, depth + 1); if (r) return r; } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  function clickNext(found) {
    try { LOG('呼叫 win.goNext()'); found.win.goNext(); }
    catch (e) { LOG_W('goNext() 失敗，改用 btn.click():', e.message); found.btn.click(); }
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return '--:--:--';
    return new Date(sec * 1000).toISOString().substr(11, 8);
  }

  // ── 主流程（單次，靠 background.js 重新注入繼續）────────

  const state = loadState();
  const round = state.__elearnRound || 1;

  LOG(`========== 第 ${round} 個影片 ==========`);

  const panel = createPanel(round);
  panel.setStatus('等待影片載入...');

  let video;
  try {
    video = await waitForVideo(60000);
  } catch (e) {
    LOG_W('影片載入失敗');
    panel.setError('影片載入失敗或逾時');
    markDone();
    window.__elearnAutoplayRunning = false;
    return;
  }

  LOG(`影片載入完成，duration=${fmt(video.duration)}`);
  panel.setStatus(`載入完成，共 ${fmt(video.duration)}`);
  panel.setTime(0, video.duration);

  try {
    await video.play();
    panel.setStatus('播放中...');
    LOG('video.play() 成功');
  } catch (e) {
    // Chrome autoplay policy：先靜音播放，成功後立刻恢復音量
    LOG_W('video.play() 被擋，嘗試靜音播放：', e.message);
    try {
      const prevMuted = video.muted;
      const prevVolume = video.volume;
      video.muted = true;
      await video.play();
      video.muted = prevMuted;
      video.volume = prevVolume;
      panel.setStatus('播放中...');
      LOG('靜音播放成功，已恢復音量');
    } catch (e2) {
      panel.setStatus('⚠️ 自動播放被擋，請手動點擊播放');
      LOG_W('靜音播放仍失敗：', e2.message);
    }
  }

  await waitForEnd(video, panel);

  if (!window.__elearnAutoplayRunning) {
    LOG('使用者已停止');
    return;
  }

  LOG('播放完畢，尋找「下一個」按鈕...');
  panel.setStatus('播放完畢，尋找下一個...');

  await new Promise(r => setTimeout(r, 1000));

  const found = findNextBtn(window, 0);
  LOG(`找到按鈕: ${!!found}`);

  if (!found) {
    LOG('沒有「下一個」，全部完成');
    panel.setDone(`共完成 ${round} 個影片`);
    markDone();
    window.__elearnAutoplayRunning = false;
    return;
  }

  // 儲存下一輪的輪次到 window.name，讓 background 重新注入後可以讀到
  saveState({ __elearnRound: round + 1, __elearnDone: false });
  LOG(`儲存狀態 round=${round + 1}，準備跳至下一頁`);
  panel.setStatus('切換至下一個影片...');

  clickNext(found);
  // 頁面即將導航，腳本會消失，background.js 負責重新注入
})();
