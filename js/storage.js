// localStorage 키 → Firebase /data/ 경로 매핑
const FB_SYNC_KEYS = {
  'sj-entries-v4':        'data/entries',
  'sj-users-v6':          'data/users',
  'sj-targets-v4':        'data/targets',
  'sj-notices':           'data/notices',
  'sj-revisits':          'data/revisits',
  'sj-clients':           'data/clients',
  'sj-signup-pending-v1': 'data/signup-pending',
  'sj-grade-tiers':       'data/grade-tiers',
  'sj-grade-overrides':   'data/grade-overrides',
  'sj-manual-grades':     'data/manual-grades',
};

function _fbSyncPath(key) {
  if (FB_SYNC_KEYS[key]) return FB_SYNC_KEYS[key];
  const safePathKey = value => String(value || '').replace(/[.$#[\]/]/g, '_').slice(0, 120);
  const wm = key.match(/^sj-weekly-reports-(.+)$/);
  if (wm) return `data/weekly-reports/${safePathKey(wm[1])}`;
  const mm = key.match(/^sj-monthly-reports-(.+)$/);
  if (mm) return `data/monthly-reports/${safePathKey(mm[1])}`;
  return null;
}

function _fbUrl(path) {
  const rawBase = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/+$/, '');
  const base = typeof securityNormalizeFirebaseUrl === 'function' ? securityNormalizeFirebaseUrl(rawBase) : rawBase;
  return base ? `${base}/${path}.json` : null;
}

function setShared(key, val) {
  const cleanVal = typeof securitySanitizeData === 'function' ? securitySanitizeData(val) : val;
  try {
    localStorage.setItem(key, JSON.stringify(cleanVal));
  } catch (err) {
    console.error('[storage:set]', key, err);
    return false;
  }
  const path = _fbSyncPath(key);
  if (path) {
    const url = _fbUrl(path);
    if (url) {
      fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanVal),
      }).catch(e => console.warn('[storage:fb:set]', key, e));
    }
  }
  return true;
}

function getShared(key, def) {
  try {
    const v = localStorage.getItem(key);
    const parsed = v ? JSON.parse(v) : def;
    return typeof securitySanitizeData === 'function' ? securitySanitizeData(parsed) : parsed;
  } catch (err) {
    console.error('[storage:get]', key, err);
    return def;
  }
}

function setPlainStorage(key, val) {
  try {
    localStorage.setItem(key, val);
    return true;
  } catch (err) {
    console.error('[storage:setPlain]', key, err);
    return false;
  }
}

function setErpRuntimeData(parsedOrder, parsedShip, payload = {}) {
  const order = Array.isArray(parsedOrder) ? parsedOrder : [];
  const ship = Array.isArray(parsedShip) ? parsedShip : [];
  window.__erpRemoteData = {
    order,
    ship,
    meta: {
      source: payload.source || 'amarans-playwright',
      syncedAt: payload.syncedAt || new Date().toISOString(),
      orderCount: payload.orderCount || order.length,
      shipCount: payload.shipCount || ship.length,
    },
  };
  allOrderOrders = order;
  allShipOrders = ship;
  try {
    localStorage.removeItem('sj-orders-order');
    localStorage.removeItem('sj-orders-ship');
    localStorage.removeItem('sj-orders');
    localStorage.setItem('sj-erp-sync-meta', JSON.stringify(window.__erpRemoteData.meta));
  } catch (err) {
    console.warn('[storage:erp:meta]', err);
  }
}

