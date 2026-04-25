// app.js — 全頁 App 主邏輯

const App = (() => {
  const TAG = '[CB:app]';

  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const UNCOMMON_ROOMS = ['階梯教室', '中心樹'];
  const OFF_HOURS = [
    { start: 7 * 60, end: 9 * 60 },
    { start: 12 * 60, end: 13 * 60 + 30 },
    { start: 18 * 60, end: Infinity },
  ];

  let state = {
    rooms: [],
    searchDate: '',
    timePeriod: 'MORNING',
    buildingPK: '6',
    csrf: '',
    loading: false,
    error: null,
    sessionOk: false,
    sessionChecking: false,
    viewMode: 'table',
    favorites: new Set(),
    filterStartTime: '',
    filterDuration: 60,
    filterCapacity: 0,
    filterFloors: new Set(),
    filterHideUncommon: false,
    filterExcludeOffHours: false,
  };

  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = 'cb_search_prefs';
  const FAVORITES_KEY = 'cb_favorites';

  async function loadFavorites() {
    const result = await chrome.storage.local.get(FAVORITES_KEY);
    const pks = result[FAVORITES_KEY] || [];
    state.favorites = new Set(pks.map(String));
    console.log(TAG, `loadFavorites — ${state.favorites.size} 個最愛`);
  }

  function saveFavorites() {
    chrome.storage.local.set({ [FAVORITES_KEY]: [...state.favorites] });
    console.log(TAG, 'saveFavorites', [...state.favorites]);
  }

  function toggleFavorite(pk) {
    const key = String(pk);
    if (state.favorites.has(key)) {
      state.favorites.delete(key);
    } else {
      state.favorites.add(key);
    }
    saveFavorites();
    render();
  }

  // ── Room Detail Modal ────────────────────────────────────────────────────────

  function openRoomModal(room) {
    console.log(TAG, 'openRoomModal', room.pk, room.name);
    const body = $('modal-body');
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rows = [
      ['樓層', room.floor],
      ['容納人數', room.capacity ? `${room.capacity} 人` : ''],
      ['地址', room.address],
      ['內建設備', (room.equipments || []).join('、')],
      ['描述', room.description],
      ['借用規則', room.rules],
    ].filter(([, v]) => v);

    body.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${esc(room.name)}</h2>
      </div>
      <div id="modal-gallery" class="modal-gallery modal-gallery-loading">
        <div class="modal-gallery-msg">載入圖片中…</div>
      </div>
      <dl class="modal-info">
        ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
      </dl>
    `;
    $('room-modal').style.display = 'flex';

    // 非同步抓圖片
    const gallery = $('modal-gallery');
    CbApi.fetchRoomImages(room.pk)
      .then((images) => {
        gallery.classList.remove('modal-gallery-loading');
        if (!images.length) {
          gallery.innerHTML = '<div class="modal-gallery-msg">（此會議室暫無圖片）</div>';
          return;
        }
        gallery.innerHTML = images.map((b64) => {
          const src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
          return `<img src="${src}" alt="${esc(room.name)}" loading="lazy" />`;
        }).join('');
        gallery.querySelectorAll('img').forEach((img) => {
          img.addEventListener('click', () => openImageViewer(img.src));
        });
      })
      .catch((err) => {
        console.error(TAG, 'fetchRoomImages 失敗:', err.message);
        gallery.classList.remove('modal-gallery-loading');
        gallery.innerHTML = `<div class="modal-gallery-msg">圖片載入失敗：${esc(err.message)}</div>`;
      });
  }

  function closeRoomModal() {
    $('room-modal').style.display = 'none';
  }

  function openImageViewer(src) {
    $('image-viewer-img').src = src;
    $('image-viewer').style.display = 'flex';
  }

  function closeImageViewer() {
    $('image-viewer').style.display = 'none';
    $('image-viewer-img').src = '';
  }

  function sortedRooms() {
    return [...state.rooms].sort((a, b) => {
      const fa = state.favorites.has(String(a.pk)) ? 0 : 1;
      const fb = state.favorites.has(String(b.pk)) ? 0 : 1;
      return fa - fb;
    });
  }

  // ── Filters ──────────────────────────────────────────────────────────────────

  function isOffHour(startMin, endMin) {
    return OFF_HOURS.some(r => startMin >= r.start && endMin <= r.end);
  }

  function applyFilters(rooms) {
    let result = rooms;

    if (state.filterHideUncommon) {
      result = result.filter(r => !UNCOMMON_ROOMS.some(kw => r.name.includes(kw)));
    }

    if (state.filterCapacity > 0) {
      result = result.filter(r => {
        const cap = parseInt(r.capacity) || 0;
        return cap === 0 || cap >= state.filterCapacity;
      });
    }

    if (state.filterFloors.size > 0) {
      result = result.filter(r => state.filterFloors.has(r.floor));
    }

    if (state.filterStartTime) {
      const startMin = toMin(state.filterStartTime);
      const endMin = startMin + state.filterDuration;
      result = result.filter(r => {
        // 將 available 轉為 [start, end] 並依開始時間排序，檢查是否能連續涵蓋 [startMin, endMin]
        const ranges = r.available
          .map(s => [toMin(s.startTime), toMin(s.endTime)])
          .sort((a, b) => a[0] - b[0]);
        let cursor = startMin;
        for (const [s, e] of ranges) {
          if (s > cursor) break; // 出現缺口，無法覆蓋
          if (e > cursor) cursor = e;
          if (cursor >= endMin) return true;
        }
        return false;
      });
    }

    console.log(TAG, `applyFilters — ${state.rooms.length} 間 → ${result.length} 間`);
    return result;
  }

  // 今天的日期字串 YYYY/MM/DD
  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }

  // YYYY/MM/DD → Date（只比日期，不含時間）
  function parseDate(str) {
    const [y, m, d] = String(str).replace(/-/g, '/').split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // 儲存搜尋偏好
  function savePrefs() {
    const prefs = {
      searchDate: state.searchDate,
      timePeriod: state.timePeriod,
      buildingPK: state.buildingPK,
      viewMode: state.viewMode,
      filterStartTime: state.filterStartTime,
      filterDuration: state.filterDuration,
      filterCapacity: state.filterCapacity,
      filterHideUncommon: state.filterHideUncommon,
      filterExcludeOffHours: state.filterExcludeOffHours,
    };
    chrome.storage.local.set({ [STORAGE_KEY]: prefs });
    console.log(TAG, '偏好已儲存', prefs);
  }

  // 讀取搜尋偏好，回傳有效的設定（過期日期自動換今天）
  async function loadPrefs() {
    const today = todayStr();
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const prefs = result[STORAGE_KEY];
    if (!prefs) {
      console.log(TAG, '無儲存偏好，使用預設值');
      return { searchDate: today, timePeriod: null, buildingPK: '6' };
    }
    const savedDate = prefs.searchDate || today;
    const isExpired = parseDate(savedDate) < parseDate(today);
    const rawDate = isExpired ? today : savedDate;
    const resolvedDate = rawDate.replace(/-/g, '/'); // 統一格式為 YYYY/MM/DD
    if (isExpired) {
      console.log(TAG, `偏好日期 ${savedDate} 早於今天，自動改為 ${today}`);
    }
    return {
      ...prefs,
      searchDate: resolvedDate,
      viewMode: prefs.viewMode || 'table',
      filterStartTime: prefs.filterStartTime || '',
      filterDuration: prefs.filterDuration || 60,
      filterCapacity: prefs.filterCapacity ?? 0,
      filterHideUncommon: prefs.filterHideUncommon || false,
      filterExcludeOffHours: prefs.filterExcludeOffHours || false,
    };
  }

  function setState(patch) {
    console.log(TAG, 'setState', patch);
    Object.assign(state, patch);
    render();
  }

  function render() {
    const el = $('session-status');
    if (state.sessionChecking) {
      el.textContent = '確認中';
      el.className = 'badge badge-checking';
    } else {
      el.textContent = state.sessionOk ? '已登入' : '未登入';
      el.className = 'badge ' + (state.sessionOk ? 'badge-ok' : 'badge-err');
    }
    $('btn-login').style.display = state.sessionOk ? 'none' : '';
    $('btn-search').disabled = state.loading || !state.sessionOk;
    $('loading').style.display = state.loading ? 'flex' : 'none';
    const errEl = $('error-msg');
    errEl.style.display = state.error ? 'block' : 'none';
    errEl.innerHTML = '';
    if (state.error) {
      const text = document.createElement('span');
      text.textContent = state.error;
      errEl.appendChild(text);
      if (/booking\.cathayholdings\.com/.test(state.error)) {
        const btn = document.createElement('button');
        btn.className = 'error-action';
        btn.textContent = '回到原站台';
        btn.addEventListener('click', () => {
          CbApi.closeOverlay();
        });
        errEl.appendChild(btn);
      }
    }

    $('view-toggle').style.display = 'flex';
    $('btn-view-card').classList.toggle('active', state.viewMode === 'card');
    $('btn-view-table').classList.toggle('active', state.viewMode === 'table');
    $('room-list').style.display = state.viewMode === 'card' ? '' : 'none';
    $('room-table-wrap').style.display = state.viewMode === 'table' ? '' : 'none';

    renderFloorFilter();
    renderStartTimeFilter();
    renderRooms();
  }

  function renderStartTimeFilter() {
    const sel = $('filter-start-time');
    const times = new Set();
    for (const r of state.rooms) {
      for (const s of r.available) times.add(s.startTime);
    }
    const sorted = [...times].sort((a, b) => toMin(a) - toMin(b));
    const signature = sorted.join('|');
    if (sel.dataset.signature !== signature) {
      sel.innerHTML = '<option value="">不限</option>' +
        sorted.map(t => `<option value="${t}">${t}</option>`).join('');
      sel.dataset.signature = signature;
    }
    // 若目前選擇已不存在，清除
    if (state.filterStartTime && !times.has(state.filterStartTime)) {
      state.filterStartTime = '';
    }
    sel.value = state.filterStartTime;
  }

  function renderFloorFilter() {
    const group = $('filter-floor-group');
    const list = $('filter-floor-list');
    const floors = [...new Set(state.rooms.map(r => r.floor).filter(Boolean))];

    // 依數字排序（例如 "5F" < "21F"）
    floors.sort((a, b) => {
      const na = parseInt(a) || 0;
      const nb = parseInt(b) || 0;
      return na - nb || String(a).localeCompare(String(b));
    });

    if (floors.length === 0) {
      group.style.display = 'none';
      state.filterFloors.clear();
      return;
    }

    // 移除已不存在的樓層
    for (const f of [...state.filterFloors]) {
      if (!floors.includes(f)) state.filterFloors.delete(f);
    }

    group.style.display = '';
    const signature = floors.join('|');
    if (list.dataset.signature !== signature) {
      list.innerHTML = '';
      const mkBtn = (val, label, isAll) => {
        const btn = document.createElement('button');
        btn.className = 'floor-btn';
        btn.dataset.value = val;
        btn.dataset.all = isAll ? '1' : '';
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (isAll) {
            state.filterFloors.clear();
          } else {
            if (state.filterFloors.has(val)) state.filterFloors.delete(val);
            else state.filterFloors.add(val);
          }
          render();
        });
        list.appendChild(btn);
      };
      mkBtn('', '不限', true);
      for (const f of floors) mkBtn(f, f, false);
      list.dataset.signature = signature;
    }
    list.querySelectorAll('.floor-btn').forEach((btn) => {
      if (btn.dataset.all) {
        btn.classList.toggle('active', state.filterFloors.size === 0);
      } else {
        btn.classList.toggle('active', state.filterFloors.has(btn.dataset.value));
      }
    });
  }

  function renderRooms() {
    if (state.rooms.length === 0) {
      $('room-list').innerHTML = (!state.loading && !state.error && state.sessionOk)
        ? '<p class="empty">沒有符合條件的會議室</p>' : '';
      $('room-table').innerHTML = '';
      return;
    }

    console.log(TAG, `renderRooms — 渲染 ${state.rooms.length} 間，模式=${state.viewMode}`);
    const rooms = applyFilters(sortedRooms());
    if (state.viewMode === 'card') {
      const list = $('room-list');
      list.innerHTML = '';
      for (const room of rooms) list.appendChild(buildRoomCard(room));
    } else {
      buildRoomTable(rooms);
    }
  }

  function buildRoomTable(rooms) {
    const table = $('room-table');
    table.innerHTML = '';

    // 1. 收集所有時間邊界點，作為刻度
    const pointSet = new Set();
    for (const room of rooms) {
      for (const s of [...room.available, ...room.booked]) {
        pointSet.add(toMin(s.startTime));
        pointSet.add(toMin(s.endTime));
      }
    }
    const points = [...pointSet].sort((a, b) => a - b);

    // 2. 相鄰邊界點之間即為一個基本格，依需求排除不常用時間
    let intervals = points.slice(0, -1).map((p, i) => ({
      start: fromMin(p),
      end: fromMin(points[i + 1]),
    }));
    if (state.filterExcludeOffHours) {
      intervals = intervals.filter(iv => !isOffHour(toMin(iv.start), toMin(iv.end)));
    }
    console.log(TAG, `buildRoomTable — ${intervals.length} 個基本格`);

    // 3. 表頭
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.innerHTML = '<th class="rt-room-col">會議室</th>';
    for (const iv of intervals) {
      const th = document.createElement('th');
      th.className = 'rt-slot-col';
      th.innerHTML = `<span class="rt-th-start">${iv.start}</span><span class="rt-th-end">${iv.end}</span>`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    // 4. 表身
    const tbody = document.createElement('tbody');
    for (const room of rooms) {
      const isFav = state.favorites.has(String(room.pk));
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.className = 'rt-room-col';
      tdName.innerHTML = `
        <span class="rt-name room-name-clickable" title="查看詳情">${room.name}</span>
        <span class="rt-meta">${room.floor}${room.capacity ? `・${room.capacity}人` : ''}</span>
        <button class="fav-btn ${isFav ? 'fav-on' : ''}" title="${isFav ? '取消最愛' : '加入最愛'}">★</button>
      `;
      tdName.querySelector('.rt-name').addEventListener('click', () => openRoomModal(room));
      tdName.querySelector('.fav-btn').addEventListener('click', () => toggleFavorite(room.pk));
      tr.appendChild(tdName);

      // 將每個基本格對應到 slot（avail / booked / empty）
      const statuses = intervals.map((iv) => {
        const s = toMin(iv.start), e = toMin(iv.end);
        const avail = room.available.find((a) => toMin(a.startTime) <= s && toMin(a.endTime) >= e);
        if (avail) return { type: 'avail', slot: avail, id: `a-${avail.pk}` };
        const booked = room.booked.find((b) => toMin(b.startTime) <= s && toMin(b.endTime) >= e);
        if (booked) return { type: 'booked', slot: booked, id: `b-${booked.startTime}-${booked.endTime}` };
        return { type: 'empty', id: 'empty' };
      });

      // 只有 booked 才合併 colspan；avail 與 empty 維持每格獨立
      let i = 0;
      while (i < statuses.length) {
        const cur = statuses[i];
        let span = 1;
        if (cur.type === 'booked') {
          while (i + span < statuses.length && statuses[i + span].id === cur.id) span++;
        }

        const td = document.createElement('td');
        td.className = 'rt-cell';
        if (span > 1) td.colSpan = span;

        if (cur.type === 'avail') {
          const s = cur.slot;
          const btn = document.createElement('button');
          btn.className = 'rt-btn-avail';
          btn.dataset.pk = s.pk;
          btn.dataset.start = s.startTime;
          btn.dataset.end = s.endTime;
          btn.title = `可預訂 ${s.startTime}–${s.endTime}`;
          btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
          btn.addEventListener('click', () => handleBook(btn.dataset));
          td.appendChild(btn);
        } else if (cur.type === 'booked') {
          const b = cur.slot;
          const lines = (b.info && b.info.length)
            ? b.info
            : [b.title, b.department].filter(Boolean);
          const display = lines.length ? lines : ['已預訂'];
          const wrap = document.createElement('span');
          wrap.className = 'rt-booked';
          wrap.title = `${display.join(' / ')}（${b.startTime}–${b.endTime}）`;
          for (const line of display) {
            const l = document.createElement('span');
            l.className = 'rt-booked-line';
            l.textContent = line;
            wrap.appendChild(l);
          }
          td.appendChild(wrap);
        } else {
          td.innerHTML = '<span class="rt-empty">—</span>';
        }

        tr.appendChild(td);
        i += span;
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  function buildRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.dataset.pk = room.pk;

    const isFav = state.favorites.has(String(room.pk));
    const available = state.filterExcludeOffHours
      ? room.available.filter(s => !isOffHour(toMin(s.startTime), toMin(s.endTime)))
      : room.available;
    const booked = state.filterExcludeOffHours
      ? room.booked.filter(b => !isOffHour(toMin(b.startTime), toMin(b.endTime)))
      : room.booked;
    const hasAvailable = available.length > 0;

    card.innerHTML = `
      <div class="room-header">
        <span class="room-name room-name-clickable" title="查看詳情">${room.name}</span>
        <span class="room-floor">${room.floor}</span>
        ${room.capacity ? `<span class="room-cap">${room.capacity} 人</span>` : ''}
        <span class="room-avail ${hasAvailable ? 'ok' : 'full'}">${hasAvailable ? `${available.length} 個空檔` : '已滿'}</span>
        <button class="fav-btn ${isFav ? 'fav-on' : ''}" title="${isFav ? '取消最愛' : '加入最愛'}">★</button>
      </div>
      ${room.equipments.length ? `<div class="room-equip">${room.equipments.join('・')}</div>` : ''}
      <div class="room-slots">
        ${available.map((s) => `
          <button class="slot-btn"
            data-pk="${s.pk}"
            data-start="${s.startTime}"
            data-end="${s.endTime}">
            ${s.startTime}–${s.endTime}
          </button>`).join('')}
        ${booked.map((b) => {
          const lines = (b.info && b.info.length)
            ? b.info
            : [b.title, b.department].filter(Boolean);
          const display = lines.length ? lines : ['已預訂'];
          const inner = display.map(l => `<span class="slot-booked-line">${l}</span>`).join('');
          return `<span class="slot-booked" title="${b.startTime}–${b.endTime}">${inner}</span>`;
        }).join('')}
      </div>
    `;

    card.querySelectorAll('.slot-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleBook(btn.dataset));
    });

    card.querySelector('.fav-btn').addEventListener('click', () => toggleFavorite(room.pk));
    card.querySelector('.room-name').addEventListener('click', () => openRoomModal(room));

    return card;
  }

  // 合併上午與下午的房間資料（依 pk 合併時段）
  function mergeRooms(morningRooms, afternoonRooms) {
    console.log(TAG, `mergeRooms — 上午 ${morningRooms.length} 間，下午 ${afternoonRooms.length} 間`);
    const map = new Map();
    for (const room of morningRooms) map.set(room.pk, { ...room });
    for (const room of afternoonRooms) {
      if (map.has(room.pk)) {
        const existing = map.get(room.pk);
        const slotKey = (s) => `${s.startTime}-${s.endTime}`;
        const availSet = new Set(existing.available.map(slotKey));
        let added = 0;
        for (const s of room.available) {
          if (!availSet.has(slotKey(s))) { existing.available.push(s); added++; }
        }
        const bookedSet = new Set(existing.booked.map(slotKey));
        for (const b of room.booked) {
          if (!bookedSet.has(slotKey(b))) existing.booked.push(b);
        }
        console.log(TAG, `  merge [${room.pk}] ${room.name} — 新增下午空檔 ${added} 個`);
      } else {
        console.log(TAG, `  merge [${room.pk}] ${room.name} — 僅下午有此房間，直接加入`);
        map.set(room.pk, { ...room });
      }
    }
    const result = [...map.values()];
    console.log(TAG, `mergeRooms 完成 — 共 ${result.length} 間`);
    return result;
  }

  async function handleSearch() {
    console.log(TAG, `handleSearch — date=${state.searchDate} period=${state.timePeriod} building=${state.buildingPK}`);
    setState({ loading: true, error: null, rooms: [] });
    try {
      const base = { searchDate: state.searchDate, buildingPK: state.buildingPK };
      let rooms, csrf, searchDate;

      if (state.timePeriod === 'ALL') {
        console.log(TAG, '全天模式：循序查詢上午 → 下午');
        const morningHtml = await CbApi.fetchRooms({ ...base, timePeriod: 'MORNING' });
        console.log(TAG, '上午查詢完成，開始查詢下午');
        const afternoonHtml = await CbApi.fetchRooms({ ...base, timePeriod: 'AFTERNOON' });
        const morning = CbParser.parse(morningHtml);
        const afternoon = CbParser.parse(afternoonHtml);
        rooms = mergeRooms(morning.rooms, afternoon.rooms);
        csrf = morning.csrf || afternoon.csrf;
        searchDate = morning.searchDate || afternoon.searchDate;
      } else {
        const html = await CbApi.fetchRooms({ ...base, timePeriod: state.timePeriod });
        ({ rooms, csrf, searchDate } = CbParser.parse(html));
      }

      console.log(TAG, `handleSearch 完成 — ${rooms.length} 間，searchDate=${searchDate}`);
      setState({ rooms, searchDate, csrf, loading: false });
    } catch (err) {
      console.error(TAG, 'handleSearch 失敗:', err.message);
      const msg = err.message === 'NO_BRIDGE_TAB'
        ? '請先開啟原站台 booking.cathayholdings.com 並登入'
        : err.message === 'SESSION_EXPIRED'
        ? 'Session 已過期，請重新整理原站台 booking.cathayholdings.com 並重新登入'
        : err.message === 'NO_CSRF' || /roomRecordSearch 失敗: 500/.test(err.message)
        ? '連線可能已逾時，請重新整理原站台 booking.cathayholdings.com（必要時重新登入）後再試'
        : `查詢失敗：${err.message}`;
      setState({ loading: false, error: msg });
    }
  }

  function openConfirmModal(dataset) {
    const room = state.rooms.find(r => String(r.pk) === String(dataset.pk));
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const body = $('confirm-body');
    const rows = [
      ['日期', state.searchDate || state.date],
      ['時段', `${dataset.start} – ${dataset.end}`],
      ['樓層', room?.floor],
      ['容納人數', room?.capacity ? `${room.capacity} 人` : ''],
    ].filter(([, v]) => v);
    body.innerHTML = `
      <div class="confirm-room">${esc(room?.name || '會議室')}</div>
      <dl>
        ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}
      </dl>
      <div class="confirm-hint">點擊「前往預訂」會開啟原站台預訂頁面，請於該頁完成送出。</div>
    `;
    $('confirm-modal').style.display = 'flex';
    $('confirm-modal').dataset.pk = dataset.pk;
    $('confirm-modal').dataset.start = dataset.start;
    $('confirm-modal').dataset.end = dataset.end;
  }

  function closeConfirmModal() {
    $('confirm-modal').style.display = 'none';
  }

  async function handleBook(dataset) {
    console.log(TAG, 'handleBook', dataset);
    if (!state.csrf) {
      console.warn(TAG, 'handleBook — 缺少 csrf，中止');
      setState({ error: '缺少 CSRF token，請先查詢一次' });
      return;
    }
    openConfirmModal({ pk: dataset.pk, start: dataset.start, end: dataset.end });
  }

  async function confirmBookingGo() {
    const modal = $('confirm-modal');
    const dataset = { pk: modal.dataset.pk, start: modal.dataset.start, end: modal.dataset.end };
    closeConfirmModal();
    try {
      await CbApi.openBooking({
        csrf: state.csrf,
        startTime: dataset.start,
        endTime: dataset.end,
        meetingRoomPK: dataset.pk,
      });
      console.log(TAG, 'confirmBookingGo — 預訂頁已開啟');
    } catch (err) {
      console.error(TAG, 'confirmBookingGo 失敗:', err.message);
      setState({ error: `開啟預訂失敗：${err.message}` });
    }
  }

  function populateBuildings(buildings) {
    if (!buildings || !buildings.length) return;
    const sel = $('select-building');
    const current = sel.value;
    sel.innerHTML = buildings.map(
      (b) => `<option value="${b.value}">${b.label}</option>`
    ).join('');
    // 保留上次選擇（若仍存在）
    if (buildings.some((b) => b.value === current)) sel.value = current;
    else state.buildingPK = sel.value;
    console.log(TAG, `populateBuildings — ${buildings.length} 個大樓，目前=${sel.value}`);
  }

  async function checkSession() {
    console.log(TAG, 'checkSession 開始');
    setState({ sessionChecking: true, error: null });
    try {
      const result = await CbApi.checkSession();
      console.log(TAG, 'checkSession 結果:', result);
      if (result.ok && result.loggedIn) {
        populateBuildings(result.buildings);
        setState({ sessionChecking: false, sessionOk: true, error: null });
      } else {
        setState({ sessionChecking: false, sessionOk: false, error: '請先開啟原站台並登入' });
      }
    } catch (err) {
      console.error(TAG, 'checkSession 失敗:', err.message);
      setState({ sessionChecking: false, sessionOk: false, error: '無法連線至原站台，請確認已開啟 booking.cathayholdings.com' });
    }
  }

  // ── Taiwan Public Holidays ──────────────────────────────────────────────────
  // 由外部 CSV 載入後透過 Calendar.setHolidays() 注入

  const TW_HOLIDAYS = new Map(); // Map<dateStr, holidayName>
  const HOLIDAYS_KEY = 'cb_holidays';

  async function loadHolidays() {
    const result = await chrome.storage.local.get(HOLIDAYS_KEY);
    const stored = result[HOLIDAYS_KEY];
    if (!stored || !stored.length) return;
    // 相容舊格式（純字串陣列）
    const entries = typeof stored[0] === 'string' ? stored.map(d => ({ d, n: '' })) : stored;
    Calendar.setHolidays(entries);
    setHolidayStatus(`已載入 ${entries.length} 個假日`);
    console.log(TAG, `loadHolidays — ${entries.length} 個假日`);
  }

  function parseHolidayCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const entries = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      if (cols.length < 3) continue;
      const raw = cols[0].trim();
      if (cols[2].trim() !== '2') continue;
      if (!/^\d{8}$/.test(raw)) continue;
      const d = `${raw.slice(0, 4)}/${raw.slice(4, 6)}/${raw.slice(6, 8)}`;
      const n = cols[3] ? cols[3].trim() : '';
      entries.push({ d, n });
    }
    return entries;
  }

  async function loadBuiltinHolidays(label) {
    const url = chrome.runtime.getURL(`assets/${label}_tw_holidays.csv`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`無法讀取內建假日檔案 (${res.status})`);
    const text = await res.text();
    const entries = parseHolidayCsv(text);
    if (!entries.length) throw new Error('找不到假日資料');
    Calendar.setHolidays(entries);
    chrome.storage.local.set({ [HOLIDAYS_KEY]: entries });
    setHolidayStatus(`已載入 ${entries.length} 個假日`);
    console.log(TAG, `loadBuiltinHolidays(${label}) — ${entries.length} 個假日`);
  }

  function setHolidayStatus(msg, isErr = false) {
    const el = $('holiday-import-status');
    el.textContent = msg;
    el.className = 'holiday-import-status' + (isErr ? ' err' : msg ? ' ok' : '');
  }

  function updateHolidayWarning(dateStr) {
    const el = $('date-holiday-warning');
    if (!el || !dateStr) { if (el) el.style.display = 'none'; return; }
    const dow = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00').getDay();
    if (TW_HOLIDAYS.has(dateStr)) {
      const name = TW_HOLIDAYS.get(dateStr);
      el.textContent = name ? `注意：此日為國定假日「${name}」` : '注意：此日為國定假日';
      el.style.display = '';
    } else if (dow === 0 || dow === 6) {
      el.textContent = dow === 0 ? '注意：此日為星期日' : '注意：此日為星期六';
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  // ── Calendar Component ──────────────────────────────────────────────────────

  const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  function dowLabel(dateStr) {
    if (!dateStr || dateStr === '—') return '';
    const dow = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00').getDay();
    return `週${DOW_LABELS[dow]}`;
  }

  const Calendar = (() => {
    const pad = (n) => String(n).padStart(2, '0');
    let viewYear = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let calOpen = false;

    function renderMonth() {
      const today = todayStr();
      const selected = state.searchDate;
      $('cal-month-label').textContent = `${viewYear} 年 ${pad(viewMonth + 1)} 月`;

      const container = $('cal-days');
      container.innerHTML = '';
      const firstDow = new Date(viewYear, viewMonth, 1).getDay();
      const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();

      for (let i = 0; i < firstDow; i++) {
        const blank = document.createElement('span');
        blank.className = 'cal-day cal-blank';
        container.appendChild(blank);
      }

      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${viewYear}/${pad(viewMonth + 1)}/${pad(d)}`;
        const dow = new Date(viewYear, viewMonth, d).getDay();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cal-day';
        btn.textContent = d;
        btn.dataset.date = dateStr;
        if (dow === 0) btn.classList.add('cal-sun');
        else if (dow === 6) btn.classList.add('cal-sat');
        if (TW_HOLIDAYS.has(dateStr)) btn.classList.add('cal-holiday');
        if (dateStr === today) btn.classList.add('cal-today');
        if (dateStr === selected) btn.classList.add('cal-selected');
        btn.addEventListener('click', () => selectDate(dateStr));
        container.appendChild(btn);
      }
    }

    function selectDate(dateStr) {
      state.searchDate = dateStr;
      $('cal-display').textContent = dateStr;
      $('cal-dow').textContent = dowLabel(dateStr);
      savePrefs();
      close();
      updateHolidayWarning(dateStr);
    }

    function open() { $('cal-popup').style.display = ''; calOpen = true; renderMonth(); }
    function close() { $('cal-popup').style.display = 'none'; calOpen = false; }

    function setDate(dateStr) {
      const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00');
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
      $('cal-display').textContent = dateStr;
      $('cal-dow').textContent = dowLabel(dateStr);
      if (calOpen) renderMonth();
    }

    function init(initialDateStr) {
      if (initialDateStr) {
        const d = new Date(initialDateStr.replace(/\//g, '-') + 'T00:00:00');
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        $('cal-display').textContent = initialDateStr;
        $('cal-dow').textContent = dowLabel(initialDateStr);
        updateHolidayWarning(initialDateStr);
      }
      $('cal-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        calOpen ? close() : open();
      });
      $('cal-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderMonth();
      });
      $('cal-next').addEventListener('click', (e) => {
        e.stopPropagation();
        if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderMonth();
      });
      document.addEventListener('click', (e) => {
        if (calOpen && !$('cal-wrap').contains(e.target)) close();
      });
    }

    function setHolidays(entries) {
      TW_HOLIDAYS.clear();
      for (const { d, n } of entries) TW_HOLIDAYS.set(d, n);
      if (calOpen) renderMonth();
      updateHolidayWarning(state.searchDate);
    }

    return { init, setDate, close, setHolidays };
  })();

  async function init() {
    console.log(TAG, 'init');

    // 讀取上次偏好（過期日期自動換今天）
    await loadFavorites();
    await loadHolidays();
    const prefs = await loadPrefs();
    const defaultPeriod = new Date().getHours() < 12 ? 'MORNING' : 'AFTERNOON';
    state.searchDate = prefs.searchDate;
    state.timePeriod = prefs.timePeriod || defaultPeriod;
    state.buildingPK = prefs.buildingPK || '6';
    state.viewMode = prefs.viewMode || 'table';
    state.filterStartTime = prefs.filterStartTime;
    state.filterDuration = prefs.filterDuration;
    state.filterCapacity = prefs.filterCapacity;
    state.filterHideUncommon = prefs.filterHideUncommon;
    state.filterExcludeOffHours = prefs.filterExcludeOffHours;
    console.log(TAG, '套用偏好', { searchDate: state.searchDate, timePeriod: state.timePeriod, buildingPK: state.buildingPK, viewMode: state.viewMode });

    // 同步搜尋 UI
    Calendar.init(state.searchDate);
    $('select-building').value = state.buildingPK;
    document.querySelectorAll('.period-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === state.timePeriod);
    });

    // 同步篩選 UI（起始時間選項於 renderStartTimeFilter 動態產生）
    document.querySelectorAll('.dur-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterDuration);
    });
    document.querySelectorAll('.cap-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterCapacity);
    });
    $('filter-hide-uncommon').checked = state.filterHideUncommon;
    $('filter-exclude-offhours').checked = state.filterExcludeOffHours;

    $('btn-load-builtin-holidays').addEventListener('click', () => {
      setHolidayStatus('載入中…');
      loadBuiltinHolidays('115').catch((err) => {
        setHolidayStatus(err.message, true);
        console.error(TAG, 'loadBuiltinHolidays 失敗:', err.message);
      });
    });

    $('btn-clear-holidays').addEventListener('click', () => {
      Calendar.setHolidays([]);
      chrome.storage.local.remove(HOLIDAYS_KEY);
      setHolidayStatus('已清除');
      console.log(TAG, '假日資料已清除');
    });

    $('btn-import-holidays').addEventListener('click', () => $('holiday-file-input').click());
    $('holiday-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const entries = parseHolidayCsv(ev.target.result);
          if (!entries.length) { setHolidayStatus('找不到假日資料', true); return; }
          Calendar.setHolidays(entries);
          chrome.storage.local.set({ [HOLIDAYS_KEY]: entries });
          setHolidayStatus(`已載入 ${entries.length} 個假日`);
          console.log(TAG, `holiday CSV 匯入 — ${entries.length} 個假日`);
        } catch (err) {
          setHolidayStatus('解析失敗：' + err.message, true);
        }
      };
      reader.readAsText(file, 'UTF-8');
      e.target.value = '';
    });

    $('btn-search').addEventListener('click', handleSearch);
    $('btn-check-session').addEventListener('click', checkSession);
    $('btn-view-card').addEventListener('click', () => {
      if (state.viewMode !== 'card') { setState({ viewMode: 'card' }); savePrefs(); }
    });
    $('btn-view-table').addEventListener('click', () => {
      if (state.viewMode !== 'table') { setState({ viewMode: 'table' }); savePrefs(); }
    });
    $('btn-login').addEventListener('click', () => {
      console.log(TAG, '關閉 overlay 回到原站台以便登入');
      CbApi.closeOverlay();
    });

    document.querySelectorAll('.date-quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const offset = Number(btn.dataset.offset);
        const pad = (n) => String(n).padStart(2, '0');
        let d;
        if (offset === 0) {
          d = new Date();
        } else {
          const base = state.searchDate
            ? new Date(state.searchDate.replace(/\//g, '-') + 'T00:00:00')
            : new Date();
          d = isNaN(base) ? new Date() : base;
          d.setDate(d.getDate() + offset);
        }
        const dateStr = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
        state.searchDate = dateStr;
        Calendar.setDate(dateStr);
        updateHolidayWarning(dateStr);
        console.log(TAG, `date-quick offset=${offset} → ${state.searchDate}`);
        savePrefs();
      });
    });

    document.querySelectorAll('.period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.timePeriod = btn.dataset.value;
        console.log(TAG, 'timePeriod 更新:', state.timePeriod);
        savePrefs();
      });
    });

    $('select-building').addEventListener('change', (e) => {
      state.buildingPK = e.target.value;
      console.log(TAG, 'buildingPK 更新:', state.buildingPK);
      savePrefs();
    });

    // 篩選面板事件
    $('filter-start-time').addEventListener('change', (e) => {
      state.filterStartTime = e.target.value;
      savePrefs();
      render();
    });
    document.querySelectorAll('.dur-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filterDuration = Number(btn.dataset.value);
        savePrefs();
        render();
      });
    });
    document.querySelectorAll('.cap-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cap-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filterCapacity = Number(btn.dataset.value);
        savePrefs();
        render();
      });
    });
    $('filter-hide-uncommon').addEventListener('change', (e) => {
      state.filterHideUncommon = e.target.checked;
      savePrefs();
      render();
    });
    $('filter-exclude-offhours').addEventListener('change', (e) => {
      state.filterExcludeOffHours = e.target.checked;
      savePrefs();
      render();
    });

    // Modal 關閉：close 按鈕、點背景、ESC 鍵
    $('modal-close').addEventListener('click', closeRoomModal);
    $('room-modal').querySelector('.modal-backdrop').addEventListener('click', closeRoomModal);
    $('image-viewer').addEventListener('click', closeImageViewer);
    $('confirm-close').addEventListener('click', closeConfirmModal);
    $('confirm-cancel').addEventListener('click', closeConfirmModal);
    $('confirm-modal').querySelector('.modal-backdrop').addEventListener('click', closeConfirmModal);
    $('confirm-go').addEventListener('click', confirmBookingGo);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      Calendar.close();
      if ($('image-viewer').style.display === 'flex') { closeImageViewer(); return; }
      if ($('confirm-modal').style.display === 'flex') { closeConfirmModal(); return; }
      if ($('room-modal').style.display === 'flex') closeRoomModal();
    });

    render();
    checkSession();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
