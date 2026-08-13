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
  'sj-grade-churn-settings': 'data/grade-churn-settings',
  'sj-login-logs-v1':     'data/login-logs',
};

const AUTH_LOCAL_KEYS = new Set([
  'sj-users-v6',
  'sj-signup-pending-v1',
]);

const SENSITIVE_LOCAL_KEYS = new Set([
  ...Object.keys(FB_SYNC_KEYS),
  'sj-orders-order',
  'sj-orders-ship',
  'sj-orders',
  'sj-erp-sync-meta',
  'sj-erp-auto-sync-meta',
  'sj-erp-auto-sync-lock',
  'sj-erp-last-sync',
]);

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

function _safeSetJsonStorage(key, value) {
  const cleanVal = typeof securitySanitizeData === 'function' ? securitySanitizeData(value) : value;
  localStorage.setItem(key, JSON.stringify(cleanVal));
}

function _isSensitiveLocalKey(key) {
  return SENSITIVE_LOCAL_KEYS.has(key)
    || /^sj-weekly-reports-/.test(key)
    || /^sj-monthly-reports-/.test(key)
    || /^sj-draft-/.test(key);
}

function _canRemoteWriteSharedKey(key) {
  if (key === 'sj-signup-pending-v1') return true;
  return typeof currentUser !== 'undefined' && !!currentUser;
}

function clearSensitiveLocalCache(options = {}) {
  const keepAuth = options.keepAuth === true;
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !_isSensitiveLocalKey(key)) continue;
      if (keepAuth && AUTH_LOCAL_KEYS.has(key)) continue;
      keys.push(key);
    }
    keys.forEach(key => localStorage.removeItem(key));
  } catch (err) {
    console.warn('[storage:clearSensitiveLocalCache]', err);
  }

  try {
    window.__erpRemoteData = null;
    if (typeof allOrders !== 'undefined') allOrders = [];
    if (typeof allOrderOrders !== 'undefined') allOrderOrders = [];
    if (typeof allShipOrders !== 'undefined') allShipOrders = [];
    if (typeof allEntries !== 'undefined') allEntries = [];
    if (typeof allClients !== 'undefined') allClients = [];
    if (typeof allNotices !== 'undefined') allNotices = [];
    if (typeof allRevisits !== 'undefined') allRevisits = [];
    if (typeof targets !== 'undefined') targets = {};
  } catch (_) {}
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
    if (!_canRemoteWriteSharedKey(key)) {
      console.warn('[storage:fb:set:blocked-before-login]', key);
      return true;
    }
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

// 로그인 화면에서는 사용자/가입대기 정보만 최소 조회한다.
async function syncAuthFromFirebase() {
  const rawBase = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/+$/, '');
  const base = typeof securityNormalizeFirebaseUrl === 'function' ? securityNormalizeFirebaseUrl(rawBase) : rawBase;
  if (!base) return false;

  try {
    const [usersRes, pendingRes] = await Promise.all([
      fetch(`${base}/data/users.json?_=${Date.now()}`, { cache: 'no-store' }),
      fetch(`${base}/data/signup-pending.json?_=${Date.now()}`, { cache: 'no-store' }),
    ]);

    if (usersRes.ok) {
      const users = await usersRes.json().catch(() => null);
      if (users !== null && users !== undefined) _safeSetJsonStorage('sj-users-v6', users);
    }
    if (pendingRes.ok) {
      const pending = await pendingRes.json().catch(() => null);
      _safeSetJsonStorage('sj-signup-pending-v1', pending || []);
    }
    return true;
  } catch (e) {
    console.warn('[storage:syncAuthFromFirebase]', e);
    return false;
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
        if (data.entries          !== undefined) _safeSetJsonStorage('sj-entries-v4',        data.entries);
        if (data.users            !== undefined) _safeSetJsonStorage('sj-users-v6',          data.users);
        if (data.targets          !== undefined) _safeSetJsonStorage('sj-targets-v4',        data.targets);
        if (data.notices          !== undefined) _safeSetJsonStorage('sj-notices',           data.notices);
        if (data.revisits         !== undefined) _safeSetJsonStorage('sj-revisits',          data.revisits);
        if (data.clients          !== undefined) _safeSetJsonStorage('sj-clients',           data.clients);
        if (data['signup-pending']!== undefined) _safeSetJsonStorage('sj-signup-pending-v1', data['signup-pending']);
        if (data['grade-tiers']   !== undefined) _safeSetJsonStorage('sj-grade-tiers',       data['grade-tiers']);
        if (data['grade-overrides']!==undefined) _safeSetJsonStorage('sj-grade-overrides',   data['grade-overrides']);
        if (data['manual-grades'] !== undefined) _safeSetJsonStorage('sj-manual-grades',     data['manual-grades']);
        if (data['grade-churn-settings'] !== undefined) _safeSetJsonStorage('sj-grade-churn-settings', data['grade-churn-settings']);
        if (data['login-logs']    !== undefined) _safeSetJsonStorage('sj-login-logs-v1',     data['login-logs']);
        if (data['weekly-reports'] && typeof data['weekly-reports'] === 'object') {
          Object.entries(data['weekly-reports']).forEach(([uid, val]) => _safeSetJsonStorage('sj-weekly-reports-' + uid, val));
        }
        if (data['monthly-reports'] && typeof data['monthly-reports'] === 'object') {
          Object.entries(data['monthly-reports']).forEach(([uid, val]) => _safeSetJsonStorage('sj-monthly-reports-' + uid, val));
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
  if (typeof currentUser === 'undefined' || !currentUser || (typeof isAdminUser === 'function' && !isAdminUser(currentUser))) {
    alert('관리자 로그인 후 업로드할 수 있습니다.');
    return false;
  }
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
    'grade-churn-settings': 'sj-grade-churn-settings',
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

function updateFbStatus() {}