// 앱 진입 시 Firebase /data + erp/latest 전체를 localStorage에 동기화
async function syncFromFirebase() {
  const rawBase = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/+$/, '');
  const base = typeof securityNormalizeFirebaseUrl === 'function' ? securityNormalizeFirebaseUrl(rawBase) : rawBase;
  if (!base) return;

  // /data (영업일지, 사용자, 거래처 등)
  try {
    const res = await fetch(`${base}/data.json?_=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = typeof securitySanitizeData === 'function'
        ? securitySanitizeData(await res.json())
        : await res.json();
      if (data && typeof data === 'object') {
        if (data.entries          !== undefined) localStorage.setItem('sj-entries-v4',         JSON.stringify(data.entries));
        if (data.users            !== undefined) localStorage.setItem('sj-users-v6',            JSON.stringify(data.users));
        if (data.targets          !== undefined) localStorage.setItem('sj-targets-v4',          JSON.stringify(data.targets));
        if (data.notices          !== undefined) localStorage.setItem('sj-notices',             JSON.stringify(data.notices));
        if (data.revisits         !== undefined) localStorage.setItem('sj-revisits',            JSON.stringify(data.revisits));
        if (data.clients          !== undefined) localStorage.setItem('sj-clients',             JSON.stringify(data.clients));
        if (data['signup-pending']!== undefined) localStorage.setItem('sj-signup-pending-v1',  JSON.stringify(data['signup-pending']));
        if (data['grade-tiers']   !== undefined) localStorage.setItem('sj-grade-tiers',         JSON.stringify(data['grade-tiers']));
        if (data['grade-overrides']!==undefined) localStorage.setItem('sj-grade-overrides',     JSON.stringify(data['grade-overrides']));
        if (data['manual-grades'] !== undefined) localStorage.setItem('sj-manual-grades',       JSON.stringify(data['manual-grades']));
        if (data['weekly-reports'] && typeof data['weekly-reports'] === 'object') {
          Object.entries(data['weekly-reports']).forEach(([uid, val]) => localStorage.setItem('sj-weekly-reports-' + uid, JSON.stringify(val)));
        }
        if (data['monthly-reports'] && typeof data['monthly-reports'] === 'object') {
          Object.entries(data['monthly-reports']).forEach(([uid, val]) => localStorage.setItem('sj-monthly-reports-' + uid, JSON.stringify(val)));
        }
      }
    }
  } catch (e) { console.warn('[storage:syncFromFirebase /data]', e); }

  // erp/latest (주문/출고 ERP 데이터) — loadAndRender() 전에 localStorage에 넣어야 렌더 시 데이터가 있음
  try {
    const erpRes = await fetch(`${base}/erp/latest.json?_=${Date.now()}`, { cache: 'no-store' });
    if (erpRes.ok) {
      const payload = await erpRes.json().catch(() => null);
      if (payload && typeof erpExtractApiRows === 'function') {
        const parsedOrder = erpNormalizeApiRows(erpExtractApiRows(payload, 'order'), 'order');
        const parsedShip  = erpNormalizeApiRows(erpExtractApiRows(payload, 'ship'),  'ship');
        if (parsedOrder.length || parsedShip.length) setErpRuntimeData(parsedOrder, parsedShip, payload);
      }
    }
  } catch (e) { console.warn('[storage:syncFromFirebase erp/latest]', e); }
}

// 현재 브라우저 localStorage 데이터 전체를 Firebase에 한 번에 업로드 (마이그레이션용)
async function pushAllToFirebase() {
  const url = _fbUrl('data');
  if (!url) { alert('Firebase DB URL이 설정되지 않았습니다.'); return false; }

  const payload = {};

  // 고정 키
  const fixed = {
    entries:          'sj-entries-v4',
    users:            'sj-users-v6',
    targets:          'sj-targets-v4',
    notices:          'sj-notices',
    revisits:         'sj-revisits',
    clients:          'sj-clients',
    'signup-pending': 'sj-signup-pending-v1',
    'grade-tiers':    'sj-grade-tiers',
    'grade-overrides':'sj-grade-overrides',
    'manual-grades':  'sj-manual-grades',
  };
  Object.entries(fixed).forEach(([fbKey, lsKey]) => {
    try {
      const v = localStorage.getItem(lsKey);
      if (v) payload[fbKey] = JSON.parse(v);
    } catch (_) {}
  });

  // 동적 키: weekly/monthly-reports
  const weekly = {}, monthly = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const wm = k && k.match(/^sj-weekly-reports-(.+)$/);
    const mm = k && k.match(/^sj-monthly-reports-(.+)$/);
    try {
      if (wm) weekly[wm[1]] = JSON.parse(localStorage.getItem(k));
      if (mm) monthly[mm[1]] = JSON.parse(localStorage.getItem(k));
    } catch (_) {}
  }
  if (Object.keys(weekly).length)  payload['weekly-reports']  = weekly;
  if (Object.keys(monthly).length) payload['monthly-reports'] = monthly;

  try {
    const cleanPayload = typeof securitySanitizeData === 'function' ? securitySanitizeData(payload) : payload;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanPayload),
    });
    return res.ok;
  } catch (e) {
    console.error('[storage:pushAllToFirebase]', e);
    return false;
  }
}

function setupRealtimeListeners() {}
function updateFbStatus() {}
