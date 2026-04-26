// overlay.js — 在原站台頁面注入全屏 iframe 覆蓋原 UI，並擔任 iframe 與原站台之間的 bridge
(function () {
  'use strict';

  if (window.__cbOverlayLoaded) return;
  window.__cbOverlayLoaded = true;

  const TAG = '[CB-Overlay:cs]';
  const HOST_ID = 'cb-overlay-host';
  const FRAME_ID = 'cb-overlay-frame';
  const APP_URL = chrome.runtime.getURL('html/app.html');
  const ACTION_ICON_URL = chrome.runtime.getURL('icons/icon48.png');

  console.log(TAG, '已載入：', location.href);

  // ── Overlay UI ─────────────────────────────────────────────────────────────

  function getHost() {
    return document.getElementById(HOST_ID);
  }

  function getFrame() {
    return document.getElementById(FRAME_ID);
  }

  function ensureHost() {
    let host = getHost();
    if (host) return host;

    host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '2147483647',
      background: '#fff',
      display: 'block',
    });

    const iframe = document.createElement('iframe');
    iframe.src = APP_URL;
    iframe.id = FRAME_ID;
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: '0',
      display: 'block',
    });
    iframe.setAttribute('allow', 'clipboard-write');
    host.appendChild(iframe);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.title = '關閉並回到原站台';
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '10px',
      right: '14px',
      width: '34px',
      height: '34px',
      borderRadius: '50%',
      border: '0',
      background: 'rgba(0,0,0,0.55)',
      color: '#fff',
      fontSize: '22px',
      lineHeight: '1',
      cursor: 'pointer',
      zIndex: '1',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    });
    closeBtn.addEventListener('click', hide);
    host.appendChild(closeBtn);

    document.documentElement.appendChild(host);
    console.log(TAG, '已建立 overlay host');
    return host;
  }

  function show() {
    const host = ensureHost();
    host.style.display = 'block';
    document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';
    console.log(TAG, 'overlay show');
  }

  function hide() {
    const host = getHost();
    if (host) host.style.display = 'none';
    document.documentElement.style.overflow = '';
    if (document.body) document.body.style.overflow = '';
    console.log(TAG, 'overlay hide');
  }

  function toggle() {
    const host = getHost();
    if (!host || host.style.display === 'none') show();
    else hide();
  }

  // ── Bridge: 與原站台同源，可直接 fetch ────────────────────────────────────

  function extractCsrfFromDoc(doc) {
    return (
      doc.querySelector('input[name="_csrf"]')?.value ||
      doc.querySelector('meta[name="_csrf"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
      ''
    );
  }

  async function ensureCsrf() {
    let token = extractCsrfFromDoc(document);
    if (token) return token;
    const resp = await fetch(
      'https://booking.cathayholdings.com/frontend/mrm101w/search?',
      { method: 'GET', credentials: 'include', headers: { 'Accept': 'text/html,*/*;q=0.8' } }
    );
    if (resp.url.includes('login') || resp.url.includes('signin')) throw new Error('SESSION_EXPIRED');
    if (!resp.ok) throw new Error(`取得 search 頁失敗: ${resp.status}`);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    token = extractCsrfFromDoc(doc);
    if (!token) throw new Error('NO_CSRF');
    return token;
  }

  async function fetchRooms(options) {
    const csrf = await ensureCsrf();
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const defaultDate = `${today.getFullYear()}/${pad(today.getMonth() + 1)}/${pad(today.getDate())}`;
    const searchDate = (options.searchDate || defaultDate).replace(/-/g, '/');
    const timePeriod = options.timePeriod || (today.getHours() < 12 ? 'MORNING' : 'AFTERNOON');
    const buildingPK = options.buildingPK || '6';

    const body = new URLSearchParams({
      '_csrf': csrf,
      'searchBean.buildingPK': buildingPK,
      'searchBean.startDate': searchDate,
      'searchBean.endDate': searchDate,
      'searchBean.weekDay': '',
      'searchBean.searchDate': searchDate,
      'searchBean.searchTimePeriod': timePeriod,
      'searchBean.meetingRoomType': 'PHYSICAL',
      'selectedDate': searchDate,
      'isSearchBtn': 'true',
      'selectedTimePeriod': timePeriod,
    });

    const postResp = await fetch(
      'https://booking.cathayholdings.com/frontend/mrm101w/roomRecordSearch',
      {
        method: 'POST',
        body: body.toString(),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
      }
    );
    if (!postResp.ok) throw new Error(`roomRecordSearch 失敗: ${postResp.status}`);

    const getResp = await fetch(
      'https://booking.cathayholdings.com/frontend/mrm101w/search?',
      {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8' },
      }
    );
    if (!getResp.ok) throw new Error(`取得搜尋頁失敗: ${getResp.status}`);
    if (getResp.url.includes('login') || getResp.url.includes('signin')) throw new Error('SESSION_EXPIRED');
    return await getResp.text();
  }

  async function fetchRoomImages(meetingRoomPK) {
    const url = `https://booking.cathayholdings.com/frontend/mrm101w/meetingRoomImage?meetingRoomPK=${encodeURIComponent(meetingRoomPK)}&_=${Date.now()}`;
    const resp = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json,*/*;q=0.8' },
    });
    if (!resp.ok) throw new Error(`meetingRoomImage 失敗: ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data.meetingRoomImages) ? data.meetingRoomImages : [];
  }

  function extractBuildings(doc) {
    const sel = doc.querySelector('#searchBeanBuildingPK');
    if (!sel) return [];
    return [...sel.options]
      .filter((o) => o.value)
      .map((o) => ({ value: o.value, label: o.textContent.trim() }));
  }

  async function checkSession() {
    const resp = await fetch(
      'https://booking.cathayholdings.com/frontend/mrm101w/search?',
      { method: 'GET', credentials: 'include' }
    );
    if (resp.url.includes('login') || resp.url.includes('signin')) {
      return { loggedIn: false };
    }
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const csrf = extractCsrfFromDoc(doc);
    const buildings = extractBuildings(doc);
    return { loggedIn: true, csrf, buildings };
  }

  function submitBookingForm(p) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://booking.cathayholdings.com/frontend/mrm101w/mrm101w3Pre';
    form.target = '_blank';
    form.style.display = 'none';

    const fields = {
      '_csrf': p.csrf,
      'startTime': p.startTime,
      'endTime': p.endTime,
      'tempMeetingRoomPK': p.meetingRoomPK,
      'noShowMeetingRoomRecordPk': '',
      'sessionTarget': 'mrm101Page',
    };
    for (const [k, v] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // 接收 iframe (app.js) postMessage，作為 RPC bridge
  window.addEventListener('message', async (ev) => {
    if (!ev.data || ev.data.__cb !== true) return;
    const { id, type, payload } = ev.data;
    const iframe = getFrame();
    const reply = (data) => {
      iframe?.contentWindow?.postMessage({ __cbReply: true, id, ...data }, '*');
    };

    console.log(TAG, 'bridge 收到:', type);
    try {
      if (type === 'CB_CHECK_SESSION') {
        const r = await checkSession();
        reply({ ok: true, ...r });
      } else if (type === 'CB_FETCH_ROOMS') {
        const html = await fetchRooms(payload || {});
        reply({ ok: true, html });
      } else if (type === 'CB_FETCH_ROOM_IMAGES') {
        const images = await fetchRoomImages(payload?.meetingRoomPK);
        reply({ ok: true, images });
      } else if (type === 'CB_OPEN_BOOKING') {
        submitBookingForm(payload || {});
        reply({ ok: true });
      } else if (type === 'CB_CLOSE_OVERLAY') {
        hide();
        reply({ ok: true });
      } else if (type === 'CB_RELOAD_HOST') {
        // 用於登入後重新整理原站台
        window.location.reload();
      } else {
        reply({ ok: false, error: `未知類型 ${type}` });
      }
    } catch (err) {
      console.error(TAG, type, '失敗:', err.message);
      reply({ ok: false, error: err.message });
    }
  });

  // ── 首次引導提示泡泡 ───────────────────────────────────────────────────────

  const HINT_ID = 'cb-overlay-hint';

  function removeHint() {
    document.getElementById(HINT_ID)?.remove();
  }

  function showHint() {
    if (document.getElementById(HINT_ID)) return;

    const hint = document.createElement('div');
    hint.id = HINT_ID;
    Object.assign(hint.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: '2147483646',
      background: '#1a73e8',
      color: '#fff',
      borderRadius: '14px',
      padding: '12px 36px 12px 14px',
      fontSize: '13px',
      lineHeight: '1.5',
      maxWidth: '260px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'system-ui, sans-serif',
      cursor: 'default',
      userSelect: 'none',
    });

    // 箭頭（指向右上角 icon）
    const arrow = document.createElement('div');
    Object.assign(arrow.style, {
      position: 'absolute',
      top: '-8px',
      right: '22px',
      width: '0',
      height: '0',
      borderLeft: '7px solid transparent',
      borderRight: '7px solid transparent',
      borderBottom: '8px solid #1a73e8',
    });
    hint.appendChild(arrow);

    const icon = document.createElement('img');
    icon.src = ACTION_ICON_URL;
    icon.alt = 'CB 會議室圖示';
    Object.assign(icon.style, {
      width: '30px',
      height: '30px',
      flex: '0 0 auto',
      borderRadius: '8px',
      background: '#fff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    });
    icon.addEventListener('error', () => {
      icon.style.display = 'none';
    });
    hint.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = '再點一次右上角圖示，即可開啟 CB 會議室';
    hint.appendChild(text);

    // 關閉按鈕
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    Object.assign(x.style, {
      position: 'absolute',
      top: '4px',
      right: '6px',
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.8)',
      fontSize: '16px',
      lineHeight: '1',
      cursor: 'pointer',
      padding: '0',
    });
    x.addEventListener('click', removeHint);
    hint.appendChild(x);

    document.documentElement.appendChild(hint);

    // 8 秒後自動消失
    setTimeout(removeHint, 8000);
  }

  function maybeShowHint() {
    chrome.storage.local.get('cb_needs_hint', (result) => {
      if (!result.cb_needs_hint) return;
      // 只在會議室查詢頁面顯示，其他頁面（首頁、登入頁）先略過，保留旗標
      if (!location.pathname.includes('/mrm101w')) return;
      chrome.storage.local.remove('cb_needs_hint');
      if (document.readyState === 'complete') {
        showHint();
      } else {
        window.addEventListener('load', showHint, { once: true });
      }
    });
  }

  maybeShowHint();

  // 接收 background 的切換訊息
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'CB_TOGGLE_OVERLAY') {
      removeHint();
      toggle();
      sendResponse({ ok: true });
    } else if (msg?.type === 'CB_CLOSE_OVERLAY') {
      hide();
      sendResponse({ ok: true });
    }
    return false;
  });
})();
