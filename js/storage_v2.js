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
  const wm = key.match(/^sj-weekly-reports-(.+)$/);
  if (wm) return `data/weekly-reports/${wm[1]}`;
  const mm = key.match(/^sj-monthly-reports-(.+)$/);
  if (mm) return `data/monthly-reports/${mm[1]}`;
  return null;
}

function _fbUrl(path) {
  const base = (typeof DB_URL === 'string' ? DB_URL : '').replace(/\/+$/, '');
  return base ? `${base}/${path}.json` : null;
}

function setShared(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
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
        body: JSON.stringify(val),
      }).catch(e => console.warn('[storage:fb:set]', key, e));
    }
  }
  return true;
}

function getShared(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
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

// 앱 진입 시 Firebase /data 전체를 localStorage에 동기화
async function syncFromFirebase() {
  const url = _fbUrl('data');
  if (!url) return;
  try {
    const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== 'object') return;

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
      Object.entries(data['weekly-reports']).forEach(([uid, val]) => {
        localStorage.setItem('sj-weekly-reports-' + uid, JSON.stringify(val));
      });
    }
    if (data['monthly-reports'] && typeof data['monthly-reports'] === 'object') {
      Object.entries(data['monthly-reports']).forEach(([uid, val]) => {
        localStorage.setItem('sj-monthly-reports-' + uid, JSON.stringify(val));
      });
    }
  } catch (e) {
    console.warn('[storage:syncFromFirebase]', e);
  }
}

function setupRealtimeListeners() {}
function updateFbStatus() {}
