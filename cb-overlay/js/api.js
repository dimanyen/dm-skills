// api.js — overlay 模式：iframe 透過 postMessage 與 parent (overlay.js) bridge 溝通

const CbApi = (() => {
  const TAG = '[CB-Overlay:api]';
  let nextId = 1;
  const pending = new Map();

  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.__cbReply !== true) return;
    const { id } = ev.data;
    const cb = pending.get(id);
    if (!cb) return;
    pending.delete(id);
    cb(ev.data);
  });

  function call(type, payload, { timeoutMs = 30000 } = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('bridge 逾時，請重新整理原站台再試'));
      }, timeoutMs);
      pending.set(id, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      console.log(TAG, '→', type, payload || '');
      window.parent.postMessage({ __cb: true, id, type, payload }, '*');
    });
  }

  async function checkSession() {
    return call('CB_CHECK_SESSION');
  }

  async function fetchRooms(options = {}) {
    const r = await call('CB_FETCH_ROOMS', options);
    if (!r.ok) throw new Error(r.error || '查詢失敗');
    return r.html;
  }

  async function openBooking(params) {
    const r = await call('CB_OPEN_BOOKING', params);
    if (!r.ok) throw new Error(r.error || '開啟預訂失敗');
  }

  async function fetchRoomImages(meetingRoomPK) {
    const r = await call('CB_FETCH_ROOM_IMAGES', { meetingRoomPK });
    if (!r.ok) throw new Error(r.error || '取得圖片失敗');
    return r.images;
  }

  function closeOverlay() {
    window.parent.postMessage({ __cb: true, id: -1, type: 'CB_CLOSE_OVERLAY' }, '*');
  }

  function reloadHost() {
    window.parent.postMessage({ __cb: true, id: -1, type: 'CB_RELOAD_HOST' }, '*');
  }

  return { checkSession, fetchRooms, openBooking, fetchRoomImages, closeOverlay, reloadHost };
})();
