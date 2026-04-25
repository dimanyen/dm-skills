// app.js — 全頁 App 主邏輯 (v2 — 新版 UI)

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
    // 資料
    rooms: [],
    searchDate: '',
    timePeriod: 'MORNING',
    buildingPK: '6',
    csrf: '',
    // UI 狀態
    loading: false,
    error: null,
    sessionOk: false,
    sessionChecking: false,
    viewMode: 'table',
    filterOpen: false,
    nameSearch: '',
    favOnly: false,
    // 篩選條件
    filterStartTime: '',
    filterDuration: 60,
    filterCapacity: 0,
    filterFloors: new Set(),
    filterHideUncommon: false,
    filterExcludeOffHours: false,
    // 持久化
    favorites: new Set(),
  };

  const $ = (id) => document.getElementById(id);

  const STORAGE_KEY = 'cb_search_prefs';
  const FAVORITES_KEY = 'cb_favorites';

  // ── Favorites ────────────────────────────────────────────────────────────────

  async function loadFavorites() {
    const result = await chrome.storage.local.get(FAVORITES_KEY);
    const pks = result[FAVORITES_KEY] || [];
    state.favorites = new Set(pks.map(String));
  }

  function saveFavorites() {
    chrome.storage.local.set({ [FAVORITES_KEY]: [...state.favorites] });
  }

  function toggleFavorite(pk) {
    const key = String(pk);
    if (state.favorites.has(key)) state.favorites.delete(key);
    else state.favorites.add(key);
    saveFavorites();
    render();
  }

  // ── Room Detail Modal ────────────────────────────────────────────────────────

  function openRoomModal(room) {
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
        gallery.classList.remove('modal-gallery-loading');
        gallery.innerHTML = `<div class="modal-gallery-msg">圖片載入失敗：${esc(err.message)}</div>`;
      });
  }

  function closeRoomModal() { $('room-modal').style.display = 'none'; }
  function openImageViewer(src) {
    $('image-viewer-img').src = src;
    $('image-viewer').style.display = 'flex';
  }
  function closeImageViewer() {
    $('image-viewer').style.display = 'none';
    $('image-viewer-img').src = '';
  }

  // ── Filters / Derived ────────────────────────────────────────────────────────

  function isOffHour(startMin, endMin) {
    return OFF_HOURS.some(r => startMin >= r.start && endMin <= r.end);
  }

  function sortedRooms() {
    return [...state.rooms].sort((a, b) => {
      const fa = state.favorites.has(String(a.pk)) ? 0 : 1;
      const fb = state.favorites.has(String(b.pk)) ? 0 : 1;
      return fa - fb;
    });
  }

  function applyFilters(rooms) {
    let result = rooms;

    if (state.nameSearch.trim()) {
      const q = state.nameSearch.trim().toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q));
    }

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
        const ranges = r.available
          .map(s => [toMin(s.startTime), toMin(s.endTime)])
          .sort((a, b) => a[0] - b[0]);
        let cursor = startMin;
        for (const [s, e] of ranges) {
          if (s > cursor) break;
          if (e > cursor) cursor = e;
          if (cursor >= endMin) return true;
        }
        return false;
      });
    }

    if (state.favOnly) {
      result = result.filter(r => state.favorites.has(String(r.pk)));
    }

    return result;
  }

  // 計算目前「作用中篩選數量」（不含 favOnly）
  function activeFilterCount() {
    let n = 0;
    if (state.filterStartTime) n++;
    else if (state.filterDuration !== 60) n++;
    if (state.filterCapacity > 0) n++;
    if (state.filterFloors.size > 0) n++;
    if (state.filterHideUncommon) n++;
    if (state.filterExcludeOffHours) n++;
    return n;
  }

  // ── Date Helpers ─────────────────────────────────────────────────────────────

  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }

  function parseDate(str) {
    const [y, m, d] = String(str).replace(/-/g, '/').split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // ── Prefs ────────────────────────────────────────────────────────────────────

  function savePrefs() {
    const prefs = {
      searchDate: state.searchDate,
      timePeriod: state.timePeriod,
      buildingPK: state.buildingPK,
      viewMode: state.viewMode,
      filterDuration: state.filterDuration,
      filterCapacity: state.filterCapacity,
      filterHideUncommon: state.filterHideUncommon,
      filterExcludeOffHours: state.filterExcludeOffHours,
    };
    chrome.storage.local.set({ [STORAGE_KEY]: prefs });
  }

  async function loadPrefs() {
    const today = todayStr();
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const prefs = result[STORAGE_KEY];
    if (!prefs) return { searchDate: today, timePeriod: null, buildingPK: '6' };
    const savedDate = prefs.searchDate || today;
    const isExpired = parseDate(savedDate) < parseDate(today);
    const resolvedDate = (isExpired ? today : savedDate).replace(/-/g, '/');
    return {
      ...prefs,
      searchDate: resolvedDate,
      viewMode: prefs.viewMode || 'table',
      filterDuration: prefs.filterDuration || 60,
      filterCapacity: prefs.filterCapacity ?? 0,
      filterHideUncommon: prefs.filterHideUncommon || false,
      filterExcludeOffHours: prefs.filterExcludeOffHours || false,
    };
  }

  // ── State ────────────────────────────────────────────────────────────────────

  function setState(patch) {
    Object.assign(state, patch);
    render();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function render() {
    renderToolbar();
    renderChipsBar();
    renderFilterPanel();
    renderStartTimeFilter();
    renderFloorFilter();
    renderResultMeta();
    renderRooms();
  }

  function renderToolbar() {
    // Session status
    const statusEl = $('session-status');
    const textEl   = $('session-text');
    const loginBtn = $('btn-login');
    statusEl.className = 'tb-session ' + (
      state.sessionChecking ? 'tb-session-checking' :
      state.sessionOk       ? 'tb-session-ok' :
                               'tb-session-err'
    );
    textEl.textContent = state.sessionChecking ? '確認中' : state.sessionOk ? '已登入' : '未登入';
    loginBtn.style.display = (!state.sessionChecking && !state.sessionOk) ? '' : 'none';

    // Search button
    $('btn-search').disabled = state.loading || !state.sessionOk;

    // Filter button active state
    const filterBtn = $('btn-filter');
    const cnt = activeFilterCount();
    filterBtn.classList.toggle('active', state.filterOpen || cnt > 0);
    const badge = $('filter-count-badge');
    if (cnt > 0) {
      badge.textContent = cnt;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }

    // View toggle
    $('btn-view-card').classList.toggle('active', state.viewMode === 'card');
    $('btn-view-table').classList.toggle('active', state.viewMode === 'table');

    // Room search clear button
    $('btn-clear-search').style.display = state.nameSearch ? '' : 'none';

    // Error
    const errEl = $('error-msg');
    errEl.style.display = state.error ? '' : 'none';
    if (state.error) {
      errEl.innerHTML = '';
      const txt = document.createElement('span');
      txt.textContent = state.error;
      errEl.appendChild(txt);
      if (/booking\.cathayholdings\.com/.test(state.error)) {
        const btn = document.createElement('button');
        btn.className = 'error-action';
        btn.textContent = '回到原站台';
        btn.addEventListener('click', () => CbApi.closeOverlay());
        errEl.appendChild(btn);
      }
    }

    // Loading
    $('loading').style.display = state.loading ? 'flex' : 'none';
  }

  function renderChipsBar() {
    const bar = $('chips-bar');
    const chips = buildActiveChips();
    if (!chips.length) { bar.style.display = 'none'; return; }

    bar.style.display = 'flex';
    bar.innerHTML = '';

    const label = document.createElement('span');
    label.className = 'chips-bar-label';
    label.textContent = '篩選中';
    bar.appendChild(label);

    for (const chip of chips) {
      const el = document.createElement('span');
      el.className = 'chip' + (chip.isTime ? ' chip-time' : '');
      el.innerHTML = `${chip.icon ? chip.icon + ' ' : ''}${chip.label} <button class="chip-x" title="清除">×</button>`;
      el.querySelector('.chip-x').addEventListener('click', chip.clear);
      bar.appendChild(el);
    }

    const clearAll = document.createElement('button');
    clearAll.className = 'chip-clear-all';
    clearAll.textContent = '清除全部';
    clearAll.addEventListener('click', clearAllFilters);
    bar.appendChild(clearAll);
  }

  function buildActiveChips() {
    const chips = [];

    // 時段 chip（startTime + duration 合一）
    if (state.filterStartTime) {
      const endMin = toMin(state.filterStartTime) + state.filterDuration;
      const dur = state.filterDuration === 30 ? '0.5 hr' : `${state.filterDuration / 60} hr`;
      chips.push({
        key: 'time',
        label: `${state.filterStartTime}–${fromMin(endMin)} (${dur})`,
        icon: '⏱',
        isTime: true,
        clear: () => setState({ filterStartTime: '', filterDuration: 60 }),
      });
    } else if (state.filterDuration !== 60) {
      const dur = state.filterDuration === 30 ? '0.5 hr' : `${state.filterDuration / 60} hr`;
      chips.push({
        key: 'dur',
        label: `連續 ${dur} 空檔`,
        icon: '⏱',
        isTime: true,
        clear: () => setState({ filterDuration: 60 }),
      });
    }

    if (state.filterCapacity > 0) {
      chips.push({
        key: 'cap',
        label: `${state.filterCapacity}+ 人`,
        clear: () => setState({ filterCapacity: 0 }),
      });
    }

    for (const f of [...state.filterFloors]) {
      chips.push({
        key: 'fl' + f,
        label: f,
        clear: () => {
          const next = new Set(state.filterFloors);
          next.delete(f);
          setState({ filterFloors: next.size ? next : new Set() });
        },
      });
    }

    if (state.filterHideUncommon) {
      chips.push({ key: 'hu', label: '隱藏不常用', clear: () => setState({ filterHideUncommon: false }) });
    }
    if (state.filterExcludeOffHours) {
      chips.push({ key: 'eo', label: '排除冷門時段', clear: () => setState({ filterExcludeOffHours: false }) });
    }

    return chips;
  }

  function clearAllFilters() {
    state.filterStartTime = '';
    state.filterDuration = 60;
    state.filterCapacity = 0;
    state.filterFloors = new Set();
    state.filterHideUncommon = false;
    state.filterExcludeOffHours = false;
    savePrefs();
    syncFilterUI();
    render();
  }

  function renderFilterPanel() {
    $('filter-panel').classList.toggle('open', state.filterOpen);

    // Sync duration chips
    document.querySelectorAll('#dur-chips .fp-chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterDuration);
    });

    // Sync capacity chips
    document.querySelectorAll('#cap-chips .fp-chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterCapacity);
    });

    // Sync checkboxes
    $('filter-hide-uncommon').checked  = state.filterHideUncommon;
    $('filter-exclude-offhours').checked = state.filterExcludeOffHours;

    // Time preview
    const preview = $('fp-time-preview');
    if (state.filterStartTime) {
      const endMin = toMin(state.filterStartTime) + state.filterDuration;
      const dur = state.filterDuration === 30 ? '0.5 hr' : `${state.filterDuration / 60} hr`;
      preview.textContent = `→ ${state.filterStartTime}–${fromMin(endMin)} (${dur}) 都空的會議室`;
      preview.style.display = '';
    } else {
      preview.style.display = 'none';
    }
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
    if (state.filterStartTime && !times.has(state.filterStartTime)) {
      state.filterStartTime = '';
    }
    sel.value = state.filterStartTime;
  }

  function renderFloorFilter() {
    const row   = $('fp-floor-row');
    const list  = $('floor-chips');
    const floors = [...new Set(state.rooms.map(r => r.floor).filter(Boolean))];
    floors.sort((a, b) => {
      const na = parseInt(a) || 0;
      const nb = parseInt(b) || 0;
      return na - nb || String(a).localeCompare(String(b));
    });

    if (!floors.length) {
      row.style.display = 'none';
      state.filterFloors.clear();
      return;
    }

    for (const f of [...state.filterFloors]) {
      if (!floors.includes(f)) state.filterFloors.delete(f);
    }

    row.style.display = '';
    const signature = floors.join('|');
    if (list.dataset.signature !== signature) {
      list.innerHTML = '';
      const mkChip = (val, label, isAll) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fp-chip';
        btn.dataset.value = val;
        btn.dataset.all   = isAll ? '1' : '';
        btn.textContent   = label;
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
      mkChip('', '不限', true);
      for (const f of floors) mkChip(f, f, false);
      list.dataset.signature = signature;
    }

    list.querySelectorAll('.fp-chip').forEach(btn => {
      if (btn.dataset.all) {
        btn.classList.toggle('active', state.filterFloors.size === 0);
      } else {
        btn.classList.toggle('active', state.filterFloors.has(btn.dataset.value));
      }
    });
  }

  function renderResultMeta() {
    const meta = $('result-meta');
    if (!state.rooms.length && !state.loading) {
      meta.style.display = 'none';
      return;
    }
    if (state.loading) { meta.style.display = 'none'; return; }

    meta.style.display = 'flex';
    const filtered = applyFilters(sortedRooms());
    $('rm-count').textContent = filtered.length;

    const BUILDING_LABELS = { '6': '松仁大樓', '1': '仁愛大樓', '2': '敦化大樓' };
    const PERIOD_LABELS   = { MORNING: '上午', AFTERNOON: '下午', ALL: '全天' };
    $('rm-desc').textContent =
      ` 間會議室 · ${BUILDING_LABELS[state.buildingPK] || ''} · ${state.searchDate} ${PERIOD_LABELS[state.timePeriod] || ''}`;

    // favOnly toggle
    const favBtn = $('btn-fav-only');
    favBtn.classList.toggle('active', state.favOnly);
    $('fav-count').textContent = state.favorites.size;
  }

  function renderRooms() {
    const rooms = applyFilters(sortedRooms());

    if (state.viewMode === 'card') {
      $('room-list').style.display = '';
      $('room-table-wrap').style.display = 'none';
      const list = $('room-list');
      list.innerHTML = '';
      if (!rooms.length) {
        const p = document.createElement('p');
        p.className = 'room-list-empty';
        p.textContent = '沒有符合條件的會議室';
        list.appendChild(p);
        return;
      }
      for (const room of rooms) list.appendChild(buildRoomCard(room));
    } else {
      $('room-list').style.display = 'none';
      $('room-table-wrap').style.display = '';
      buildRoomTable(rooms);
    }
  }

  // ── Table View ────────────────────────────────────────────────────────────────

  function buildRoomTable(rooms) {
    const table = $('room-table');
    table.innerHTML = '';

    if (!rooms.length) {
      const caption = document.createElement('caption');
      caption.style.cssText = 'padding:48px;color:var(--text-mute);font-size:13px;';
      caption.textContent = '沒有符合條件的會議室';
      table.appendChild(caption);
      return;
    }

    // 1. Collect time boundary points
    const pointSet = new Set();
    for (const room of rooms) {
      for (const s of [...room.available, ...room.booked]) {
        pointSet.add(toMin(s.startTime));
        pointSet.add(toMin(s.endTime));
      }
    }
    const points = [...pointSet].sort((a, b) => a - b);
    let intervals = points.slice(0, -1).map((p, i) => ({
      start: fromMin(p),
      end:   fromMin(points[i + 1]),
    }));
    if (state.filterExcludeOffHours) {
      intervals = intervals.filter(iv => !isOffHour(toMin(iv.start), toMin(iv.end)));
    }

    // Determine highlight range from startTime filter
    const highlightStart = state.filterStartTime ? toMin(state.filterStartTime) : -1;
    const highlightEnd   = highlightStart >= 0 ? highlightStart + state.filterDuration : -1;

    // 2. Header
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const thRoom = document.createElement('th');
    thRoom.textContent = '會議室';
    headRow.appendChild(thRoom);

    for (const iv of intervals) {
      const th = document.createElement('th');
      th.className = 'rt-slot-col';
      const ivStartMin = toMin(iv.start);
      const ivEndMin   = toMin(iv.end);
      if (highlightStart >= 0 && ivStartMin >= highlightStart && ivEndMin <= highlightEnd) {
        th.classList.add('rt-slot-highlight');
      }
      th.innerHTML = `<span class="rt-th-start">${iv.start}</span><span class="rt-th-end">${iv.end}</span>`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    // 3. Body
    const tbody = document.createElement('tbody');
    const durLabel = state.filterDuration === 30 ? '0.5 hr' : `${state.filterDuration / 60} hr`;

    for (const room of rooms) {
      const isFav = state.favorites.has(String(room.pk));
      const tr = document.createElement('tr');

      // Sticky left col
      const tdName = document.createElement('td');
      tdName.className = 'rt-room-col';
      const inner = document.createElement('div');
      inner.className = 'rt-room-col-inner';
      inner.innerHTML = `
        <div class="rt-room-top">
          <button class="rt-fav-btn ${isFav ? 'fav-on' : ''}" title="${isFav ? '取消最愛' : '加入最愛'}">★</button>
          <span class="rt-name" title="查看詳情">${room.name}</span>
        </div>
        <div class="rt-meta-row">${room.floor}${room.capacity ? `・${room.capacity} 人` : ''}</div>
      `;
      inner.querySelector('.rt-name').addEventListener('click', () => openRoomModal(room));
      inner.querySelector('.rt-fav-btn').addEventListener('click', () => toggleFavorite(room.pk));
      tdName.appendChild(inner);
      tr.appendChild(tdName);

      // Map each interval to status
      const statuses = intervals.map((iv) => {
        const s = toMin(iv.start), e = toMin(iv.end);
        const avail = room.available.find(a => toMin(a.startTime) <= s && toMin(a.endTime) >= e);
        if (avail) return { type: 'free', slot: avail };
        const booked = room.booked.find(b => toMin(b.startTime) <= s && toMin(b.endTime) >= e);
        if (booked) return { type: 'booked', slot: booked, id: `b-${booked.startTime}-${booked.endTime}` };
        return { type: 'empty' };
      });

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

        if (cur.type === 'free') {
          td.classList.add('rt-cell-free');
          td.dataset.slotStart = intervals[i].start;
          td.dataset.slotEnd   = intervals[i].end;
          td.dataset.roomPk    = String(room.pk);
          const freeInner = document.createElement('div');
          freeInner.className = 'rt-free-inner';
          const label = document.createElement('span');
          label.className = 'rt-book-label';
          label.textContent = `+ 預訂 ${durLabel}`;
          freeInner.appendChild(label);
          td.appendChild(freeInner);
          td.addEventListener('click', () => {
            const startMin = toMin(td.dataset.slotStart);
            const endMin   = startMin + state.filterDuration;
            handleBook({ pk: td.dataset.roomPk, start: td.dataset.slotStart, end: fromMin(endMin) });
          });
        } else if (cur.type === 'booked') {
          td.classList.add('rt-cell-booked');
          const b = cur.slot;
          const bookedInner = document.createElement('div');
          bookedInner.className = 'rt-booked-inner';
          const lines = (b.info && b.info.length)
            ? b.info
            : [b.title, b.department, b.owner, b.ext].filter(Boolean);
          const display = lines.length ? lines : ['已預訂'];
          // 逐行渲染，保留姓名與分機等所有欄位
          display.forEach((text, idx) => {
            const div = document.createElement('div');
            div.className = idx === 0 ? 'rt-booked-title' : idx === 1 ? 'rt-booked-dept' : 'rt-booked-owner';
            div.textContent = text;
            bookedInner.appendChild(div);
          });
          bookedInner.title = `${display.join(' / ')}（${b.startTime}–${b.endTime}）`;
          td.appendChild(bookedInner);
        } else {
          td.classList.add('rt-cell-empty');
          td.innerHTML = '<div class="rt-empty">—</div>';
        }

        tr.appendChild(td);
        i += span;
      }

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    // Hover: highlight consecutive free cells within filterDuration
    attachTableHover(table, intervals);
  }

  function attachTableHover(table, intervals) {
    let hovered = [];

    table.addEventListener('mouseover', (e) => {
      const td = e.target.closest('td.rt-cell-free');
      if (!td) return;
      clearHoverCells(hovered);
      hovered = [];

      const slotStart = toMin(td.dataset.slotStart);
      const slotEnd   = slotStart + state.filterDuration;
      const tr = td.closest('tr');

      tr.querySelectorAll('td.rt-cell-free').forEach(cell => {
        const cs = toMin(cell.dataset.slotStart);
        const ce = toMin(cell.dataset.slotEnd);
        if (cs >= slotStart && ce <= slotEnd) {
          cell.classList.add('rt-cell-hover');
          hovered.push(cell);
        }
      });
    });

    table.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest('tr')) {
        clearHoverCells(hovered);
        hovered = [];
      } else {
        const fromTr = e.target.closest('tr');
        const toTr   = e.relatedTarget.closest('tr');
        if (fromTr !== toTr) {
          clearHoverCells(hovered);
          hovered = [];
        }
      }
    });
  }

  function clearHoverCells(cells) {
    for (const c of cells) c.classList.remove('rt-cell-hover');
  }

  // ── Card View ─────────────────────────────────────────────────────────────────

  function buildRoomCard(room) {
    const card = document.createElement('div');
    card.className = 'room-card';

    const isFav = state.favorites.has(String(room.pk));
    const available = state.filterExcludeOffHours
      ? room.available.filter(s => !isOffHour(toMin(s.startTime), toMin(s.endTime)))
      : room.available;
    const booked = state.filterExcludeOffHours
      ? room.booked.filter(b => !isOffHour(toMin(b.startTime), toMin(b.endTime)))
      : room.booked;

    // Head
    const head = document.createElement('div');
    head.className = 'card-head';
    const headLeft = document.createElement('div');
    headLeft.className = 'card-head-left';

    const nameEl = document.createElement('div');
    nameEl.className = 'card-room-name';
    nameEl.textContent = room.name;
    nameEl.title = '查看詳情';
    nameEl.addEventListener('click', () => openRoomModal(room));
    headLeft.appendChild(nameEl);

    const tags = document.createElement('div');
    tags.className = 'card-tags';
    const tagFloor = document.createElement('span');
    tagFloor.className = 'card-tag';
    tagFloor.textContent = room.floor;
    tags.appendChild(tagFloor);
    if (room.capacity) {
      const tagCap = document.createElement('span');
      tagCap.className = 'card-tag';
      tagCap.textContent = `${room.capacity} 人`;
      tags.appendChild(tagCap);
    }
    const tagFree = document.createElement('span');
    tagFree.className = 'card-tag' + (available.length ? ' card-tag-free' : '');
    tagFree.textContent = available.length ? `${available.length} 個空檔` : '已滿';
    tags.appendChild(tagFree);
    headLeft.appendChild(tags);
    head.appendChild(headLeft);

    const favBtn = document.createElement('button');
    favBtn.className = 'card-fav-btn' + (isFav ? ' fav-on' : '');
    favBtn.textContent = '★';
    favBtn.title = isFav ? '取消最愛' : '加入最愛';
    favBtn.addEventListener('click', () => toggleFavorite(room.pk));
    head.appendChild(favBtn);
    card.appendChild(head);

    // Equipment
    if (room.equipments && room.equipments.length) {
      const equip = document.createElement('div');
      equip.className = 'card-equip';
      equip.textContent = room.equipments.join('・');
      card.appendChild(equip);
    }

    // Free slot chips
    if (available.length) {
      const slots = document.createElement('div');
      slots.className = 'card-slots';
      for (const s of available) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'card-slot-chip';
        chip.textContent = `${s.startTime}–${s.endTime}`;
        chip.addEventListener('click', () => handleBook({ pk: s.pk, start: s.startTime, end: s.endTime }));
        slots.appendChild(chip);
      }
      card.appendChild(slots);
    }

    // Booked list (up to 3)
    const bookedVisible = booked.slice(0, 3);
    if (bookedVisible.length) {
      const bookedList = document.createElement('div');
      bookedList.className = 'card-booked-list';
      for (const b of bookedVisible) {
        const row = document.createElement('div');
        row.className = 'card-booked-row';
        const lines = (b.info && b.info.length)
          ? b.info
          : [b.title, b.department, b.owner, b.ext].filter(Boolean);
        const timeEl = document.createElement('span');
        timeEl.className = 'card-booked-time';
        timeEl.textContent = `${b.startTime}–${b.endTime}`;
        const infoEl = document.createElement('div');
        infoEl.className = 'card-booked-info';
        const titleEl = document.createElement('span');
        titleEl.className = 'card-booked-title';
        titleEl.textContent = lines[0] || '已預訂';
        infoEl.appendChild(titleEl);
        if (lines.length > 1) {
          const subEl = document.createElement('span');
          subEl.className = 'card-booked-sub';
          subEl.textContent = lines.slice(1).join(' · ');
          infoEl.appendChild(subEl);
        }
        row.appendChild(timeEl);
        row.appendChild(infoEl);
        bookedList.appendChild(row);
      }
      card.appendChild(bookedList);
    }

    return card;
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  function mergeRooms(morningRooms, afternoonRooms) {
    const map = new Map();
    for (const room of morningRooms) map.set(room.pk, { ...room });
    for (const room of afternoonRooms) {
      if (map.has(room.pk)) {
        const existing = map.get(room.pk);
        const slotKey = (s) => `${s.startTime}-${s.endTime}`;
        const availSet = new Set(existing.available.map(slotKey));
        for (const s of room.available) {
          if (!availSet.has(slotKey(s))) existing.available.push(s);
        }
        const bookedSet = new Set(existing.booked.map(slotKey));
        for (const b of room.booked) {
          if (!bookedSet.has(slotKey(b))) existing.booked.push(b);
        }
      } else {
        map.set(room.pk, { ...room });
      }
    }
    return [...map.values()];
  }

  async function handleSearch() {
    setState({ loading: true, error: null, rooms: [] });
    try {
      const base = { searchDate: state.searchDate, buildingPK: state.buildingPK };
      let rooms, csrf, searchDate;

      if (state.timePeriod === 'ALL') {
        const morningHtml   = await CbApi.fetchRooms({ ...base, timePeriod: 'MORNING' });
        const afternoonHtml = await CbApi.fetchRooms({ ...base, timePeriod: 'AFTERNOON' });
        const morning   = CbParser.parse(morningHtml);
        const afternoon = CbParser.parse(afternoonHtml);
        rooms = mergeRooms(morning.rooms, afternoon.rooms);
        csrf  = morning.csrf || afternoon.csrf;
        searchDate = morning.searchDate || afternoon.searchDate;
      } else {
        const html = await CbApi.fetchRooms({ ...base, timePeriod: state.timePeriod });
        ({ rooms, csrf, searchDate } = CbParser.parse(html));
      }

      setState({ rooms, searchDate, csrf, loading: false });
    } catch (err) {
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

  // ── Confirm Modal ─────────────────────────────────────────────────────────────

  function openConfirmModal(dataset) {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const room = state.rooms.find(r => String(r.pk) === String(dataset.pk));

    $('cm-room-name').textContent = room?.name || '會議室';

    const metaParts = [room?.floor, room?.capacity ? `${room.capacity} 人` : '', (room?.equipments || []).join('、')].filter(Boolean);
    $('cm-meta').textContent = metaParts.join(' · ');

    const startMin = toMin(dataset.start);
    const endTime  = dataset.end || fromMin(startMin + state.filterDuration);
    const dur = (toMin(endTime) - startMin) / 60;
    const durStr = dur < 1 ? `${dur * 60} 分鐘` : `${dur} 小時`;
    $('cm-time').innerHTML = `${esc(dataset.start)} – ${esc(endTime)} <em style="font-size:14px;font-weight:400;color:var(--text-mute)">(${durStr})</em>`;

    const modal = $('confirm-modal');
    modal.style.display = 'flex';
    modal.dataset.pk    = dataset.pk;
    modal.dataset.start = dataset.start;
    modal.dataset.end   = endTime;
  }

  function closeConfirmModal() { $('confirm-modal').style.display = 'none'; }

  async function handleBook(dataset) {
    if (!state.csrf) { setState({ error: '缺少 CSRF token，請先查詢一次' }); return; }
    openConfirmModal({ pk: dataset.pk, start: dataset.start, end: dataset.end });
  }

  async function confirmBookingGo() {
    const modal = $('confirm-modal');
    const ds = { pk: modal.dataset.pk, start: modal.dataset.start, end: modal.dataset.end };
    closeConfirmModal();
    try {
      await CbApi.openBooking({
        csrf: state.csrf,
        startTime: ds.start,
        endTime: ds.end,
        meetingRoomPK: ds.pk,
      });
    } catch (err) {
      setState({ error: `開啟預訂失敗：${err.message}` });
    }
  }

  // ── Buildings ─────────────────────────────────────────────────────────────────

  function populateBuildings(buildings) {
    if (!buildings || !buildings.length) return;
    const sel = $('select-building');
    const current = sel.value;
    sel.innerHTML = buildings.map(b => `<option value="${b.value}">${b.label}</option>`).join('');
    if (buildings.some(b => b.value === current)) sel.value = current;
    else state.buildingPK = sel.value;
  }

  // ── Session ───────────────────────────────────────────────────────────────────

  async function checkSession() {
    setState({ sessionChecking: true, error: null });
    try {
      const result = await CbApi.checkSession();
      if (result.ok && result.loggedIn) {
        populateBuildings(result.buildings);
        setState({ sessionChecking: false, sessionOk: true, error: null });
      } else {
        setState({ sessionChecking: false, sessionOk: false, error: '請先開啟原站台並登入' });
      }
    } catch (err) {
      setState({ sessionChecking: false, sessionOk: false, error: '無法連線至原站台，請確認已開啟 booking.cathayholdings.com' });
    }
  }

  // ── Holidays ──────────────────────────────────────────────────────────────────

  const TW_HOLIDAYS = new Map();
  const HOLIDAYS_KEY = 'cb_holidays';

  async function loadHolidays() {
    const result = await chrome.storage.local.get(HOLIDAYS_KEY);
    const stored = result[HOLIDAYS_KEY];
    if (!stored || !stored.length) return;
    const entries = typeof stored[0] === 'string' ? stored.map(d => ({ d, n: '' })) : stored;
    Calendar.setHolidays(entries);
    setHolidayStatus(`已載入 ${entries.length} 個假日`);
  }

  function parseHolidayCsv(text) {
    const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
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

  // ── Calendar ──────────────────────────────────────────────────────────────────

  const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
  function dowLabel(dateStr) {
    if (!dateStr || dateStr === '—') return '';
    const dow = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00').getDay();
    return `週${DOW_LABELS[dow]}`;
  }

  const Calendar = (() => {
    const pad = (n) => String(n).padStart(2, '0');
    let viewYear  = new Date().getFullYear();
    let viewMonth = new Date().getMonth();
    let calOpen   = false;

    function renderMonth() {
      const today    = todayStr();
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

    function open()  { $('cal-popup').style.display = ''; calOpen = true;  renderMonth(); }
    function close() { $('cal-popup').style.display = 'none'; calOpen = false; }

    function setDate(dateStr) {
      const d = new Date(dateStr.replace(/\//g, '-') + 'T00:00:00');
      viewYear  = d.getFullYear();
      viewMonth = d.getMonth();
      $('cal-display').textContent = dateStr;
      $('cal-dow').textContent = dowLabel(dateStr);
      if (calOpen) renderMonth();
    }

    function init(initialDateStr) {
      if (initialDateStr) {
        const d = new Date(initialDateStr.replace(/\//g, '-') + 'T00:00:00');
        viewYear  = d.getFullYear();
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

  // ── Sync filter UI state ─────────────────────────────────────────────────────

  function syncFilterUI() {
    document.querySelectorAll('#dur-chips .fp-chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterDuration);
    });
    document.querySelectorAll('#cap-chips .fp-chip').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.value) === state.filterCapacity);
    });
    $('filter-hide-uncommon').checked    = state.filterHideUncommon;
    $('filter-exclude-offhours').checked = state.filterExcludeOffHours;
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  async function init() {
    await loadFavorites();
    await loadHolidays();
    const prefs = await loadPrefs();
    const defaultPeriod = new Date().getHours() < 12 ? 'MORNING' : 'AFTERNOON';

    state.searchDate          = prefs.searchDate;
    state.timePeriod          = prefs.timePeriod || defaultPeriod;
    state.buildingPK          = prefs.buildingPK || '6';
    state.viewMode            = prefs.viewMode || 'table';
    state.filterDuration      = prefs.filterDuration;
    state.filterCapacity      = prefs.filterCapacity;
    state.filterHideUncommon  = prefs.filterHideUncommon;
    state.filterExcludeOffHours = prefs.filterExcludeOffHours;

    Calendar.init(state.searchDate);
    $('select-building').value = state.buildingPK;

    document.querySelectorAll('.tb-period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.timePeriod);
    });
    syncFilterUI();

    // ── Event listeners ───────────────────────────────────────────────────────

    $('btn-search').addEventListener('click', handleSearch);
    $('btn-check-session').addEventListener('click', checkSession);

    $('btn-login').addEventListener('click', () => CbApi.closeOverlay());

    // View toggle
    $('btn-view-card').addEventListener('click', () => {
      if (state.viewMode !== 'card') { setState({ viewMode: 'card' }); savePrefs(); }
    });
    $('btn-view-table').addEventListener('click', () => {
      if (state.viewMode !== 'table') { setState({ viewMode: 'table' }); savePrefs(); }
    });

    // Filter panel toggle
    $('btn-filter').addEventListener('click', () => {
      setState({ filterOpen: !state.filterOpen });
    });

    // Room name search
    $('input-room-search').addEventListener('input', (e) => {
      setState({ nameSearch: e.target.value });
    });
    $('btn-clear-search').addEventListener('click', () => {
      $('input-room-search').value = '';
      setState({ nameSearch: '' });
    });
    $('input-room-search').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $('input-room-search').value = '';
        setState({ nameSearch: '' });
      }
    });

    // Date quick buttons
    document.querySelectorAll('.tb-quick-btn').forEach(btn => {
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
        savePrefs();
      });
    });

    // Period buttons
    document.querySelectorAll('.tb-period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tb-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timePeriod = btn.dataset.value;
        savePrefs();
      });
    });

    $('select-building').addEventListener('change', (e) => {
      state.buildingPK = e.target.value;
      savePrefs();
    });

    // Filter panel: start time
    $('filter-start-time').addEventListener('change', (e) => {
      state.filterStartTime = e.target.value;
      savePrefs();
      render();
    });

    // Duration chips
    document.querySelectorAll('#dur-chips .fp-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filterDuration = Number(btn.dataset.value);
        savePrefs();
        render();
      });
    });

    // Capacity chips
    document.querySelectorAll('#cap-chips .fp-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.filterCapacity = Number(btn.dataset.value);
        savePrefs();
        render();
      });
    });

    // Checkboxes
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

    // favOnly toggle
    $('btn-fav-only').addEventListener('click', () => {
      setState({ favOnly: !state.favOnly });
    });

    // Holiday import
    $('btn-load-builtin-holidays').addEventListener('click', () => {
      setHolidayStatus('載入中…');
      loadBuiltinHolidays('115').catch((err) => setHolidayStatus(err.message, true));
    });
    $('btn-clear-holidays').addEventListener('click', () => {
      Calendar.setHolidays([]);
      chrome.storage.local.remove(HOLIDAYS_KEY);
      setHolidayStatus('已清除');
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
        } catch (err) {
          setHolidayStatus('解析失敗：' + err.message, true);
        }
      };
      reader.readAsText(file, 'UTF-8');
      e.target.value = '';
    });

    // Confirm modal
    $('confirm-close').addEventListener('click', closeConfirmModal);
    $('confirm-cancel').addEventListener('click', closeConfirmModal);
    $('confirm-modal').querySelector('.modal-backdrop').addEventListener('click', closeConfirmModal);
    $('confirm-go').addEventListener('click', confirmBookingGo);

    // Room detail modal
    $('modal-close').addEventListener('click', closeRoomModal);
    $('room-modal').querySelector('.modal-backdrop').addEventListener('click', closeRoomModal);

    // Image viewer
    $('image-viewer').addEventListener('click', closeImageViewer);

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      Calendar.close();
      if ($('image-viewer').style.display === 'flex') { closeImageViewer(); return; }
      if ($('confirm-modal').style.display === 'flex') { closeConfirmModal(); return; }
      if ($('room-modal').style.display === 'flex') { closeRoomModal(); return; }
      if (state.filterOpen) setState({ filterOpen: false });
    });

    render();
    checkSession();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
