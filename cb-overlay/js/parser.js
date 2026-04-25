// parser.js — 解析原站台回傳的 HTML，轉成乾淨的資料結構

const CbParser = (() => {
  const TAG = '[CB:parser]';

  function clean(s) {
    return (s || '').replace(/\s+/g, ' ').trim();
  }

  function textOf(el, sel) {
    return clean(el?.querySelector(sel)?.textContent || '');
  }

  function toInt(s) {
    const m = String(s || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function normalizeImageSrc(src) {
    if (!src) return '';
    if (/default-img/i.test(src)) return ''; // 過濾 placeholder
    if (src.startsWith('data:')) return src;
    if (/^https?:\/\//.test(src)) return src;
    if (src.startsWith('//')) return 'https:' + src;
    if (src.startsWith('/')) return 'https://booking.cathayholdings.com' + src;
    return src;
  }

  function extractImages(scope) {
    const urls = [...scope.querySelectorAll('img')]
      .map((img) => img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '')
      .map(normalizeImageSrc)
      .filter(Boolean);
    return [...new Set(urls)];
  }

  // 解析會議室詳細資料區塊（.Meeting_detail）
  function parseDetails(root) {
    const map = new Map();
    const cards = root.querySelectorAll('.Meeting_detail .ToggleCard[data-meetingroompk]');
    console.log(TAG, `parseDetails — 找到 ${cards.length} 個 ToggleCard`);
    for (const card of cards) {
      const pk = card.getAttribute('data-meetingroompk') || '';
      const detail = { address: '', floor: '', capacity: null, equipments: [], description: '', rules: '', images: [] };

      detail.images = extractImages(card);

      for (const g of card.querySelectorAll('.card .Text_area ul.Title8')) {
        const label = clean(g.querySelector('li.Green_color')?.textContent || '');
        const vals = [...g.querySelectorAll('li:not(.Green_color)')]
          .map((li) => clean(li.textContent))
          .filter(Boolean);
        const val = vals.join(' ');

        if (/地址/.test(label)) detail.address = val;
        else if (/樓層/.test(label)) detail.floor = val;
        else if (/容納人數/.test(label)) detail.capacity = toInt(val);
        else if (/內建設備/.test(label)) detail.equipments = val ? val.split('、').map(clean).filter(Boolean) : [];
        else if (/描述/.test(label)) detail.description = val;
        else if (/借用規則/.test(label)) detail.rules = val;
      }

      map.set(pk, detail);
    }

    // 全域補抓：若圖片不在 ToggleCard 內，依最接近的 data-meetingroompk 祖先關聯
    root.querySelectorAll('img.extendImg, .Meeting_room_pic img, img').forEach((img) => {
      const ancestor = img.closest('[data-meetingroompk]');
      if (!ancestor) return;
      const pk = ancestor.getAttribute('data-meetingroompk');
      if (!pk || !map.has(pk)) return;
      const src = normalizeImageSrc(img.getAttribute('src') || img.getAttribute('data-src') || '');
      if (!src) return;
      const detail = map.get(pk);
      if (!detail.images.includes(src)) {
        detail.images.push(src);
      }
    });

    let total = 0;
    for (const [, d] of map) total += d.images.length;
    console.log(TAG, `parseDetails — 共抓取 ${total} 張圖片`);
    return map;
  }

  // 解析單一會議室區塊（.Booking_area）
  function parseArea(area, detailMap) {
    const pk = area.querySelector('input[name="meetingRoomPK"]')?.value || '';

    const meta = {
      pk,
      floor: textOf(area, '.Title .Floor'),
      name: textOf(area, '.Title .Room'),
      capacity: toInt(textOf(area, '.Title .Other .Yello_color')),
    };

    const detail = detailMap.get(pk) || {};
    if (!meta.floor && detail.floor) meta.floor = detail.floor;
    if (!meta.capacity && detail.capacity) meta.capacity = detail.capacity;

    const available = [...area.querySelectorAll('button.Calendar_block.Insert_block')].map((btn) => ({
      startTime: btn.getAttribute('data-starttime') || '',
      endTime: btn.getAttribute('data-endtime') || '',
      pk: btn.getAttribute('data-meetingroompk') || pk,
    }));

    const booked = [...area.querySelectorAll('button.Calendar_block.Green_bg_block')].map((btn) => {
      // 抓取所有文字：葉節點取 textContent；混合內容節點（如 .Section 人名+電話）整行取，跳過其子孫
      const info = [];
      const seen = new Set();
      const skip = new Set();
      const addInfo = (t) => { t = clean(t); if (t && !seen.has(t)) { seen.add(t); info.push(t); } };
      btn.querySelectorAll('*').forEach((el) => {
        if (skip.has(el)) return;
        const hasMixed = el.firstElementChild &&
          [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && clean(n.textContent));
        if (hasMixed) {
          addInfo(el.textContent);
          el.querySelectorAll('*').forEach((d) => skip.add(d));
        } else if (!el.firstElementChild) {
          addInfo(el.textContent);
        }
      });
      return {
        startTime: btn.getAttribute('data-starttime') || '',
        endTime: btn.getAttribute('data-endtime') || '',
        title: textOf(btn, '.Company.textDis') || textOf(btn, '.Company'),
        department: textOf(btn, '.Department'),
        info,
      };
    });

    return {
      ...meta,
      address: detail.address || '',
      equipments: detail.equipments || [],
      description: detail.description || '',
      rules: detail.rules || '',
      images: detail.images || [],
      available,
      booked,
    };
  }

  function parseSearchDate(doc) {
    const val = doc.querySelector('input[name="searchBean.searchDate"]')?.value || '';
    return val.replace(/\//g, '-');
  }

  function parseCsrf(doc) {
    return (
      doc.querySelector('input[name="_csrf"]')?.value ||
      doc.querySelector('meta[name="_csrf"]')?.getAttribute('content') ||
      ''
    );
  }

  // 主入口：html string → { rooms, searchDate, csrf }
  function parse(html) {
    console.log(TAG, `parse 開始，HTML 長度=${html.length}`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const detailMap = parseDetails(doc.body);
    const areas = [...doc.querySelectorAll('.Booking_area')];
    console.log(TAG, `找到 ${areas.length} 個 .Booking_area`);
    const rooms = areas.map((area) => parseArea(area, detailMap));
    const searchDate = parseSearchDate(doc);
    const csrf = parseCsrf(doc);
    console.log(TAG, `parse 完成 — rooms=${rooms.length}, searchDate=${searchDate}, csrf=${csrf ? csrf.slice(0,8)+'…' : '(empty)'}`);
    rooms.forEach((r) => {
      console.log(TAG, `  ├ [${r.pk}] ${r.name} | 樓層=${r.floor} 容量=${r.capacity} 空檔=${r.available.length} 已訂=${r.booked.length}`);
    });
    return { rooms, searchDate, csrf };
  }

  return { parse, parseCsrf, parseSearchDate };
})();
